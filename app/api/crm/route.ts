import { z } from "zod";
import { accountScope, canAccessAccount, dealScope, getCrmMember, type WorkspaceSession } from "../../crm/session";
import { monday } from "../../carteira/model";
import { fingerprint } from "../../conteudo/server";
import {
  stages,
  kinds,
  normalize,
  offsetDay,
  reactivationTypes,
  type ReactivationType,
  type Deal,
  type Person,
} from "../../crm/model";
import { matchingPhones, normalizePhone } from "../../crm/phone";
export const dynamic = "force-dynamic";
const reply = (data: unknown, status = 200) =>
  Response.json(data, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
const short = z.string().trim().max(240),
  long = z.string().trim().max(4000);
const date = z.union([
  z.literal(""),
  z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .refine((s) => {
      const t = Date.parse(s + "T12:00:00Z");
      return Number.isFinite(t) && new Date(t).toISOString().slice(0, 10) === s;
    }),
]);
const cents = z.number().int().min(0).max(999999999999).nullable();
const values = z
  .object({
    company: short,
    name: short,
    email: z.union([z.literal(""), z.string().email().max(254)]),
    phone: short,
    contact: short,
    source: short,
    service: short,
    proposalUrl: z.union([z.literal(""), z.string().trim().max(2048).url().refine((value) => value.startsWith("https://"))]),
    goal: long,
    monthly: cents,
    once: cents,
    owner: short,
    stage: z.enum(stages),
    next: long,
    due: date,
    kind: z.enum(kinds),
    note: long,
    reason: long,
    scope: long,
    terms: long,
    lead: short,
    first: long,
    date: date,
  })
  .partial()
  .strict();
const input = z
  .object({
    action: z.enum(["create", "edit", "return", "schedule", "contact", "won", "lost"]),
    deal: z.string().uuid(),
    requestId: z.string().uuid(),
    revision: z.number().int().nonnegative(),
    values,
  })
  .strict();
function contactScope(session: WorkspaceSession, contact: string) {
  if (session.admin) return { sql: "1=1", args: [] };
  const visible = dealScope(session, "d");
  return {
    sql: `EXISTS(SELECT 1 FROM crm_deals d WHERE ${visible.sql} AND
      (d.contact=${contact} OR EXISTS(SELECT 1 FROM crm_people p WHERE p.deal=d.id AND p.contact=${contact})))`,
    args: visible.args,
  };
}

function contactEditScope(session: WorkspaceSession, contact: string) {
  if (session.admin) return contactScope(session, contact);
  const allowed = contactScope(session, contact);
  const visible = dealScope(session, "d");
  return {
    sql: `${allowed.sql} AND NOT EXISTS(SELECT 1 FROM crm_deals d WHERE NOT ${visible.sql} AND
      (d.contact=${contact} OR EXISTS(SELECT 1 FROM crm_people p WHERE p.deal=d.id AND p.contact=${contact})))`,
    args: [...allowed.args, ...visible.args],
  };
}

const matchedStage = (stage: string) =>
  `(a.enteredStage=${stage} OR (a.enteredStage IS NULL AND a.kind='Atualização'
    AND (a.note=${stage} OR instr(a.note,${stage} || ' · ')=1)))`;

const reactivationRules: Record<ReactivationType, string> = {
  retornos: "a.scheduledFor IS NOT NULL",
  conversas: "a.kind IN ('WhatsApp','Ligação','Reunião','E-mail')",
  propostas: matchedStage("'Proposta'"),
  contratos: "a.kind='Venda ganha'",
};

async function reactivation(ctx: WorkspaceSession, query: URLSearchParams) {
  const week = date.safeParse(query.get("reativacao"));
  const page = Number(query.get("pagina") || 1);
  const category = query.get("categoria") || "";
  if (!week.success || !week.data || monday(week.data) !== week.data ||
      !Number.isSafeInteger(page) || page < 1 || page > 10000 ||
      (category && !Object.hasOwn(reactivationTypes, category)))
    return reply({ error: "Filtro de reativação inválido." }, 400);

  const visible = dealScope(ctx, "d");
  const where = `FROM crm_activities a JOIN crm_deals d ON d.id=a.deal
    LEFT JOIN crm_companies c ON c.id=d.company LEFT JOIN crm_contacts p ON p.id=d.contact
    WHERE lower(trim(d.source))='ex-cliente' AND ${visible.sql} AND a.at>=? AND a.at<?`;
  const args = [...visible.args, week.data + "T03:00:00", offsetDay(week.data, 7) + "T03:00:00"];
  const columns = Object.entries(reactivationRules)
    .map(([key, rule]) => `COUNT(CASE WHEN ${rule} THEN 1 END) AS ${key}`).join(",");
  const counts = ctx.db.prepare("SELECT " + columns + " " + where).bind(...args);
  if (!category) return reply({ totals: await counts.first(), entries: [], next: false });
  const records = ctx.db.prepare(`SELECT a.id,a.deal,a.revision,a.author,a.kind,a.note,a.at,a.scheduledFor,
    COALESCE(c.name,p.name,'Oportunidade') companyName ${where}
    AND ${reactivationRules[category as ReactivationType]} ORDER BY a.at DESC,a.id DESC LIMIT 26 OFFSET ?`)
    .bind(...args, (page - 1) * 25);
  const [totals, entries] = await ctx.db.batch([counts, records]);
  return reply({ totals: totals.results[0], entries: entries.results.slice(0, 25), next: entries.results.length > 25 });
}

export async function GET(request: Request) {
  try {
    const ctx = await getCrmMember();
    if (!ctx)
      return reply({ error: "Entre com sua conta para acessar o CRM." }, 401);
    const { db } = ctx;
    const visible = dealScope(ctx, "d");
    const query = new URL(request.url).searchParams;
    if (query.has("reativacao")) return await reactivation(ctx, query);
    if (query.has("historico")) {
      const deal = z.string().uuid().safeParse(query.get("historico"));
      const before = Number(query.get("antes") || Number.MAX_SAFE_INTEGER);
      const kind = (query.get("tipo") || "").trim();
      const event = query.has("evento") ? z.string().uuid().safeParse(query.get("evento")) : null;
      if (!deal.success || !Number.isSafeInteger(before) || before < 1 || kind.length > 80 || event?.success === false)
        return reply({ error: "Filtro de histórico inválido." }, 400);
      const allowed = await db.prepare("SELECT 1 FROM crm_deals d WHERE d.id=? AND " + visible.sql)
        .bind(deal.data, ...visible.args).first();
      if (!allowed) return reply({ error: "Oportunidade indisponível." }, 404);
      const { results } = await db.prepare(
        "SELECT id,deal,revision,author,kind,note,at,scheduledFor FROM crm_activities WHERE deal=? AND revision<?" +
        (kind ? " AND kind=?" : "") + (event ? " AND id=?" : "") + " ORDER BY revision DESC LIMIT 26",
      ).bind(deal.data, before, ...(kind ? [kind] : []), ...(event?.success ? [event.data] : [])).all<{ revision: number }>();
      const entries = results.slice(0, 25);
      return reply({ entries, next: results.length > 25 ? entries.at(-1)?.revision : null });
    }
    const company = accountScope(ctx, "c.id");
    const account = accountScope(ctx, "a.company");
    const contact = contactScope(ctx, "c.id");
    const statements = {
      members: db.prepare("SELECT id,name FROM crm_members ORDER BY name"),
      companies: db.prepare("SELECT c.* FROM crm_companies c WHERE " + company.sql).bind(...company.args),
      contacts: db.prepare("SELECT c.* FROM crm_contacts c WHERE " + contact.sql).bind(...contact.args),
      deals: db.prepare(`SELECT d.*,COALESCE(
        (SELECT a.at FROM crm_activities a WHERE a.deal=d.id AND ${matchedStage("d.stage")} ORDER BY a.revision DESC LIMIT 1),
        (SELECT a.at FROM crm_activities a WHERE a.deal=d.id AND a.kind='Cadastro' ORDER BY a.revision ASC LIMIT 1)
      ) stageSince FROM crm_deals d WHERE ${visible.sql}`).bind(...visible.args),
      people: db.prepare("SELECT p.* FROM crm_people p JOIN crm_deals d ON d.id=p.deal WHERE " + visible.sql).bind(...visible.args),
      activities: db.prepare(`SELECT id,deal,revision,author,kind,note,at FROM (
        SELECT a.*, ROW_NUMBER() OVER (PARTITION BY a.deal,a.kind ORDER BY a.revision DESC) AS position
        FROM crm_activities a JOIN crm_deals d ON d.id=a.deal WHERE ${visible.sql}
      ) WHERE position=1 ORDER BY at DESC, revision DESC`).bind(...visible.args),
      accounts: db.prepare("SELECT a.* FROM crm_accounts a WHERE " + account.sql).bind(...account.args),
      handoffs: db.prepare("SELECT h.* FROM crm_handoffs h JOIN crm_deals d ON d.id=h.deal WHERE " + visible.sql).bind(...visible.args),
    };
    const parts = await db.batch(Object.values(statements));
    return reply({
      me: ctx.id,
      ...Object.fromEntries(Object.keys(statements).map((key, i) => [key, parts[i].results])),
    });
  } catch {
    return reply({ error: "Não foi possível carregar a fila comercial." }, 503);
  }
}
export async function POST(req: Request) {
  if (req.headers.get("origin") !== new URL(req.url).origin)
    return reply({ error: "Origem inválida." }, 403);
  if (!req.headers.get("content-type")?.startsWith("application/json"))
    return reply({ error: "Formato inválido." }, 415);
  const raw = await req.text();
  if (raw.length > 32000) return reply({ error: "Texto muito longo." }, 413);
  let body;
  try {
    body = input.safeParse(JSON.parse(raw));
  } catch {
    return reply({ error: "Pedido inválido." }, 400);
  }
  if (!body.success)
    return reply(
      { error: "Confira as datas, o e-mail, os valores e o link HTTPS da proposta." },
      400,
    );
  const { action, deal, requestId, revision, values: v } = body.data;
  try {
    const ctx = await getCrmMember();
    if (!ctx)
      return reply({ error: "Entre com sua conta para continuar." }, 401);
    const { db, id } = ctx;
    const q = (sql: string, ...params: (string | number | null)[]) =>
      db.prepare(sql).bind(...params);
    const hash = await fingerprint(JSON.stringify(body.data));
    const scope = dealScope(ctx, "d");
    const receipt = async () => {
      const seen = await q(
        "SELECT a.deal,a.author,a.fingerprint FROM crm_activities a JOIN crm_deals d ON d.id=a.deal WHERE a.id=? AND " + scope.sql,
        requestId, ...scope.args,
      ).first<{ deal: string; author: string; fingerprint: string | null }>();
      if (!seen) return null;
      return seen.deal === deal && seen.author === id && seen.fingerprint === hash
        ? reply({ id: deal })
        : reply({ error: "O identificador já foi usado por outro pedido." }, 409);
    };
    const seen = await receipt();
    if (seen) return seen;
    const now = new Date().toISOString(),
      isNew = action === "create";
    const old = await q("SELECT d.* FROM crm_deals d WHERE d.id=? AND " + scope.sql, deal, ...scope.args).first<Deal>();
    if (!isNew && !old) return reply({ error: "Oportunidade indisponível." }, 404);
    if (
      (isNew && (old || revision !== 0)) ||
      (!isNew && (!old || old.status !== "Aberto" || old.revision !== revision))
    )
      return reply(
        {
          error:
            "Esta oportunidade mudou. Reabra a ficha para revisar a versão atual.",
        },
        409,
      );
    const statements: D1PreparedStatement[] = [];
    const d: Deal = old
      ? { ...old }
      : {
          id: deal,
          company: null,
          contact: null,
          owner: id,
          stage: "Entrada",
          status: "Aberto",
          service: "",
          goal: "",
          source: "",
          monthly: null,
          once: null,
          next: "",
          due: "",
          reason: "",
          revision: 0,
          updated: now,
        };
    const at = async (person: string) =>
      !!(await q("SELECT id FROM crm_members WHERE id=?", person).first());
    if ((v.owner && !(await at(v.owner))) || (v.lead && !(await at(v.lead))))
      return reply({ error: "Escolha um integrante da equipe." }, 400);
    if (!ctx.admin && v.owner && v.owner !== (old?.owner || id))
      return reply({ error: "A troca de responsável exige um administrador." }, 403);
    let note = "",
      kind = "";
    if (isNew || action === "edit" || action === "won") {
      if (v.company && (action !== "won" || !old?.company)) {
        d.company = normalize(v.company);
        if (!d.company) return reply({ error: "Informe um nome válido para a empresa." }, 400);
        const existing = await q("SELECT 1 FROM crm_companies WHERE id=?", d.company).first();
        if (existing && !(await canAccessAccount(ctx, d.company)))
          return reply({ error: "Conta indisponível." }, 404);
        if (!existing) statements.push(
          q(
            "INSERT INTO crm_companies (id,name) VALUES (?,?)",
            d.company,
            v.company,
          ),
        );
      }
    }
    if (!ctx.admin && v.lead && v.lead !== id &&
        (!d.company || !(await canAccessAccount({ ...ctx, id: v.lead }, d.company))))
      return reply({ error: "O responsável precisa ter acesso à conta." }, 403);
    if (
      isNew ||
      action === "edit" ||
      action === "contact" ||
      action === "won"
    ) {
      let person = v.contact || null;
      const contact = contactScope(ctx, "c.id");
      if (person && !(await q("SELECT c.id FROM crm_contacts c WHERE c.id=? AND " + contact.sql,
        person, ...contact.args).first()))
        return reply({ error: "Contato não encontrado." }, 400);
      if (!person && (v.name || v.phone || v.email)) {
        if (!v.name) return reply({ error: "Informe o nome do contato." }, 400);
        const email = (v.email || "").toLowerCase(),
          phone = normalizePhone(v.phone || "");
        if (phone === null) return reply({ error: "Confira o telefone e o DDI selecionado." }, 400);
        const match = await q(
          "SELECT * FROM crm_contacts WHERE (email=? AND email<>'') OR (phone IN (?,?,?) AND phone<>'') LIMIT 1",
          email,
          ...matchingPhones(phone),
        ).first<Person>();
        if (match)
          return reply(
            {
              error:
                "Já existe um contato com este e-mail ou telefone. Selecione o contato existente.",
              ...(await q("SELECT c.id FROM crm_contacts c WHERE c.id=? AND " + contact.sql,
                match.id, ...contact.args).first() ? { contactId: match.id } : {}),
            },
            422,
          );
        person = crypto.randomUUID();
        statements.push(
          q(
            "INSERT INTO crm_contacts (id,name,email,phone) VALUES (?,?,?,?)",
            person,
            v.name,
            email,
            phone,
          ),
        );
      }
      if (action === "contact" && !person)
        return reply({ error: "Informe o contato adicional." }, 400);
      if (person && action !== "contact") d.contact = person;
      if (person) {
        const link = q(
          "INSERT OR IGNORE INTO crm_people (deal,contact) VALUES (?,?)",
          deal,
          person,
        );
        if (!isNew) statements.push(link);
        else d.contact = person;
      }
    }
    if (isNew || action === "edit") {
      if (!d.company && !d.contact)
        return reply({ error: "Informe a empresa ou um contato." }, 400);
      for (const key of ["source", "service", "proposalUrl", "goal", "next", "due"] as const)
        if (v[key] !== undefined) d[key] = v[key]!;
      if (v.monthly !== undefined) d.monthly = v.monthly;
      if (v.once !== undefined) d.once = v.once;
      if (v.owner) d.owner = v.owner;
      if (v.stage) d.stage = v.stage;
      kind = isNew ? "Cadastro" : "Atualização";
      const changes = [];
      if (old?.stage !== d.stage) changes.push(d.stage);
      if (old && old.owner !== d.owner)
        changes.push(
          "Responsável: " +
            (
              await q(
                "SELECT name FROM crm_members WHERE id=?",
                d.owner,
              ).first<{ name: string }>()
            )?.name,
        );
      note = isNew
        ? "Oportunidade registrada."
        : changes.join(" · ") || "Dados comerciais revisados.";
    } else if (action === "return") {
      if (!v.note)
        return reply({ error: "Registre o que foi combinado." }, 400);
      kind = v.kind || "Nota";
      note = v.note;
      d.next = v.next || "";
      d.due = v.due || "";
    } else if (action === "schedule") {
      if (!v.next || !v.due) return reply({ error: "Informe o próximo passo e a data do retorno." }, 400);
      kind = "Retorno agendado";
      note = v.next;
      d.next = v.next;
      d.due = v.due;
    } else if (action === "contact") {
      kind = "Contato";
      note = "Contato vinculado à oportunidade.";
    } else if (action === "lost") {
      if (!v.reason) return reply({ error: "Informe o motivo da perda." }, 400);
      d.status = "Perdido";
      d.reason = v.reason;
      kind = "Perda";
      note = v.reason;
    } else if (action === "won") {
      if (
        !d.company ||
        !d.contact ||
        !v.goal ||
        !v.scope ||
        !v.terms ||
        !v.first ||
        !v.date ||
        !v.lead ||
        (v.monthly == null && v.once == null)
      )
        return reply(
          {
            error:
              "Complete a passagem e confirme pelo menos um valor comercial.",
          },
          400,
        );
      d.status = "Ganho";
      if (v.proposalUrl !== undefined) d.proposalUrl = v.proposalUrl;
      d.goal = v.goal;
      d.monthly = v.monthly ?? null;
      d.once = v.once ?? null;
      statements.push(
        q(
          "INSERT OR IGNORE INTO crm_accounts (company,since) VALUES (?,?)",
          d.company,
          now,
        ),
        q(
          "INSERT INTO crm_handoffs (deal,company,lead,scope,terms,first,date) VALUES (?,?,?,?,?,?,?)",
          deal,
          d.company,
          v.lead,
          v.scope,
          v.terms,
          v.first,
          v.date,
        ),
      );
      kind = "Venda ganha";
      note = v.first + " · " + v.date;
    }
    if (d.due && !d.next)
      return reply(
        { error: "Descreva o próximo passo para a data escolhida." },
        400,
      );
    d.updated = now;
    d.revision = revision + 1;
    const cols = [
      "company",
      "contact",
      "owner",
      "stage",
      "status",
      "source",
      "service",
      "proposalUrl",
      "goal",
      "monthly",
      "once",
      "next",
      "due",
      "reason",
      "revision",
      "updated",
    ] as const;
    const args = cols.map((k) => d[k] ?? null);
    statements.push(
      isNew
        ? q(
            "INSERT INTO crm_deals (id," +
              cols.join(",") +
              ") VALUES (" +
              Array(cols.length + 1)
                .fill("?")
                .join(",") +
              ")",
            deal,
            ...args,
          )
        : q(
            "UPDATE crm_deals SET " +
              cols.map((k) => k + "=?").join(",") +
              " WHERE id=?",
            ...args,
            deal,
          ),
    );
    if (isNew && d.contact)
      statements.push(
        q(
          "INSERT INTO crm_people (deal,contact) VALUES (?,?)",
          deal,
          d.contact,
        ),
      );
    const enteredStage = old?.stage !== d.stage ? d.stage : null;
    const scheduledFor = d.due && (action === "schedule" || old?.due !== d.due || old?.next !== d.next)
      ? d.due : null;
    // The unique deal/revision receipt rolls the entire D1 batch back on competing writes.
    statements.push(
      q(
        "INSERT INTO crm_activities (id,deal,revision,author,kind,note,at,fingerprint,enteredStage,scheduledFor) VALUES (?,?,?,?,?,?,?,?,?,?)",
        requestId,
        deal,
        d.revision,
        id,
        kind,
        note,
        now,
        hash,
        enteredStage,
        scheduledFor,
      ),
    );
    try {
      await db.batch(statements);
    } catch (error) {
      const done = await receipt();
      if (done) return done;
      if (/unique|constraint/i.test(String(error)))
        return reply(
          {
            error:
              "O cadastro mudou em outra sessão. Reabra a ficha e tente novamente.",
          },
          409,
        );
      throw error;
    }
    return reply({ id: deal }, isNew ? 201 : 200);
  } catch {
    return reply(
      { error: "Não foi possível confirmar a gravação. Tente novamente." },
      503,
    );
  }
}

const contactSnapshot = z
  .object({
    name: short.min(1),
    email: z.union([z.literal(""), z.string().email().max(254)]),
    phone: short,
  })
  .strict();
const contactEdit = z
  .object({
    id: z.string().uuid(),
    previous: contactSnapshot,
    values: contactSnapshot,
  })
  .strict();
export async function PATCH(req: Request) {
  if (req.headers.get("origin") !== new URL(req.url).origin)
    return reply({ error: "Origem inválida." }, 403);
  if (!req.headers.get("content-type")?.startsWith("application/json"))
    return reply({ error: "Formato inválido." }, 415);
  try {
    const ctx = await getCrmMember();
    if (!ctx)
      return reply({ error: "Entre com sua conta para continuar." }, 401);
    const raw = await req.text();
    if (raw.length > 4000)
      return reply({ error: "Dados de contato muito longos." }, 413);
    let parsed;
    try {
      parsed = contactEdit.safeParse(JSON.parse(raw));
    } catch {
      return reply({ error: "Dados inválidos." }, 400);
    }
    if (!parsed.success)
      return reply({ error: "Confira o nome e os canais do contato." }, 400);
    const { id, values, previous } = parsed.data;
    const normalized = normalizePhone(values.phone);
    if (normalized === null && values.phone !== previous.phone)
      return reply({ error: "Confira o telefone e o DDI selecionado." }, 400);
    const phone = normalized ?? previous.phone;
    const email = values.email.toLowerCase();
    const contact = contactEditScope(ctx, "crm_contacts.id");
    const snapshot = [id, previous.name, previous.email, previous.phone, ...contact.args];
    const unchanged = "id=? AND name=? AND email=? AND phone=? AND " + contact.sql;
    if (phone && phone !== previous.phone) {
      const duplicate = await ctx.db.prepare(
        "SELECT 1 FROM crm_contacts WHERE id<>? AND phone IN (?,?,?) " +
        "AND EXISTS(SELECT 1 FROM crm_contacts WHERE " + unchanged + ")",
      ).bind(id, ...matchingPhones(phone), ...snapshot).first();
      if (duplicate) return reply({ error: "Telefone já cadastrado em outro contato." }, 422);
    }
    const updated = await ctx.db
      .prepare(
        "UPDATE crm_contacts SET name=?,email=?,phone=? WHERE " + unchanged + " RETURNING id",
      )
      .bind(
        values.name,
        email,
        phone,
        ...snapshot,
      )
      .first();
    return updated
      ? reply({ id })
      : reply(
          { error: "Outra pessoa alterou o contato. Reabra a edição." },
          409,
        );
  } catch (e) {
    if (/unique/i.test(String(e)))
      return reply(
        { error: "E-mail ou telefone já cadastrado em outro contato." },
        422,
      );
    return reply({ error: "Não foi possível salvar o contato." }, 503);
  }
}
