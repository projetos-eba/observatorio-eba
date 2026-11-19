import { env } from "cloudflare:workers";
import { today } from "../crm/model";
import { editionFor, latest } from "../conteudo/model";
import { loadHub } from "../conteudo/server";
import { graph, GraphError, type Credential } from "./graph";
import {
  brand,
  providers,
  type Campaign,
  type Connection,
  type Job,
  type Post,
  type Provider,
  type Resource,
  type Source,
  type State,
} from "./model";

type Stored = {
  provider: Provider;
  resource: string;
  generation: string;
  credential: string | null;
  verifiedAt: string;
  status: string;
  error: string;
  successDay: string;
  retryAt: string;
  attempts: number;
  lockId: string;
  lockUntil: string;
};
const enc = new TextEncoder();
const b64 = (b: ArrayBuffer | Uint8Array) =>
  btoa(
    Array.from(b instanceof Uint8Array ? b : new Uint8Array(b), (n) =>
      String.fromCharCode(n),
    ).join(""),
  );
const unbase = (s: string) =>
  new Uint8Array(Array.from(atob(s), (v) => v.charCodeAt(0)));
async function encryption() {
  const key = env.EBA_INTEGRATION_KEY;
  if (!key || !/^\p{ASCII_Hex_Digit}{64}$/u.test(key))
    throw new Error(
      "O cofre local está indisponível. Inicie o servidor com npm run dev.",
    );
  return crypto.subtle.importKey(
    "raw",
    new Uint8Array(key.match(/../g)!.map((x) => parseInt(x, 16))),
    "AES-GCM",
    false,
    ["encrypt", "decrypt"],
  );
}
export async function seal(
  value: Credential,
  provider: Provider,
  resource: string,
) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv,
      additionalData: enc.encode([brand, provider, resource].join(":")),
    },
    await encryption(),
    enc.encode(JSON.stringify(value)),
  );
  return b64(iv) + "." + b64(data);
}
async function unseal(row: Stored) {
  try {
    const [iv, data] = row.credential!.split(".");
    const result = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: unbase(iv),
        additionalData: enc.encode(
          [brand, row.provider, row.resource].join(":"),
        ),
      },
      await encryption(),
      unbase(data),
    );
    return JSON.parse(new TextDecoder().decode(result)) as Credential;
  } catch {
    throw new GraphError(
      "A credencial local não pôde ser aberta. Confira a chave do ambiente ou troque a credencial.",
      "credential",
    );
  }
}
export function current(db: D1Database, provider: Provider) {
  return db
    .prepare(
      "SELECT * FROM integration_connections WHERE brand=? AND provider=?",
    )
    .bind(brand, provider)
    .first<Stored>();
}
async function resource(db: D1Database, provider: Provider, id: string) {
  const row = await db
    .prepare(
      "SELECT data FROM integration_resources WHERE brand=? AND provider=? AND id=?",
    )
    .bind(brand, provider, id)
    .first<{ data: string }>();
  return row ? (JSON.parse(row.data) as Resource) : null;
}
export async function install(
  db: D1Database,
  provider: Provider,
  selection: Resource,
  credential: Credential,
  previous: Stored | null,
) {
  const generation = crypto.randomUUID(),
    secret = await seal(credential, provider, selection.id),
    time = new Date().toISOString();
  const conn = previous
    ? db
        .prepare(
          "UPDATE integration_connections SET resource=?,credential=?,generation=?,verifiedAt=?,status='connected',error='',successDay='',retryAt='',attempts=0,lockId='',lockUntil='' WHERE brand=? AND provider=? AND generation=?",
        )
        .bind(
          selection.id,
          secret,
          generation,
          time,
          brand,
          provider,
          previous.generation,
        )
    : db
        .prepare(
          "INSERT OR IGNORE INTO integration_connections(brand,provider,resource,credential,generation,verifiedAt,status,error,successDay,retryAt,attempts,lockId,lockUntil) VALUES(?,?,?,?,?,?,'connected','','','',0,'','')",
        )
        .bind(brand, provider, selection.id, secret, generation, time);
  const [saved] = await db.batch([
    conn,
    db
      .prepare(
        "INSERT INTO integration_resources(brand,provider,id,data,syncedAt,fromDay,throughDay) SELECT ?,?,?,?,'','','' WHERE EXISTS(SELECT 1 FROM integration_connections WHERE brand=? AND provider=? AND generation=?) ON CONFLICT(brand,provider,id) DO UPDATE SET data=excluded.data",
      )
      .bind(
        brand,
        provider,
        selection.id,
        JSON.stringify(selection),
        brand,
        provider,
        generation,
      ),
  ]);
  return !!saved.meta.changes;
}
export async function disconnect(db: D1Database, provider: Provider) {
  await db
    .prepare(
      "UPDATE integration_connections SET credential=NULL,generation=?,status='disconnected',error='',retryAt='',lockId='',lockUntil='' WHERE brand=? AND provider=?",
    )
    .bind(crypto.randomUUID(), brand, provider)
    .run();
}
export async function syncProvider(
  db: D1Database,
  provider: Provider,
  trigger: "manual" | "daily" | "test",
) {
  const row = await current(db, provider);
  if (!row?.credential)
    return { status: "skipped", message: "Conecte o app para continuar." };
  const at = new Date(),
    iso = at.toISOString(),
    day = today();
  if (row.lockUntil > iso)
    return {
      status: "busy",
      message: "Já existe uma atualização em andamento.",
    };
  if (
    trigger === "daily" &&
    (provider === "whatsapp" ||
      row.successDay === day ||
      row.status === "attention" ||
      row.retryAt > iso)
  )
    return {
      status: "skipped",
      message: "A leitura diária está em dia ou aguarda revisão.",
    };
  if (trigger !== "daily" && row.retryAt > iso && row.status === "limited")
    return {
      status: "limited",
      message: "Aguarde o limite de consultas da Meta.",
    };
  const selection = await resource(db, provider, row.resource);
  if (!selection)
    return { status: "failed", message: "O recurso precisa ser reconectado." };
  const job = crypto.randomUUID(),
    until = new Date(at.getTime() + 240_000).toISOString();
  const previous = await db
    .prepare(
      "SELECT started FROM integration_runs WHERE brand=? AND provider=? AND resource=? ORDER BY started DESC LIMIT 1",
    )
    .bind(brand, provider, row.resource)
    .first<{ started: string }>();
  const sao = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const attempts =
    previous && sao.format(new Date(previous.started)) === day
      ? row.attempts + 1
      : 1;
  const [claimed] = await db.batch([
    db
      .prepare(
        "UPDATE integration_connections SET lockId=?,lockUntil=?,attempts=? WHERE brand=? AND provider=? AND generation=? AND lockUntil<=? AND successDay=? AND attempts=?",
      )
      .bind(
        job,
        until,
        attempts,
        brand,
        provider,
        row.generation,
        iso,
        row.successDay,
        row.attempts,
      ),
    db
      .prepare(
        "INSERT INTO integration_runs(id,brand,provider,resource,started,finished,trigger,status,detail) SELECT ?,?,?,?,?,'',?,'running','' WHERE EXISTS(SELECT 1 FROM integration_connections WHERE brand=? AND provider=? AND lockId=?)",
      )
      .bind(
        job,
        brand,
        provider,
        row.resource,
        iso,
        trigger,
        brand,
        provider,
        job,
      ),
  ]);
  if (!claimed.meta.changes)
    return { status: "busy", message: "Outra sessão assumiu a atualização." };
  const guard =
    " AND EXISTS(SELECT 1 FROM integration_connections WHERE brand=? AND provider=? AND generation=? AND lockId=?)";
  const lock = [brand, provider, row.generation, job];
  try {
    const client = graph(provider, await unseal(row));
    const testing = trigger === "test" || provider === "whatsapp";
    const checked = testing ? await client.verify(selection) : selection;
    const data = testing ? null : await client.sync(checked);
    const finish = new Date().toISOString();
    const commands: D1PreparedStatement[] = [];
    if (data) {
      const unique = [
        ...new Map(data.rows.map((r) => [r.day + "\n" + r.id, r])).values(),
      ];
      commands.push(
        db
          .prepare(
            "DELETE FROM integration_readings WHERE brand=? AND provider=? AND resource=? AND day BETWEEN ? AND ?" +
              guard,
          )
          .bind(
            brand,
            provider,
            row.resource,
            data.from,
            data.through,
            ...lock,
          ),
      );
      for (let i = 0; i < unique.length; i += 24) {
        const rows = unique.slice(i, i + 24);
        commands.push(
          db
            .prepare(
              "INSERT INTO integration_readings(brand,provider,resource,day,id,data) SELECT ?,?,?,json_extract(value,'$.day'),json_extract(value,'$.id'),value FROM json_each(?) WHERE 1=1" +
                guard,
            )
            .bind(brand, provider, row.resource, JSON.stringify(rows), ...lock),
        );
      }
      commands.push(
        db
          .prepare(
            "UPDATE integration_resources SET syncedAt=?,fromDay=?,throughDay=? WHERE brand=? AND provider=? AND id=?" +
              guard,
          )
          .bind(
            finish,
            data.from,
            data.through,
            brand,
            provider,
            row.resource,
            ...lock,
          ),
      );
    } else {
      commands.push(
        db
          .prepare(
            "UPDATE integration_resources SET data=? WHERE brand=? AND provider=? AND id=?" +
              guard,
          )
          .bind(
            JSON.stringify(checked),
            brand,
            provider,
            row.resource,
            ...lock,
          ),
      );
    }
    commands.push(
      db
        .prepare(
          "UPDATE integration_runs SET finished=?,status=CASE WHEN EXISTS(SELECT 1 FROM integration_connections WHERE brand=? AND provider=? AND generation=? AND lockId=?) THEN 'ok' ELSE 'cancelled' END,detail=? WHERE id=?",
        )
        .bind(
          finish,
          ...lock,
          data ? data.rows.length + " registros" : "Acesso verificado",
          job,
        ),
    );
    commands.push(
      db
        .prepare(
          "UPDATE integration_connections SET verifiedAt=?,successDay=?,status=?,error='',retryAt='',attempts=0,lockId='',lockUntil='' WHERE brand=? AND provider=? AND generation=? AND lockId=?",
        )
        .bind(
          finish,
          data ? day : row.successDay,
          data ? "synced" : "connected",
          ...lock,
        ),
    );
    const report = await db.batch(commands);
    return report.at(-1)?.meta.changes
      ? {
          status: "ok",
          message: data ? "Sincronização concluída." : "Acesso verificado.",
        }
      : {
          status: "skipped",
          message: "A conexão foi alterada durante a consulta.",
        };
  } catch (error) {
    const problem =
      error instanceof GraphError
        ? error
        : new GraphError(
            "A leitura não foi gravada. Tente novamente.",
            "network",
          );
    const limited = problem.code === "throttle",
      transient = limited || problem.code === "network";
    const finish = new Date();
    const retry = transient
      ? new Date(
          Math.max(
            finish.getTime() + Math.max(problem.retry, 900_000),
            attempts >= 3 ? nextMorning(finish) : 0,
          ),
        ).toISOString()
      : "";
    const status = limited ? "limited" : transient ? "error" : "attention";
    await db.batch([
      db
        .prepare(
          "UPDATE integration_runs SET finished=?,status='failed',detail=? WHERE id=?",
        )
        .bind(finish.toISOString(), problem.message, job),
      db
        .prepare(
          "UPDATE integration_connections SET status=?,error=?,retryAt=?,lockId='',lockUntil='' WHERE brand=? AND provider=? AND generation=? AND lockId=?",
        )
        .bind(status, problem.message, retry, ...lock),
    ]);
    return { status, message: problem.message };
  }
}
function nextMorning(now: Date) {
  // São Paulo uses UTC−03 in the pilot.
  const date = new Date(today() + "T08:00:00-03:00");
  if (date <= now) date.setUTCDate(date.getUTCDate() + 1);
  return date.getTime();
}
export async function getState(
  db: D1Database,
  me: string,
  provider: Provider,
  id: string,
  page: number,
): Promise<State> {
  const rows = await db.batch<Record<string, unknown>>([
    db
      .prepare(
        "SELECT provider,resource,verifiedAt,status,error,retryAt,lockUntil FROM integration_connections WHERE brand=?",
      )
      .bind(brand),
    db
      .prepare(
        "SELECT provider,id,data,syncedAt,fromDay,throughDay FROM integration_resources WHERE brand=? ORDER BY syncedAt DESC",
      )
      .bind(brand),
    db
      .prepare(
        "SELECT id,provider,resource,started,finished,trigger,status,detail FROM integration_runs WHERE brand=? ORDER BY started DESC LIMIT 12",
      )
      .bind(brand),
    db
      .prepare(
        "SELECT resource,media,publication FROM integration_post_links WHERE brand=?",
      )
      .bind(brand),
  ]);
  const time = new Date().toISOString();
  const connected = rows[0].results.map(
    (r) =>
      ({
        provider: r.provider,
        id: r.resource,
        status: r.status,
        error: r.error,
        verifiedAt: r.verifiedAt,
        retryAt: r.retryAt,
        busy: String(r.lockUntil) > time,
      }) as Connection,
  );
  const sources = rows[1].results.map(
    (r) =>
      ({
        ...JSON.parse(String(r.data)),
        provider: r.provider,
        id: r.id,
        syncedAt: r.syncedAt,
        from: r.fromDay,
        through: r.throughDay,
      }) as Source,
  );
  const selected =
    sources.find(
      (s) =>
        s.provider === provider &&
        s.id === (id || connected.find((c) => c.provider === provider)?.id),
    ) || null;
  let posts: Post[] = [],
    campaigns: Campaign[] = [],
    total = 0;
  if (selected?.syncedAt) {
    const args = [
      brand,
      provider,
      selected.id,
      selected.from,
      selected.through,
    ];
    const where =
      " FROM integration_readings WHERE brand=? AND provider=? AND resource=? AND day BETWEEN ? AND ?";
    const [items, count] = await db.batch<Record<string, unknown>>([
      db
        .prepare(
          "SELECT data" + where + " ORDER BY day DESC,id LIMIT 30 OFFSET ?",
        )
        .bind(...args, (page - 1) * 30),
      db.prepare("SELECT COUNT(*) total" + where).bind(...args),
    ]);
    if (provider === "instagram")
      posts = items.results.map((r) => JSON.parse(String(r.data)) as Post);
    if (provider === "meta_ads")
      campaigns = items.results.map(
        (r) => JSON.parse(String(r.data)) as Campaign,
      );
    total = Number(count.results[0].total);
  }
  const hub = await loadHub(db, me, brand);
  const publications = hub
    ? latest(hub.publications)
        .filter((p) => p.published)
        .map((p) => ({
          id: p.id,
          title: editionFor(hub, p)?.title || "Publicação",
          channel: editionFor(hub, p)?.channel || "",
          code: p.code,
          target: p.target,
          destination: p.destination,
          published: p.published,
          link: p.link,
        }))
    : [];
  return {
    connected,
    sources,
    selected,
    posts,
    campaigns,
    total,
    publications,
    links: rows[3].results as State["links"],
    jobs: rows[2].results.map(
      (r) =>
        ({
          ...r,
          status:
            r.status === "running" &&
            r.started &&
            Date.parse(String(r.started)) + 240000 < Date.now()
              ? "interrupted"
              : r.status,
        }) as Job,
    ),
  };
}
export async function linkPost(
  db: D1Database,
  me: string,
  resource: string,
  media: string,
  publication: string,
) {
  const post = await db
    .prepare(
      "SELECT 1 FROM integration_readings WHERE brand=? AND provider='instagram' AND resource=? AND id=? LIMIT 1",
    )
    .bind(brand, resource, media)
    .first();
  const hub = await loadHub(db, me, brand),
    p =
      hub &&
      latest(hub.publications).find((p) => p.id === publication && p.published);
  if (!post || !p || !hub || editionFor(hub, p)?.channel !== "Instagram")
    return false;
  await db
    .prepare(
      "INSERT INTO integration_post_links(brand,resource,media,publication,author,at) VALUES(?,?,?,?,?,?) ON CONFLICT(brand,resource,media) DO UPDATE SET publication=excluded.publication,author=excluded.author,at=excluded.at",
    )
    .bind(brand, resource, media, publication, me, new Date().toISOString())
    .run();
  return true;
}
export async function publicationPost(db: D1Database, id: string) {
  const result = await db
    .prepare(
      "SELECT r.data,s.syncedAt FROM integration_post_links l JOIN integration_readings r ON r.brand=l.brand AND r.resource=l.resource AND r.id=l.media AND r.provider='instagram' JOIN integration_resources s ON s.provider=r.provider AND s.brand=r.brand AND s.id=r.resource WHERE l.brand=? AND l.publication=? ORDER BY r.day DESC LIMIT 1",
    )
    .bind(brand, id)
    .first<{ data: string; syncedAt: string }>();
  return result
    ? { post: JSON.parse(result.data) as Post, syncedAt: result.syncedAt }
    : null;
}
export async function daily(db: D1Database) {
  for (const provider of providers.filter((p) => p !== "whatsapp"))
    await syncProvider(db, provider, "daily");
}
