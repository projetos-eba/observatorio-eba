import { offsetDay } from "../crm/model";
import {
  graphVersion,
  type Campaign,
  type Dataset,
  type Post,
  type Provider,
  type Resource,
} from "./model";

export type Credential = { token: string; secret?: string };
export class GraphError extends Error {
  constructor(
    message: string,
    readonly code:
      | "credential"
      | "expired"
      | "permission"
      | "throttle"
      | "network"
      | "invalid",
    readonly retry = 0,
  ) {
    super(message);
  }
}
const invalid = () =>
  new GraphError(
    "A Meta devolveu dados incompletos. Confira o recurso e tente novamente.",
    "invalid",
  );
const isId = (v: string) => /^\d{1,32}$/.test(v);
const asId = (v: unknown) => {
  const id = typeof v === "string" ? v : "";
  if (!isId(id)) throw invalid();
  return id;
};
const safeText = (v: unknown, n = 240) =>
  typeof v === "string" ? v.slice(0, n) : "";
const dayAt = (zone: string, now: Date) =>
  new Intl.DateTimeFormat("sv-SE", {
    timeZone: zone,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(now);
const numeric = (value: unknown) =>
  (typeof value === "number" ||
    (typeof value === "string" && /^\d+(\.\d+)?$/.test(value))) &&
  Number.isFinite(Number(value)) &&
  Number(value) >= 0
    ? Number(value)
    : null;

function verifyStatus(
  response: Response,
  envelope: { error?: { code?: number; is_transient?: boolean } },
) {
  if (response.ok && !envelope.error) return;
  const code = envelope.error?.code;
  if (code === 190 || code === 102 || response.status === 401)
    throw new GraphError(
      "Credencial expirada ou inválida. Gere outra no painel da Meta.",
      "expired",
    );
  if (code === 10 || code === 200 || code === 294 || response.status === 403)
    throw new GraphError(
      "Permissão insuficiente. Confira as permissões do app e o acesso ao recurso na Meta.",
      "permission",
    );
  if (response.status === 429 || [4, 17, 32, 613, 80004].includes(code || 0)) {
    const when = response.headers.get("Retry-After") || "";
    const retry = /^\d+$/.test(when)
      ? Number(when) * 1000
      : Math.max(0, Date.parse(when) - Date.now());
    throw new GraphError(
      "A Meta limitou temporariamente as consultas. Aguarde para atualizar.",
      "throttle",
      Number.isFinite(retry) ? retry : 0,
    );
  }
  if (response.status >= 500 || envelope.error?.is_transient)
    throw new GraphError(
      "A Meta está temporariamente indisponível.",
      "network",
    );
  throw new GraphError(
    "A Meta recusou o recurso ou os campos solicitados. Confira a configuração.",
    "invalid",
  );
}

export function graph(
  provider: Provider,
  credential: Credential,
  fetcher: typeof fetch = (input,init) => fetch(input,init),
  now = () => new Date(),
) {
  const host =
    provider === "instagram" ? "graph.instagram.com" : "graph.facebook.com";
  async function get<T>(
    path: string,
    params: Record<string, string>,
  ): Promise<T> {
    const url = new URL("https://" + host + "/" + graphVersion + "/" + path);
    for (const [key, value] of Object.entries(params))
      url.searchParams.set(key, value);
    if (credential.secret && provider !== "instagram") {
      const key = await crypto.subtle.importKey(
        "raw",
        new TextEncoder().encode(credential.secret),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"],
      );
      const bytes = await crypto.subtle.sign(
        "HMAC",
        key,
        new TextEncoder().encode(credential.token),
      );
      url.searchParams.set(
        "appsecret_proof",
        Array.from(new Uint8Array(bytes), (b) =>
          b.toString(16).padStart(2, "0"),
        ).join(""),
      );
    }
    let response: Response;
    try {
      response = await fetcher(url, {
        headers: { Authorization: "Bearer " + credential.token },
        redirect: "manual",
        signal: AbortSignal.timeout(6000),
      });
    } catch {
      throw new GraphError(
        "Falha de comunicação com a Meta. Tente novamente.",
        "network",
      );
    }
    if (response.status >= 300 && response.status < 400) throw invalid();
    let payload;
    try {
      payload = (await response.json()) as Record<string, unknown>;
    } catch {
      verifyStatus(response, {});
      throw invalid();
    }
    verifyStatus(response, payload);
    return payload as T;
  }
  async function paginate(
    path: string,
    params: Record<string, string>,
    keep?: (r: Record<string, unknown>) => boolean,
  ) {
    const output: Record<string, unknown>[] = [];
    const seen = new Set<string>();
    let after = "";
    for (let page = 0; page < 30; page++) {
      const response = await get<{
        data?: Record<string, unknown>[];
        paging?: { next?: string; cursors?: { after?: string } };
      }>(path, { limit: "100", ...params, ...(after ? { after } : {}) });
      if (!Array.isArray(response.data)) throw invalid();
      for (const item of response.data)
        if (!keep || keep(item)) output.push(item);
      if (!response.paging?.next) return output;
      after = response.paging.cursors?.after || "";
      if (!after || after.length > 2048 || seen.has(after)) throw invalid();
      seen.add(after);
    }
    throw new GraphError(
      "A leitura atingiu o limite de paginação do piloto. A leitura anterior foi preservada.",
      "invalid",
    );
  }
  const adAccount = (r: Record<string, unknown>) => {
    const id = asId(String(r.id || "").replace(/^act_/, ""));
    const currency = safeText(r.currency),
      timezone = safeText(r.timezone_name);
    if (!/^[A-Z]{3}$/.test(currency) || !timezone) throw invalid();
    try {
      dayAt(timezone, now());
    } catch {
      throw invalid();
    }
    return { id, name: safeText(r.name) || "act_" + id, currency, timezone };
  };
  async function discover(parent: string): Promise<Resource[]> {
    if (provider === "instagram") {
      const r = await get<Record<string, unknown>>("me", {
        fields: "user_id,username",
      });
      const id = asId(typeof r.user_id === "string" ? r.user_id : r.id ?? (Number.isSafeInteger(r.user_id) ? String(r.user_id) : ""));
      const username = safeText(r.username);
      if (!username) throw invalid();
      return [{ id, name: "@" + username }];
    }
    if (provider === "meta_ads") {
      const fields = "id,name,currency,timezone_name";
      if (parent) {
        if (!isId(parent)) throw invalid();
        return [adAccount(await get("act_" + parent, { fields }))];
      }
      return (await paginate("me/adaccounts", { fields })).map(adAccount);
    }
    if (!isId(parent)) throw invalid();
    return (
      await paginate(parent + "/phone_numbers", {
        fields: "id,display_phone_number,verified_name",
      })
    ).map((row) => {
      const id = asId(row.id),
        phone = safeText(row.display_phone_number).replace(/\D/g, "");
      if (!/^[1-9]\d{9,14}$/.test(phone)) throw invalid();
      return {
        id,
        parent,
        name: safeText(row.verified_name) || "Número comercial",
        phone,
      };
    });
  }
  async function sync(resource: Resource): Promise<Dataset> {
    const zone =
      provider === "meta_ads"
        ? resource.timezone || "America/Sao_Paulo"
        : "America/Sao_Paulo";
    const current = dayAt(zone, now()),
      through = provider === "meta_ads" ? offsetDay(current, -1) : current,
      from = offsetDay(through, -29);
    if (provider === "instagram") {
      const data = await paginate(asId(resource.id) + "/media", {
        fields:
          "id,caption,media_type,media_product_type,permalink,timestamp,like_count,comments_count",
        since: String(Math.floor(Date.parse(from + "T00:00:00-03:00") / 1000)),
      });
      const rows: Post[] = data.flatMap((row) => {
        const date = new Date(safeText(row.timestamp));
        if (!Number.isFinite(date.getTime())) throw invalid();
        const day = dayAt(zone, date),
          url = safeText(row.permalink, 1800);
        if (day < from || day > through) return [];
        return [
          {
            id: asId(row.id),
            day,
            caption: safeText(row.caption, 1000),
            format:
              safeText(row.media_product_type) || safeText(row.media_type),
            url: /^https:\/\/(www\.)?instagram\.com\//i.test(url) ? url : "",
            likes: numeric(row.like_count),
            comments: numeric(row.comments_count),
          },
        ];
      });
      return { rows, from, through };
    }
    if (provider === "meta_ads") {
      const data = await paginate("act_" + asId(resource.id) + "/insights", {
        level: "campaign",
        time_increment: "1",
        time_range: JSON.stringify({ since: from, until: through }),
        fields: "campaign_id,campaign_name,date_start,spend,impressions,clicks",
      });
      const rows: Campaign[] = data.map((row) => {
        const day = safeText(row.date_start),
          spend = numeric(row.spend),
          impressions = numeric(row.impressions),
          clicks = numeric(row.clicks);
        if (
          !/^\d{4}-\d{2}-\d{2}$/.test(day) ||
          day < from ||
          day > through ||
          spend === null ||
          impressions === null ||
          clicks === null
        )
          throw invalid();
        const id = asId(row.campaign_id);
        return {
          id,
          day,
          name: safeText(row.campaign_name) || id,
          spend,
          impressions,
          clicks,
        };
      });
      return { rows, from, through };
    }
    return { rows: [], from: current, through: current };
  }
  async function verify(resource: Resource) {
    const options = await discover(
      provider === "whatsapp"
        ? resource.parent || ""
        : provider === "meta_ads"
          ? resource.id
          : "",
    );
    const choice = options.find((o) => o.id === resource.id);
    if (!choice)
      throw new GraphError(
        "O recurso selecionado ficou indisponível para esta credencial.",
        "permission",
      );
    if (provider === "meta_ads")
      await get("act_" + choice.id + "/insights", {
        date_preset: "last_7d",
        level: "campaign",
        fields: "impressions",
        limit: "1",
      });
    if (provider === "instagram")
      await get(choice.id + "/media", { fields: "id", limit: "1" });
    return choice;
  }
  return { discover, verify, sync };
}
