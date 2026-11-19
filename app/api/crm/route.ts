import { z } from "zod";
import { getCrmMember } from "../../crm/session";
import {
  stages,
  kinds,
  digits,
  normalize,
  type Deal,
  type Person,
} from "../../crm/model";
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
    action: z.enum(["create", "edit", "return", "contact", "won", "lost"]),
    deal: z.string().uuid(),
    requestId: z.string().uuid(),
    revision: z.number().int().nonnegative(),
    values,
  })
  .strict();
export async function GET() {
  try {
    const ctx = await getCrmMember();
    if (!ctx)
      return reply({ error: "Entre com sua conta para acessar o CRM." }, 401);
    const tables = [
      "members",
      "companies",
      "contacts",
      "deals",
      "people",
      "activities",
      "accounts",
      "handoffs",
    ];
    const parts = await ctx.db.batch(
      tables.map((t) =>
        ctx.db.prepare(
          "SELECT * FROM crm_" +
            t +
            (t === "activities" ? " ORDER BY at DESC, revision DESC" : ""),
        ),
      ),
    );
    return reply({
      me: ctx.id,
      ...Object.fromEntries(tables.map((k, i) => [k, parts[i].results])),
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
      { error: "Confira as datas, o e-mail e os valores informados." },
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
    const receipt = () =>
      q("SELECT deal,author FROM crm_activities WHERE id=?", requestId).first<{
        deal: string;
        author: string;
      }>();
    const seen = await receipt();
    if (seen)
      return seen.deal === deal && seen.author === id
        ? reply({ id: deal })
        : reply({ error: "Identificador em uso." }, 409);
    const now = new Date().toISOString(),
      isNew = action === "create";
    const old = await q(
      "SELECT * FROM crm_deals WHERE id=?",
      deal,
    ).first<Deal>();
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
    let note = "",
      kind = "";
    if (isNew || action === "edit" || action === "won") {
      if (v.company) {
        d.company = normalize(v.company);
        statements.push(
          q(
            "INSERT OR IGNORE INTO crm_companies (id,name) VALUES (?,?)",
            d.company,
            v.company,
          ),
        );
      }
    }
    if (
      isNew ||
      action === "edit" ||
      action === "contact" ||
      action === "won"
    ) {
      let person = v.contact || null;
      if (
        person &&
        !(await q("SELECT id FROM crm_contacts WHERE id=?", person).first())
      )
        return reply({ error: "Contato não encontrado." }, 400);
      if (!person && (v.name || v.phone || v.email)) {
        if (!v.name) return reply({ error: "Informe o nome do contato." }, 400);
        const email = (v.email || "").toLowerCase(),
          phone = digits(v.phone || "");
        const match = await q(
          "SELECT * FROM crm_contacts WHERE (email=? AND email<>'') OR (phone=? AND phone<>'') LIMIT 1",
          email,
          phone,
        ).first<Person>();
        if (match)
          return reply(
            {
              error:
                "Já existe um contato com este e-mail ou telefone. Selecione o contato existente.",
              contactId: match.id,
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
      for (const key of ["source", "service", "goal", "next", "due"] as const)
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
      "goal",
      "monthly",
      "once",
      "next",
      "due",
      "reason",
      "revision",
      "updated",
    ] as const;
    const args = cols.map((k) => d[k]);
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
    // The unique deal/revision receipt rolls the entire D1 batch back on competing writes.
    statements.push(
      q(
        "INSERT INTO crm_activities (id,deal,revision,author,kind,note,at) VALUES (?,?,?,?,?,?,?)",
        requestId,
        deal,
        d.revision,
        id,
        kind,
        note,
        now,
      ),
    );
    try {
      await db.batch(statements);
    } catch (error) {
      const done = await receipt();
      if (done?.author === id && done.deal === deal) return reply({ id: deal });
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
    const phone = digits(values.phone),
      email = values.email.toLowerCase();
    const updated = await ctx.db
      .prepare(
        "UPDATE crm_contacts SET name=?,email=?,phone=? WHERE id=? AND name=? AND email=? AND phone=? RETURNING id",
      )
      .bind(
        values.name,
        email,
        phone,
        id,
        previous.name,
        previous.email,
        previous.phone,
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
