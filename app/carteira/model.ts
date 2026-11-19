import { dateLabel, offsetDay, today } from "../crm/model";
export { dateLabel, offsetDay, today };

export const pico = [
  "Posicionar",
  "Impulsionar",
  "Converter",
  "Otimizar",
] as const;
export const actions = ["Testar", "Aplicar", "Monitorar", "Arquivar"] as const;
export const outcomes = ["Encerrar", "Ajustar", "Reagendar"] as const;
export const templates = {
  saude: {
    name: "Clínicas e saúde",
    steps: [
      "Contatos",
      "Contatos qualificados",
      "Agendamentos",
      "Consultas realizadas",
    ],
  },
  advocacia: {
    name: "Advocacia",
    steps: [
      "Contatos",
      "Demandas qualificadas",
      "Consultas marcadas",
      "Consultas realizadas",
    ],
  },
  revendas: {
    name: "Revendas de veículos",
    steps: [
      "Contatos",
      "Leads qualificados",
      "Visitas agendadas",
      "Visitas realizadas",
    ],
  },
  outros: {
    name: "Outros nichos",
    steps: [
      "Contatos",
      "Contatos qualificados",
      "Agendamentos",
      "Atendimentos realizados",
    ],
  },
};
export const niches = ["saude", "advocacia", "revendas", "outros"] as const;
export type Niche = (typeof niches)[number];
export type Stage = (typeof pico)[number];
export type Counts = [
  number | null,
  number | null,
  number | null,
  number | null,
];
export type Member = { id: string; name: string };
export type Contract = {
  id: string;
  scope: string;
  terms: string;
  goal: string;
  first: string;
  date: string;
  lead: string;
};
export type Account = {
  company: string;
  name: string;
  since: string;
  contracts: Contract[];
};
export type Profile = {
  company: string;
  owner: string;
  niche: Niche;
  metric: number;
  target: number;
  stage: Stage;
  diagnosis: Record<Stage, string>;
  radarIds: string[];
};
export type Measurement = {
  company: string;
  week: string;
  counts: Counts;
  source: string;
  author: string;
  at: string;
  version: number;
};
export type Review = { outcome: (typeof outcomes)[number]; note: string };
export type Decision = {
  id: string;
  company: string;
  stage: Stage;
  action: (typeof actions)[number];
  reason: string;
  evidence: string;
  step: string;
  owner: string;
  due: string;
  radarId: string;
  status: "Aberta" | "Encerrada";
  author: string;
  at: string;
  meeting: string;
  review?: Review;
  version: number;
};
export type Signal = {
  id: string;
  title: string;
  source: string;
  url: string;
  date: string;
  stage: Stage;
  niches: string[];
  impact: string;
  summary: string;
};
export type MinutesItem = {
  company: string;
  name: string;
  stage: Stage;
  reasons: string[];
  observation: string;
  disposition: "Discutido" | "Adiado";
  decisions: Decision[];
  measurement?: Measurement;
  prior?: Measurement;
  profile?: Profile;
};
export type Minutes = {
  week: string;
  at: string;
  author: string;
  participants: string[];
  items: MinutesItem[];
};
export type Portfolio = {
  canClose: boolean;
  version: number;
  me: string;
  members: Member[];
  accounts: Account[];
  profiles: Profile[];
  measurements: Measurement[];
  decisions: Decision[];
  manual: { week: string; company: string }[];
  minutes: Minutes[];
  signals: Signal[];
};

export function monday(date: string) {
  const weekday = new Date(date + "T12:00:00Z").getUTCDay();
  return offsetDay(date, -((weekday + 6) % 7));
}
const periodFormat = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});
export const weekLabel = (date: string) =>
  periodFormat.formatRange(
    new Date(date + "T12:00:00Z"),
    new Date(offsetDay(date, 6) + "T12:00:00Z"),
  );
export function newest<T>(rows: T[], key: (row: T) => string) {
  const seen = new Set<string>();
  return rows.filter((row) => {
    const id = key(row);
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}
const ratios = [
  [0, 1],
  [1, 2],
  [2, 3],
  [0, 3],
];
export function reading(measure: Measurement | undefined, metric: number) {
  const [from, to] = ratios[metric];
  const base = measure?.counts[from] ?? null,
    value = measure?.counts[to] ?? null;
  return {
    base,
    value,
    rate: base && value !== null ? (100 * value) / base : null,
  };
}
export const metricLabel = (niche: Niche, metric: number) =>
  ratios[metric].map((i) => templates[niche].steps[i]).join(" → ");
export const displayRate = (n: number) =>
  n.toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + "%";
export function rateText(r: ReturnType<typeof reading>) {
  if (r.base === null || r.value === null) return "Sem dado";
  return r.rate === null ? "Sem base para calcular" : displayRate(r.rate);
}
export function profileFor(data: Portfolio, company: string) {
  return data.profiles.find((p) => p.company === company);
}
export function measureFor(data: Portfolio, company: string, week: string) {
  return data.measurements.find(
    (m) => m.company === company && m.week === week,
  );
}
export function forAccount(data: Portfolio, company: string) {
  return newest(
    data.decisions.filter((d) => d.company === company),
    (d) => d.id,
  );
}
export function suggestions(data: Portfolio, profile: Profile) {
  const score: Record<string, number> = { Alto: 3, Médio: 2, Baixo: 1 };
  return data.signals
    .filter(
      (s) =>
        s.stage === profile.stage &&
        s.niches.includes(templates[profile.niche].name),
    )
    .sort(
      (a, b) =>
        (score[b.impact] || 0) - (score[a.impact] || 0) ||
        b.date.localeCompare(a.date),
    );
}
export function agenda(data: Portfolio, week: string, day: string) {
  const lastWeek = offsetDay(week, -7);
  const latestMinutes = data.minutes.find((m) => m.week < week);
  const result = data.accounts.map((account) => {
    const { company, name } = account;
    const profile = profileFor(data, company);
    const measurement = measureFor(data, company, lastWeek),
      prior = measureFor(data, company, offsetDay(lastWeek, -7));
    const decisions = forAccount(data, company);
    const open = decisions.filter((d) => d.status === "Aberta");
    const overdue = open.filter((d) => d.due < day),
      due = open.filter((d) => d.due >= day && d.due <= offsetDay(week, 6));
    const indicated = profile ? reading(measurement, profile.metric) : null;
    const flags = [
      overdue.length > 0 ? "Revisão vencida" : "",
      due.length > 0 ? "Revisão nesta semana" : "",
      indicated?.rate != null && profile && indicated.rate < profile.target
        ? "Indicador abaixo da meta"
        : "",
      !profile
        ? "Configuração pendente"
        : !measurement || measurement.counts.some((v) => v === null)
          ? "Medição pendente"
          : indicated?.rate === null
            ? "Sem base para calcular"
            : "",
      latestMinutes?.items.some(
        (i) => i.company === company && i.disposition === "Adiado",
      )
        ? "Adiado na última reunião"
        : "",
      data.manual.some((m) => m.week === week && m.company === company)
        ? "Incluído na pauta"
        : "",
      decisions.some((d) => d.meeting === week) ? "Decisão registrada" : "",
    ];
    const observation =
      profile && indicated
        ? metricLabel(profile.niche, profile.metric) +
          " · " +
          rateText(indicated) +
          " · Meta " +
          displayRate(profile.target)
        : "Defina o indicador principal e a meta da conta.";
    return {
      company,
      name,
      owner: profile?.owner || account.contracts[0]?.lead || "",
      stage: profile?.stage || ("Posicionar" as Stage),
      reasons: flags.filter(Boolean),
      priority: flags.findIndex(Boolean),
      observation,
      open,
      decisions,
      profile,
      measurement,
      prior,
    };
  });
  return result
    .filter((r) => r.priority >= 0)
    .sort(
      (a, b) =>
        a.priority - b.priority || a.name.localeCompare(b.name, "pt-BR"),
    );
}
