import { z } from "zod";
import { radarSeed } from "./radar-seed";
import { validDate } from "../app/carteira/csv";

export const radarId = z.string().min(1).max(128).regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/);
const title = z.string().trim().min(1).max(240);
const text = z.string().trim().max(500).default("");
const long = z.string().trim().max(12000).default("");
const date = z.string().refine(validDate);
const optionalDate = z.union([date, z.literal("")]).default("");
const status = z.enum(["A avaliar", "Em avaliação", "Analisado", "Arquivado"]);
const link = z.string().trim().max(4000).refine((value) => {
  if (!value) return true;
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password;
  } catch { return false; }
}).default("");
const id = radarId.optional();
const fields = [
  "title", "changed", "why", "opportunity", "risks", "priority", "decision", "status",
  "owner", "next", "stage", "impact", "theme", "niches", "url", "source", "date",
  "sourceDate", "summary",
] as const;
const event = z.object({
  at: z.string().datetime(), status, decision: long, owner: text, fields: z.array(z.enum(fields)).max(fields.length),
  author: z.string().max(240).optional(),
}).strict();
export const radarCollections = {
  records: z.object({
    id, title, date, sourceDate: optionalDate, url: link, status,
    source: text, theme: text, owner: text, summary: long, changed: long, why: long,
    opportunity: long, risks: long, decision: long, next: long,
    stage: z.enum(["Posicionar", "Impulsionar", "Converter", "Otimizar"]),
    impact: z.enum(["Alto", "Médio", "Baixo"]),
    priority: z.enum(["Alta", "Média", "Baixa"]),
    niches: z.array(title).max(20).default([]),
    updatedAt: z.string().datetime().optional(),
    reviewedAt: optionalDate.optional(),
    history: z.array(event).max(50).optional(),
  }).strict(),
  tests: z.object({
    id, title, recordId: z.union([radarId, z.literal("")]).default(""),
    hypothesis: long, metric: text, result: long, startDate: optionalDate, endDate: optionalDate,
    status: z.enum(["Planejado", "Em andamento", "Concluído"]),
  }).strict().refine((row) => !row.startDate || !row.endDate || row.endDate >= row.startDate,
    "O encerramento deve ser igual ou posterior ao início."),
  insights: z.object({
    id, title, date, text: long.pipe(z.string().min(1)),
    recordId: z.union([radarId, z.literal("")]).default(""),
    destination: z.enum(["Proposta", "Diagnóstico", "Página", "Comunicação"]),
  }).strict(),
  settings: z.object({ id, value: z.number().int().min(1).max(999) }).strict(),
};

export function saveRecord(input: z.infer<typeof radarCollections.records>, prior: Record<string, unknown> | undefined, author: string, today: string) {
  const at = new Date().toISOString();
  const previous = prior?.status;
  const archived = (value: unknown) => value === "Analisado" || value === "Arquivado";
  const previousDate = String(prior?.reviewedAt || prior?.updatedAt || prior?.date || "").slice(0, 10);
  const reviewedAt = archived(input.status) ? (archived(previous) && validDate(previousDate) ? previousDate : today) : "";
  const history = Array.isArray(prior?.history) ? prior.history : [];
  const changed = fields.filter((key) => JSON.stringify(prior?.[key] ?? "") !== JSON.stringify(input[key] ?? ""));
  return {
    ...input,
    updatedAt: at,
    reviewedAt,
    history: changed.length
      ? [...history, { at, status: input.status, decision: input.decision, owner: input.owner, fields: changed, author }].slice(-50)
      : history,
  };
}

const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const letters = ["aáàãâäÁÀÃÂÄ", "eéêèëÉÊÈË", "iíîìïÍÎÌÏ", "oóôõòöÓÔÕÒÖ", "uúüûùÚÜÛÙ", "cçÇ"];
function folded(expression: string) {
  return "lower(" + letters.reduce((sql, chars) =>
    [...chars.slice(1)].reduce((value, char) => `replace(${value},'${char}','${chars[0]}')`, sql),
    expression) + ")";
}

export async function radarHistory(db: D1Database, query: URLSearchParams) {
  const where = ["json_extract(r.data,'$.status') IN ('Analisado','Arquivado')"];
  const args: (number | string)[] = [JSON.stringify(radarSeed.records)];
  for (const field of ["theme", "source", "stage", "impact", "status"] as const) {
    const value = query.get(field)?.trim().slice(0, 500);
    if (value) {
      where.push(`json_extract(r.data,'$.${field}')=?`);
      args.push(value);
    }
  }
  const niche = query.get("niche")?.trim().slice(0, 240);
  if (niche) {
    where.push("EXISTS(SELECT 1 FROM json_each(r.data,'$.niches') n WHERE n.value=?)");
    args.push(niche);
  }
  const from = query.get("from"), to = query.get("to");
  if (from && to && validDate(from) && validDate(to)) {
    where.push("json_extract(r.data,'$.sourceDate') BETWEEN ? AND ?");
    args.push(from, to);
  }
  const q = normalize(query.get("q")?.trim().slice(0, 240) || "");
  if (q) {
    const terms = ["title", "summary", "why", "changed", "opportunity", "source", "theme", "stage", "owner", "niches", "decision", "next", "risks", "status"];
    const content = terms.map((key) => `COALESCE(json_extract(r.data,'$.${key}'),'')`).join(" || ' ' || ");
    where.push(`instr(${folded(content)},?)>0`);
    args.push(q);
  }
  const page = Math.min(Math.max(Number(query.get("pagina")) || 1, 1), 1000) | 0;
  const count = 20;
  const cte = `WITH effective AS (
    SELECT id,data,revision FROM store_entries WHERE collection='records'
    UNION ALL
    SELECT json_extract(seed.value,'$.id'),seed.value,0 FROM json_each(?) seed
    WHERE NOT EXISTS (SELECT 1 FROM store_entries s WHERE s.collection='records' AND s.id=json_extract(seed.value,'$.id'))
  )`;
  const whereClause = " FROM effective r WHERE " + where.join(" AND ");
  const [rows, totals] = await db.batch<{ id: string; data: string; revision: number; amount: number }>([
    db.prepare(cte + " SELECT r.id,r.data,r.revision" + whereClause +
      " ORDER BY substr(COALESCE(NULLIF(json_extract(r.data,'$.reviewedAt'),''),NULLIF(json_extract(r.data,'$.updatedAt'),''),json_extract(r.data,'$.date')),1,10) DESC,r.id LIMIT ? OFFSET ?")
      .bind(...args, count, (page - 1) * count),
    db.prepare(cte + " SELECT count(*) amount" + whereClause).bind(...args),
  ]);
  const total = totals.results[0].amount;
  return {
    entries: rows.results.map((row) => ({ ...JSON.parse(row.data), id: row.id })),
    revisions: Object.fromEntries(rows.results.map((row) => [row.id, row.revision])),
    total,
    next: page * count < total,
  };
}
