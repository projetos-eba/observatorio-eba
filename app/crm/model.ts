export const stages = [
  "Entrada",
  "Qualificação",
  "Diagnóstico",
  "Proposta",
  "Negociação",
] as const;
export type DealStage = (typeof stages)[number];
export const kinds = [
  "WhatsApp",
  "Ligação",
  "Reunião",
  "E-mail",
  "Nota",
] as const;
export type Person = { id: string; name: string; email: string; phone: string };
export type Deal = {
  id: string;
  company: string | null;
  contact: string | null;
  owner: string;
  stage: string;
  status: string;
  source: string;
  service: string;
  proposalUrl?: string | null;
  stageSince?: string | null;
  goal: string;
  monthly: number | null;
  once: number | null;
  next: string;
  due: string;
  reason: string;
  revision: number;
  updated: string;
};
export type Activity = {
  id: string;
  deal: string;
  revision: number;
  author: string;
  kind: string;
  note: string;
  at: string;
  scheduledFor?: string | null;
};
export const reactivationTypes = { retornos: "Retornos", conversas: "Conversas", propostas: "Propostas", contratos: "Contratos" } as const;
export type ReactivationType = keyof typeof reactivationTypes;
export type Reactivation = {
  totals: Record<ReactivationType, number>;
  entries: (Activity & { companyName: string })[];
  next: boolean;
};
export type State = {
  me: string;
  members: { id: string; name: string }[];
  companies: { id: string; name: string }[];
  contacts: Person[];
  deals: Deal[];
  people: { deal: string; contact: string }[];
  activities: Activity[];
  accounts: { company: string; since: string }[];
  handoffs: {
    deal: string;
    company: string;
    lead: string;
    scope: string;
    terms: string;
    first: string;
    date: string;
  }[];
};
export const businessDay = (at: number | Date) =>
  new Intl.DateTimeFormat("sv-SE", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(at);
export const today = () => businessDay(new Date());
export function stageDays(at: string | null | undefined, day: string) {
  if (!at) return null;
  const start = businessDay(new Date(at));
  return Math.max(0, (Date.parse(day) - Date.parse(start)) / 86_400_000);
}
export const dateLabel = (s: string) =>
  s
    ? new Date(s.slice(0, 10) + "T12:00:00Z").toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      })
    : "Sem data";
export const money = (n: number | null) =>
  n === null
    ? "A definir"
    : new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
      }).format(n / 100);
export const normalize = (s: string) =>
  s
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ");

export function offsetDay(day: string, count: number) {
  const date = new Date(day + "T12:00:00Z");
  date.setUTCDate(date.getUTCDate() + count);
  return date.toISOString().slice(0, 10);
}
export function relativeDue(date: string, day: string) {
  if (!date) return "Sem data combinada";
  const delta =
    (Date.parse(date + "T12:00:00Z") - Date.parse(day + "T12:00:00Z")) /
    86400000;
  if (delta === 0) return "Retorno hoje";
  if (delta === 1) return "Amanhã";
  if (delta < 0)
    return "Vencido há " + -delta + (delta === -1 ? " dia" : " dias");
  return dateLabel(date);
}
