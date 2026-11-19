import { z } from "zod";
import { accountScope, canAccessBrand, getCrmMember, type WorkspaceSession } from "../../crm/session";
import { fingerprint } from "../../conteudo/server";
import { radarSeed } from "../../../lib/radar-seed";
import {
  actions,
  agenda,
  monday,
  niches,
  outcomes,
  pico,
  profileFor,
  suggestions,
  today,
  type Account,
  type Contract,
  type Portfolio,
  type Signal,
  type Minutes,
  type Decision,
} from "../../carteira/model";
import { measureIssue, validDate } from "../../carteira/csv";

export const dynamic = "force-dynamic";
const reply = (data: unknown, status = 200) =>
  Response.json(data, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
const fail = (error: string, status = 400) => reply({ error }, status);
const id = z.string().trim().min(1).max(240),
  short = z.string().trim().max(240);
const note = z.string().trim().min(1).max(3000),
  optionalNote = z.string().trim().max(3000);
const date = z.string().refine(validDate);
const dateOrEmpty = z.union([date, z.literal("")]);
const stage = z.enum(pico);
const count = z.number().int().min(0).max(1e9).nullable();
const measure = z.object({
  company: id,
  week: date,
  counts: z.tuple([count, count, count, count]),
  source: id,
});
const changes = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("profile"),
    company: id,
    owner: id,
    niche: z.enum(niches),
    metric: z.number().int().min(0).max(3),
    target: z.number().min(0).max(100),
    stage,
    diagnosis: z.object({
      Posicionar: optionalNote,
      Impulsionar: optionalNote,
      Converter: optionalNote,
      Otimizar: optionalNote,
    }),
  }),
  z.object({
    kind: z.literal("measure"),
    rows: z.array(measure).min(1).max(50),
  }),
  z.object({
    kind: z.literal("decision"),
    company: id,
    stage,
    action: z.enum(actions),
    reason: note,
    evidence: note,
    step: optionalNote,
    owner: short,
    due: dateOrEmpty,
    radarId: short,
  }),
  z.object({
    kind: z.literal("review"),
    id: z.string().uuid(),
    outcome: z.enum(outcomes),
    note,
    step: optionalNote,
    owner: short,
    due: dateOrEmpty,
  }),
  z.object({
    kind: z.literal("link"),
    company: id,
    signal: id,
    linked: z.boolean(),
  }),
  z.object({ kind: z.literal("include"), company: id, week: date }),
  z.object({
    kind: z.literal("close"),
    week: date,
    participants: z.array(id).min(1).max(50),
    items: z
      .array(
        z.object({ company: id, disposition: z.enum(["Discutido", "Adiado"]) }),
      )
      .min(1)
      .max(500),
  }),
]);
const request = z.object({
  id: z.string().uuid(),
  version: z.number().int().nonnegative(),
  change: changes,
});

function radarSignals(entries: { id: string; data: string }[]): Signal[] {
  const rows = new Map<string, Record<string, unknown>>(
    radarSeed.records.map((row) => [row.id, row]),
  );
  for (const entry of entries) rows.set(entry.id, JSON.parse(entry.data));
  return Array.from(rows).flatMap(([id, row]) => {
    const stage =
      typeof row.stage === "string"
        ? pico.find((stage) => stage === row.stage)
        : undefined;
    if (row.status !== "Analisado" || !stage || typeof row.title !== "string")
      return [];
    const field = (key: string) =>
      typeof row[key] === "string" ? String(row[key]) : "";
    const url = field("url");
    return [
      {
        id,
        title: row.title,
        stage,
        niches: Array.isArray(row.niches)
          ? row.niches.filter((n): n is string => typeof n === "string")
          : [],
        source: field("source"),
        url: /^https?:\/\//i.test(url) ? url : "",
        date: field("sourceDate") || field("date"),
        impact: field("impact"),
        summary: field("why") || field("summary"),
      },
    ];
  });
}
async function portfolio(session: WorkspaceSession): Promise<Portfolio> {
  const { db, id: me } = session;
  const hasRadar = await canAccessBrand(session, "eba");
  function scoped(sql: string, field: string, order = "") {
    const scope = accountScope(session, field);
    return db.prepare(sql + " WHERE " + scope.sql + order).bind(...scope.args);
  }
  const minuteScope = accountScope(session, "json_extract(item.value,'$.company')");
  const [
    revision,
    accounts,
    contracts,
    members,
    profiles,
    measurements,
    decisions,
    manual,
    minutes,
    signals,
  ] = await db.batch<Record<string, unknown>>([
    db.prepare(
      "SELECT COALESCE(MAX(version),0) AS version FROM carteira_commands",
    ),
    scoped("SELECT a.company,a.since,c.name FROM crm_accounts a JOIN crm_companies c ON a.company=c.id", "a.company", " ORDER BY c.name"),
    scoped("SELECT h.company,h.deal AS id,h.scope,h.terms,d.goal,h.first,h.date,h.lead FROM crm_handoffs h JOIN crm_deals d ON d.id=h.deal", "h.company", " ORDER BY d.updated DESC,h.deal"),
    db.prepare("SELECT id,name FROM crm_members ORDER BY name"),
    scoped("SELECT data FROM carteira_profiles", "carteira_profiles.company"),
    scoped("SELECT m.company,m.week,m.version,m.data FROM carteira_measures m JOIN " +
      "(SELECT company,week,MAX(version) AS version FROM carteira_measures GROUP BY company,week) v USING(company,week,version)",
      "m.company", " ORDER BY m.version DESC"),
    scoped("SELECT d.id,d.company,d.version,d.data FROM carteira_decisions d JOIN " +
      "(SELECT id,MAX(version) AS version FROM carteira_decisions GROUP BY id) v USING(id,version)",
      "d.company", " ORDER BY d.version DESC"),
    scoped("SELECT company,week FROM carteira_agenda", "carteira_agenda.company"),
    session.admin ? db.prepare("SELECT week,data FROM carteira_minutes ORDER BY week DESC") :
      db.prepare(`SELECT week,json_set(data,'$.items',json((SELECT json_group_array(json(item.value))
        FROM json_each(data,'$.items') item WHERE ${minuteScope.sql})), '$.participants',json('[]')) data
        FROM carteira_minutes ORDER BY week DESC`).bind(...minuteScope.args),
    db.prepare("SELECT id,data FROM store_entries WHERE ? AND collection='records'").bind(Number(hasRadar)),
  ]);
  const contractMap = new Map<string, Contract[]>();
  for (const { company, ...contract } of contracts.results as (Contract & {
    company: string;
  })[]) {
    const linked = contractMap.get(company) || [];
    linked.push(contract);
    contractMap.set(company, linked);
  }
  const unpack = <T>(rows: Record<string, unknown>[]) =>
    rows.map(
      ({ data, ...keys }) => ({ ...JSON.parse(String(data)), ...keys }) as T,
    );
  return {
    canClose: session.admin,
    version: Number(revision.results[0].version),
    me,
    accounts: (accounts.results as Omit<Account, "contracts">[]).map((a) => ({
      ...a,
      contracts: contractMap.get(a.company) || [],
    })),
    members: members.results as Portfolio["members"],
    profiles: unpack(profiles.results),
    measurements: unpack(measurements.results),
    decisions: unpack(decisions.results),
    manual: manual.results as Portfolio["manual"],
    minutes: unpack(minutes.results),
    signals: hasRadar ? radarSignals(signals.results as { id: string; data: string }[]) : [],
  };
}
export async function GET(request: Request) {
  try {
    const session = await getCrmMember();
    if (!session)
      return fail("Entre com sua conta para acessar a Carteira.", 401);
    const query = new URL(request.url).searchParams;
    if (query.has("historico")) {
      const kind = query.get("historico"), filter = id.safeParse(query.get("filtro"));
      const page = Number(query.get("pagina") || 1);
      if (!["decisao", "medicao"].includes(kind || "") || !filter.success || !Number.isInteger(page) || page < 1 || page > 1000)
        return fail("Filtro de histórico inválido.");
      const decisions = kind === "decisao";
      const scope = accountScope(session, "h.company");
      const sql = decisions
        ? "SELECT h.data,h.version FROM carteira_decisions h WHERE h.id=?"
        : "SELECT h.data,h.week,h.version FROM carteira_measures h WHERE h.company=? AND EXISTS(" +
          "SELECT 1 FROM carteira_measures n WHERE n.company=h.company AND n.week=h.week AND n.version>h.version)";
      const { results } = await session.db.prepare(sql + " AND " + scope.sql + " ORDER BY version DESC LIMIT 16 OFFSET ?")
        .bind(filter.data, ...scope.args, (page - 1) * 15).all<{ data: string; version: number; week?: string }>();
      return reply({ entries: results.slice(0, 15).map(({ data, ...metadata }) =>
        ({ ...JSON.parse(data), ...metadata })), next: results.length > 15 });
    }
    return reply(await portfolio(session));
  } catch {
    return fail("Não foi possível carregar a Carteira.", 503);
  }
}

export async function POST(req: Request) {
  if (req.headers.get("origin") !== new URL(req.url).origin)
    return fail("Origem inválida.", 403);
  if (
    req.headers.get("content-type")?.split(";")[0].trim() !== "application/json"
  )
    return fail("Formato inválido.", 415);
  const raw = await req.text();
  if (raw.length > 100_000)
    return fail("O pedido excede o tamanho permitido.", 413);
  let input: unknown;
  try {
    input = JSON.parse(raw);
  } catch {
    return fail("Pedido inválido.");
  }
  const parsed = request.safeParse(input);
  if (!parsed.success)
    return fail("Confira os campos do formulário, incluindo datas e valores.");
  const { id, version, change } = parsed.data;
  try {
    const session = await getCrmMember();
    if (!session)
      return fail("Entre com sua conta para acessar a Carteira.", 401);
    const { db, id: author } = session;
    const hash = await fingerprint(JSON.stringify(parsed.data));
    const receipt = async () => {
      const found = await db
        .prepare(
          "SELECT version,author,fingerprint FROM carteira_commands WHERE id=?",
        )
        .bind(id)
        .first<{ version: number; author: string; fingerprint: string }>();
      return found
        ? found.author === author && found.fingerprint === hash
          ? reply({ version: found.version })
          : fail("O identificador já foi usado por outro pedido.", 409)
        : null;
    };
    const previous = await receipt();
    if (previous) return previous;
    const data = await portfolio(session);
    if (data.version !== version)
      return (
        (await receipt()) ||
        fail(
          "A Carteira mudou em outra sessão. Atualize e confira os novos dados.",
          409,
        )
      );
    const seq = version + 1,
      day = today(),
      week = monday(day),
      at = new Date().toISOString(),
      statements: D1PreparedStatement[] = [];
    const member = (id: string) => data.members.find((m) => m.id === id);
    const account = (company: string) =>
      data.accounts.some((a) => a.company === company);
    const currentProfile =
      "company" in change ? profileFor(data, change.company) : undefined;
    const push = (sql: string, ...params: (string | number)[]) => {
      statements.push(db.prepare(sql).bind(...params));
    };
    const saveProfile = (
      company: string,
      profile: Portfolio["profiles"][number],
    ) =>
      push(
        "INSERT INTO carteira_profiles(company,data) VALUES(?,?) ON CONFLICT(company) DO UPDATE SET data=excluded.data",
        company,
        JSON.stringify(profile),
      );
    const saveDecision = (decision: Decision) =>
      push(
        "INSERT INTO carteira_decisions(id,company,version,data) VALUES(?,?,?,?)",
        decision.id,
        decision.company,
        seq,
        JSON.stringify(decision),
      );
    const meeting = data.minutes.some((m) => m.week === week) ? "" : week;

    if ("company" in change && !account(change.company))
      return fail("A conta ainda não está na carteira de vendas ganhas.");
    switch (change.kind) {
      case "profile": {
        const { kind, ...fields } = change;
        if (!member(fields.owner)) return fail("Escolha uma pessoa da equipe.");
        if (
          currentProfile?.niche !== fields.niche &&
          data.measurements.some((m) => m.company === fields.company)
        )
          return fail(
            "O modelo de funil já está em uso nas medições desta conta.",
          );
        saveProfile(fields.company, {
          ...fields,
          radarIds: currentProfile?.radarIds || [],
        });
        break;
      }
      case "measure": {
        const seen = new Set<string>();
        for (const row of change.rows) {
          const issue = measureIssue(row, data);
          if (issue) return fail(issue);
          const key = row.company + "\n" + row.week;
          if (seen.has(key))
            return fail("Há medições duplicadas para a mesma conta e semana.");
          seen.add(key);
        }
        for (const { company, week, counts, source } of change.rows)
          push(
            "INSERT INTO carteira_measures(company,week,version,data) VALUES(?,?,?,?)",
            company,
            week,
            seq,
            JSON.stringify({ counts, source, author, at }),
          );
        break;
      }
      case "decision": {
        const { kind, ...fields } = change,
          closed = fields.action === "Arquivar";
        if (!currentProfile)
          return fail("Configure a conta antes de registrar uma decisão.");
        if (!closed && (!member(fields.owner) || !fields.step || !fields.due))
          return fail("Informe próximo passo, responsável e data de revisão.");
        if (
          fields.radarId &&
          !data.signals.some((s) => s.id === fields.radarId)
        )
          return fail("Escolha uma análise concluída do Radar.");
        saveDecision({
          ...fields,
          id,
          author,
          at,
          version: seq,
          meeting,
          status: closed ? "Encerrada" : "Aberta",
          ...(closed ? { step: "", owner: "", due: "" } : {}),
        });
        break;
      }
      case "review": {
        const prior = data.decisions.find((d) => d.id === change.id);
        if (!prior || prior.status !== "Aberta")
          return fail("Esta decisão já foi encerrada.", 409);
        const closed = change.outcome === "Encerrar";
        if (!closed && (!member(change.owner) || !change.step || !change.due))
          return fail("Informe o próximo passo e a nova revisão.");
        saveDecision({
          ...prior,
          ...(!closed
            ? { step: change.step, owner: change.owner, due: change.due }
            : {}),
          version: seq,
          author,
          at,
          meeting,
          status: closed ? "Encerrada" : "Aberta",
          review: { outcome: change.outcome, note: change.note },
        });
        break;
      }
      case "link": {
        if (!currentProfile)
          return fail("Configure a conta antes de relacionar uma análise.");
        if (
          change.linked &&
          !suggestions(data, currentProfile).some((s) => s.id === change.signal)
        )
          return fail("A análise não corresponde mais a esta conta.");
        const radarIds = currentProfile.radarIds.filter(
          (x) => x !== change.signal,
        );
        if (change.linked) radarIds.push(change.signal);
        saveProfile(change.company, { ...currentProfile, radarIds });
        break;
      }
      case "include":
        if (change.week !== meeting)
          return fail("A pauta desta semana já está fechada ou mudou.", 409);
        push(
          "INSERT OR IGNORE INTO carteira_agenda(week,company) VALUES(?,?)",
          week,
          change.company,
        );
        break;
      case "close": {
        if (!session.admin) return fail("O fechamento da pauta exige um administrador.", 403);
        if (change.week !== meeting)
          return fail("A pauta desta semana já está fechada ou mudou.", 409);
        const live = agenda(data, week, day);
        const choices = new Map(
          change.items.map((item) => [item.company, item.disposition]),
        );
        if (
          !live.length ||
          choices.size !== change.items.length ||
          live.length !== choices.size ||
          live.some((i) => !choices.has(i.company))
        )
          return fail(
            "A pauta mudou. Confira todos os itens antes de fechar.",
            409,
          );
        const participants = Array.from(new Set(change.participants)).map(
          member,
        );
        if (participants.some((p) => !p))
          return fail("Escolha participantes da equipe.");
        if (
          live.some(
            (i) =>
              choices.get(i.company) === "Discutido" &&
              !i.decisions.some((d) => d.meeting === week),
          )
        )
          return fail(
            "Registre uma decisão ou revisão nesta semana para cada conta discutida.",
          );
        const minutes: Minutes = {
          week,
          at,
          author: member(author)?.name || author,
          participants: participants.map((p) => p!.name),
          items: live.map(
            ({
              company,
              name,
              stage,
              reasons,
              observation,
              decisions,
              measurement,
              prior,
              profile,
            }) => ({
              company,
              name,
              stage,
              reasons,
              observation,
              disposition: choices.get(company)!,
              decisions: decisions.filter(
                (d) => d.meeting === week || d.status === "Aberta",
              ),
              measurement,
              prior,
              profile,
            }),
          ),
        };
        push(
          "INSERT INTO carteira_minutes(week,data) VALUES(?,?)",
          week,
          JSON.stringify(minutes),
        );
        break;
      }
    }
    try {
      await db.batch([
        db
          .prepare(
            "INSERT INTO carteira_commands(version,id,author,fingerprint) VALUES(?,?,?,?)",
          )
          .bind(seq, id, author, hash),
        ...statements,
      ]);
    } catch (error) {
      const replay = await receipt();
      if (replay) return replay;
      if (/unique|constraint/i.test(String(error)))
        return fail(
          "A Carteira mudou em outra sessão. Atualize e confira os novos dados.",
          409,
        );
      throw error;
    }
    return reply({ version: seq });
  } catch {
    return fail("Não foi possível salvar a alteração. Tente novamente.", 503);
  }
}
