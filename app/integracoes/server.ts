import { editionFor, latest } from "../conteudo/model";
import { loadHub } from "../conteudo/server";
import type { WorkspaceSession } from "../crm/session";
import { today } from "../crm/model";
import {
  brand,
  type Campaign,
  type Connection,
  type Job,
  type Post,
  type Provider,
  type Source,
  type State,
} from "./model";

export async function getState(
  session: WorkspaceSession,
  provider: Provider,
  id: string,
  page: number,
  jobPage: number,
  jobStatus: string,
  auditPage: number,
): Promise<State> {
  const { db } = session;
  const rows = await db.batch<Record<string, unknown>>([
    db
      .prepare(
        `SELECT c.provider,c.resource,c.verifiedAt,c.status,c.error,c.retryAt,c.lockUntil,c.successDay,s.syncedAt
          FROM integration_connections c LEFT JOIN integration_resources s
          ON s.brand=c.brand AND s.provider=c.provider AND s.id=c.resource WHERE c.brand=?`,
      )
      .bind(brand),
    db
      .prepare(
        "SELECT provider,id,data,syncedAt,fromDay,throughDay FROM integration_resources WHERE brand=? ORDER BY syncedAt DESC",
      )
      .bind(brand),
    db
      .prepare(
        "SELECT id,provider,resource,started,finished,trigger,status,detail FROM integration_runs WHERE brand=? AND provider=?" +
        (jobStatus ? " AND status=?" : "") + " ORDER BY started DESC,id DESC LIMIT 13 OFFSET ?",
      )
      .bind(brand, provider, ...(jobStatus ? [jobStatus] : []), (jobPage - 1) * 12),
    db
      .prepare(
        "SELECT resource,media,publication FROM integration_post_links WHERE brand=?",
      )
      .bind(brand),
  ]);
  const now = new Date();
  const time = now.toISOString();
  const day = today();
  const late = time >= new Date(day + "T09:00:00-03:00").toISOString();
  const audit = session.admin ? (await db.prepare(`SELECT a.id,a.action,a.resource,a.at,m.name author
    FROM integration_audit a JOIN crm_members m ON m.id=a.author
    WHERE a.brand=? AND a.provider=? ORDER BY a.at DESC,a.id DESC LIMIT 13 OFFSET ?`)
    .bind(brand, provider, (auditPage - 1) * 12).all<State["audit"][number]>()).results : [];
  const connected = rows[0].results.map(
    (r) =>
      ({
        provider: r.provider,
        id: r.resource,
        status: r.status,
        error: r.error,
        verifiedAt: r.verifiedAt,
        lastSuccess: r.provider === "whatsapp" ? r.verifiedAt : r.syncedAt || "",
        overdue: late && r.status !== "disconnected" && r.successDay !== day,
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
  const hub = await loadHub(session, brand);
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
    canManage: session.admin,
    connected,
    sources,
    jobsNext: rows[2].results.length > 12,
    audit: audit.slice(0, 12),
    auditNext: audit.length > 12,
    selected,
    posts,
    campaigns,
    total,
    publications,
    links: rows[3].results as State["links"],
    jobs: rows[2].results.slice(0, 12).map(
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
  session: WorkspaceSession,
  resource: string,
  media: string,
  publication: string,
) {
  const { db, id: me } = session;
  const post = await db
    .prepare(
      "SELECT 1 FROM integration_readings WHERE brand=? AND provider='instagram' AND resource=? AND id=? LIMIT 1",
    )
    .bind(brand, resource, media)
    .first();
  const hub = await loadHub(session, brand),
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
