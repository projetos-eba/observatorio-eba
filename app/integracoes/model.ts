export const providers = ["instagram", "meta_ads", "whatsapp"] as const;
export type Provider = (typeof providers)[number];
export const brand = "eba";
export const graphVersion = "v27.0";
export type Resource = {
  id: string;
  name: string;
  parent?: string;
  phone?: string;
  currency?: string;
  timezone?: string;
};
export type Post = {
  id: string;
  day: string;
  caption: string;
  format: string;
  url: string;
  likes: number | null;
  comments: number | null;
};
export type Campaign = {
  id: string;
  day: string;
  name: string;
  spend: number;
  impressions: number;
  clicks: number;
};
export type Reading = Post | Campaign;
export type Dataset = { rows: Reading[]; from: string; through: string };
export type Connection = {
  provider: Provider;
  id: string;
  status: string;
  error: string;
  verifiedAt: string;
  retryAt: string;
  busy: boolean;
};
export type Source = Resource & {
  provider: Provider;
  syncedAt: string;
  from: string;
  through: string;
};
export type Job = {
  id: string;
  provider: Provider;
  resource: string;
  started: string;
  finished: string;
  trigger: string;
  status: string;
  detail: string;
};
export type Publication = {
  id: string;
  title: string;
  channel: string;
  code: string;
  destination: string;
  target: string;
  link: string;
  published: string;
};
export type PostLink = { resource: string; media: string; publication: string };
export type State = {
  connected: Connection[];
  sources: Source[];
  jobs: Job[];
  publications: Publication[];
  links: PostLink[];
  selected: Source | null;
  posts: Post[];
  campaigns: Campaign[];
  total: number;
};
export const labels: Record<Provider, string> = {
  instagram: "Instagram",
  meta_ads: "Meta Ads",
  whatsapp: "WhatsApp Business",
};
export const fmtDate = (value: string) =>
  value
    ? new Intl.DateTimeFormat("pt-BR", {
        timeZone: "America/Sao_Paulo",
        dateStyle: "short",
        timeStyle: "short",
      }).format(new Date(value))
    : "—";
export const num = (value: number | null) =>
  value === null ? "—" : value.toLocaleString("pt-BR");
export const cost = (value: number, currency: string) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: currency || "BRL",
  }).format(value);
export const hubUrl = (id: string) =>
  "/conteudo?marca=eba&vista=resultados&id=" + encodeURIComponent(id);
