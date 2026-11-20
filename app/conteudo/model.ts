import { dateLabel, offsetDay, today } from "../crm/model";
import { monday, pico, weekLabel } from "../carteira/model";
export { dateLabel, offsetDay, today, monday, pico, weekLabel };
export const stages = [
  "Pauta",
  "Produção",
  "Revisão",
  "Aprovada",
  "Publicada",
  "Avaliada",
] as const;
export const channels = [
  "Instagram",
  "Facebook",
  "LinkedIn",
  "YouTube",
  "Site",
  "WhatsApp",
  "E-mail",
] as const;
export const formats = [
  "Carrossel",
  "Vídeo",
  "Post",
  "Artigo",
  "Anúncio",
  "E-mail",
  "Roteiro",
] as const;
export const outcomes = ["Lead confirmado", "Agendamento", "Venda"] as const;
export const directiveKinds = [
  "Voz",
  "Mensagem",
  "Prova",
  "CTA",
  "Restrição",
] as const;
export const assetKinds = [
  "Fotografia",
  "Identidade",
  "Vídeo",
  "Documento",
  "Template",
  "Outro",
] as const;
export type Channel = (typeof channels)[number];
export type Format = (typeof formats)[number];
export type Goal = (typeof outcomes)[number];
export type Stage = (typeof pico)[number];
export type EditorialStatus = (typeof stages)[number];
export type Brand = { id: string; name: string; active: boolean };
export type Member = { id: string; name: string };
export type Pointer = { id: string; version: number };
type Entry = { id: string; version: number; author: string; at: string };
export type FileRef = { key: string; name: string; type: string; size: number };
export type Directive = Entry & {
  kind: (typeof directiveKinds)[number];
  title: string;
  text: string;
  source: string;
  owner: string;
  review: string;
  goal: Goal | "";
  stage: Stage | "";
  channel: Channel | "";
  approved: boolean;
  proof: string;
};
export type Asset = Entry & {
  title: string;
  kind: (typeof assetKinds)[number];
  owner: string;
  rights: string;
  channels: Channel[];
  expires: string;
  url: string;
  file: FileRef | null;
  fileOwner: string;
  approved: boolean;
  proof: string;
};
export type Edition = Entry & {
  title: string;
  brief: string;
  channel: Channel;
  format: Format;
  goal: Goal;
  stage: Stage;
  owner: string;
  due: string;
  decision: string;
  radar: string;
  assets: Pointer[];
  guides: Pointer[];
  parent: string;
  basis: string;
  originPublication: string;
  plan: string;
};
export type Piece = Entry & { edition: number; status: EditorialStatus };
export type Feedback = Entry & {
  piece: string;
  edition: number;
  kind: "Comentário" | "Ajustes" | "Aprovação" | "Avaliação";
  note: string;
  proof: string;
};
export type Publication = Entry & {
  piece: string;
  edition: number;
  code: string;
  destination: "Site" | "WhatsApp";
  target: string;
  link: string;
  published: string;
  reference: string;
};
export type Result = Entry & {
  goal: Goal;
  externalId: string;
  code: string;
  date: string;
  source: string;
  value: number | null;
};
export type Reference = {
  id: string;
  title: string;
  stage?: Stage;
  context?: { evidence: string; step: string };
  kind: "PICO" | "Radar" | "Insight";
};
export type HubData = {
  brand: Brand;
  brands: Brand[];
  me: string;
  members: Member[];
  version: number;
  directives: Directive[];
  assets: Asset[];
  editions: Edition[];
  pieces: Piece[];
  feedback: Feedback[];
  publications: Publication[];
  results: Result[];
  references: Reference[];
};
export type ResultInput = Pick<
  Result,
  "goal" | "externalId" | "code" | "date" | "source" | "value"
>;

export function latest<T extends { id: string }>(rows: T[]): T[] {
  const seen = new Set<string>();
  return rows.filter((row) => {
    if (seen.has(row.id)) return false;
    seen.add(row.id);
    return true;
  });
}
export function memberName(data: HubData, id: string) {
  return data.members.find((m) => m.id === id)?.name || "Equipe EBA";
}
export function editionFor(data: HubData, p: Piece | Publication) {
  return data.editions.find(
    (e) => e.id === ("piece" in p ? p.piece : p.id) && e.version === p.edition,
  );
}
export const pointerKey = (p: Pointer) => p.id + "." + p.version;
export const downloadUrl = (brand: string, p: Pointer) =>
  "/api/conteudo/arquivo?" +
  new URLSearchParams({ marca: brand, ativo: p.id, versao: String(p.version) });
export const nameUrl = (brand: string, view: string, id?: string) =>
  "/conteudo?" +
  new URLSearchParams({ marca: brand, vista: view, ...(id ? { id } : {}) });
export const emptyTotal = () => ({
  count: { "Lead confirmado": 0, Agendamento: 0, Venda: 0 },
  revenue: 0,
});
export const resultKey = (r: ResultInput) => r.goal + "\n" + r.externalId;
export const normalizeCode = (code: string) => code.trim().toUpperCase();
export function matchesResult(data: HubData, r: ResultInput) {
  const p = latest(data.publications).find(
    (p) => p.code === normalizeCode(r.code),
  );
  if (!r.code) return { issue: "Código ausente" };
  if (!p) return { issue: "Código sem publicação nesta marca" };
  if (!p.published) return { issue: "Publicação ainda não confirmada" };
  if (r.date < p.published) return { issue: "Resultado anterior à publicação" };
  return { publication: p };
}
export function credited(
  data: HubData,
  publication: Publication,
  window = false,
) {
  if (!publication.published) return [];
  const through = offsetDay(publication.published, 29);
  return latest(data.results).filter(
    (r) =>
      matchesResult(data, r).publication?.id === publication.id &&
      (!window || r.date <= through),
  );
}
export function totals(results: Result[]) {
  const out = emptyTotal();
  for (const r of results) {
    out.count[r.goal]++;
    if (r.goal === "Venda") out.revenue += r.value ?? 0;
  }
  return out;
}
export function windowOpen(p: Publication, day = today()) {
  return !!p.published && day <= offsetDay(p.published, 29);
}
export function guideEligible(
  g: Directive,
  e: Pick<Edition, "goal" | "stage" | "channel">,
  day = today(),
) {
  return (
    (!g.review || g.review >= day) &&
    (!g.goal || g.goal === e.goal) &&
    (!g.stage || g.stage === e.stage) &&
    (!g.channel || g.channel === e.channel)
  );
}
export const activeAssets = (data: HubData) =>
  latest(data.assets.filter((a) => a.approved));
export const activeGuides = (data: HubData) =>
  latest(data.directives.filter((d) => d.approved));
export function assetEligible(a: Asset, channel: Channel, day = today()) {
  return a.channels.includes(channel) && (!a.expires || a.expires >= day);
}
export function assetIssue(
  data: HubData,
  p: Pointer,
  channel: Channel,
  day = today(),
) {
  const a = activeAssets(data).find((a) => a.id === p.id);
  if (!a || a.version !== p.version)
    return "Versão substituída ou sem aprovação";
  if (a.expires && a.expires < day) return "Direitos vencidos";
  return a.channels.includes(channel) ? "" : "Canal fora da licença";
}
export function suggestion(data: HubData, publication: Publication) {
  const e = editionFor(data, publication);
  if (!e || !publication.published) return null;
  const results = credited(data, publication, true),
    count = totals(results).count[e.goal];
  if (!count) return null;
  const format: Format =
    e.format === "Vídeo"
      ? "Carrossel"
      : e.format === "Carrossel"
        ? "Vídeo"
        : e.channel === "Site"
          ? "Carrossel"
          : "Roteiro";
  const channel: Channel = e.channel === "Site" ? "Instagram" : e.channel;
  const guides = activeGuides(data).filter((d) =>
    guideEligible(d, { ...e, channel }),
  );
  const eligible = activeAssets(data).filter((a) => assetEligible(a, channel));
  const pinned = eligible.filter((a) => e.assets.some((p) => a.id === p.id));
  return {
    publication,
    edition: e,
    count,
    format,
    channel,
    guides,
    assets: [...pinned, ...eligible.filter((a) => !pinned.includes(a))].slice(
      0,
      3,
    ),
  };
}
export function opportunities(data: HubData) {
  return latest(data.publications)
    .flatMap((p) => {
      const idea = suggestion(data, p);
      return idea ? [idea] : [];
    })
    .sort(
      (a, b) =>
        b.count - a.count ||
        b.publication.published.localeCompare(a.publication.published),
    );
}
export function generateLink(
  destination: Publication["destination"],
  target: string,
  message: string,
  channel: Channel,
  brand: string,
  code: string,
) {
  if (destination === "WhatsApp") {
    if (!/^[1-9]\d{9,14}$/.test(target))
      throw Error(
        "Informe o número do WhatsApp com DDI e DDD, só com números.",
      );
    const url = new URL("https://wa.me/" + target);
    url.searchParams.set(
      "text",
      (message.trim() || "Olá! Quero saber mais.") + " [Ref: " + code + "]",
    );
    return url.toString();
  }
  const url = new URL(target);
  if (url.protocol !== "https:" || url.username || url.password)
    throw Error("Informe uma URL HTTPS sem credenciais.");
  url.searchParams.set("utm_source", channel.toLowerCase());
  url.searchParams.set("utm_medium", "content");
  url.searchParams.set(
    "utm_campaign",
    "eba-" + brand.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
  );
  url.searchParams.set("utm_content", code);
  url.searchParams.set("eba_ref", code);
  return url.toString();
}
