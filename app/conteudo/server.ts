import { z } from "zod";
import { radarSeed } from "../../lib/radar-seed";
import type { HubData, Brand, Reference } from "./model";

export const reply = (data: unknown, status = 200) =>
  Response.json(data, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
export const fail = (error: string, status = 400) => reply({ error }, status);
export const uuid = z.string().uuid();
export const text = z.string().trim().max(240);
export const required = text.min(1);
export const version = z.number().int().positive();
export const long = z.string().trim().max(6000);
export const pointer = z.object({ id: uuid, version });
export const maxFile = 15 * 1024 * 1024;
export const fileKinds = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
] as const;
export const fileRef = z.object({
  key: uuid,
  name: required,
  type: z.enum(fileKinds),
  size: z.number().int().min(1).max(maxFile),
});
export const stageKey = (brand: string, member: string, token: string) =>
  "hub/" +
  encodeURIComponent(brand) +
  "/" +
  encodeURIComponent(member) +
  "/" +
  token;
export function sameOrigin(request: Request) {
  return request.headers.get("origin") === new URL(request.url).origin;
}
export function secureUrl(value: string) {
  try {
    const u = new URL(value);
    return u.protocol === "https:" && !u.username && !u.password;
  } catch {
    return false;
  }
}
export async function fingerprint(value: string | ArrayBuffer) {
  const bytes = await crypto.subtle.digest(
    "SHA-256",
    typeof value === "string" ? new TextEncoder().encode(value) : value,
  );
  return Array.from(new Uint8Array(bytes), (x) =>
    x.toString(16).padStart(2, "0"),
  ).join("");
}
export async function brandsFor(db: D1Database) {
  const found = await db
    .prepare(
      "SELECT a.company id,c.name, EXISTS(SELECT 1 FROM hub_entries h WHERE h.brand='conta:'||a.company AND h.kind='brand') AS active FROM crm_accounts a JOIN crm_companies c ON c.id=a.company ORDER BY c.name",
    )
    .all<{ id: string; name: string; active: number }>();
  return [
    { id: "eba", name: "EBA Growth", active: true },
    ...found.results.map((b) => ({
      ...b,
      id: "conta:" + b.id,
      active: !!b.active,
    })),
  ];
}

export async function loadHub(
  db: D1Database,
  me: string,
  brandId: string,
): Promise<HubData | null> {
  const [brands, snapshot] = await Promise.all([
    brandsFor(db),
    db.batch<Record<string, unknown>>([
      db.prepare("SELECT COALESCE(MAX(version),0) version FROM hub_commands"),
      db.prepare("SELECT id,name FROM crm_members ORDER BY name"),
      db
        .prepare(
          "SELECT kind,id,version,data FROM hub_entries WHERE brand=? AND kind<>'brand' ORDER BY version DESC,id",
        )
        .bind(brandId),
      db
        .prepare(
          "SELECT id,data FROM carteira_decisions WHERE company=? ORDER BY version DESC",
        )
        .bind(brandId.slice(6)),
      db.prepare(
        "SELECT collection,id,data FROM store_entries WHERE collection IN ('records','insights')",
      ),
    ]),
  ]);
  const brand: Brand | undefined = brands.find((b) => b.id === brandId);
  if (!brand) return null;
  const [revision, members, entries, decisions, radar] = snapshot;
  const unpack = <T>(kind: string) =>
    entries.results
      .filter((r) => r.kind === kind)
      .map(
        (row) =>
          ({
            ...JSON.parse(String(row.data)),
            id: row.id,
            version: row.version,
          }) as T,
      );
  const references = new Map<string, Reference>();
  if (brandId !== "eba")
    for (const row of decisions.results) {
      const id = String(row.id);
      if (references.has("PICO:" + id)) continue;
      const d = JSON.parse(String(row.data));
      references.set("PICO:" + id, {
        id,
        kind: "PICO",
        title: d.action + " · " + d.reason,
        stage: d.stage,
      });
    }
  for (const item of radarSeed.records)
    references.set("Radar:" + item.id, {
      id: item.id,
      kind: "Radar",
      title: item.title,
    });
  for (const item of radarSeed.insights)
    references.set("Insight:" + item.id, {
      id: item.id,
      kind: "Insight",
      title: item.title,
    });
  for (const row of radar.results) {
    const d = JSON.parse(String(row.data));
    if (typeof d.title !== "string") continue;
    const id = String(row.id),
      kind = row.collection === "records" ? "Radar" : "Insight";
    references.set(kind + ":" + id, { id, kind, title: d.title });
  }
  return {
    brand,
    brands,
    me,
    version: Number(revision.results[0].version),
    members: members.results as HubData["members"],
    directives: unpack("guide"),
    assets: unpack("asset"),
    editions: unpack("edition"),
    pieces: unpack("piece"),
    feedback: unpack("feedback"),
    publications: unpack("publication"),
    results: unpack("result"),
    references: [...references.values()],
  };
}
