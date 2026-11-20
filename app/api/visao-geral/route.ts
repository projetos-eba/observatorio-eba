import { monday } from "../../carteira/model";
import { offsetDay, today } from "../../crm/model";
import { accountScope, dealScope, getCrmMember } from "../../crm/session";
import { brandsFor, fail, reply } from "../../conteudo/server";
import { validDate } from "../../carteira/csv";
import type { Commitment, Overview } from "../../workspace/overview-model";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const session = await getCrmMember();
    if (!session) return fail("Entre com sua conta para abrir o workspace.", 401);
    const day = today();
    const week = new URL(request.url).searchParams.get("semana") || monday(day);
    if (!validDate(week) || monday(week) !== week) return fail("Semana inválida.");
    const end = offsetDay(week, 6);
    const until = end > day ? end : day;
    const { db } = session;
    const deals = dealScope(session, "d");
    const accounts = accountScope(session, "a.company");
    const decisions = accountScope(session, "p.company");
    const brands = (await brandsFor(session)).filter((brand) => brand.active);
    const [member, book, returns, crm, handoffs, pico, pieces] = await db.batch<Record<string, unknown>>([
      db.prepare("SELECT name FROM crm_members WHERE id=?").bind(session.id),
      db.prepare(`SELECT COUNT(DISTINCT a.company) clients, SUM(d.monthly) monthly
        FROM crm_accounts a LEFT JOIN crm_deals d ON d.company=a.company AND d.status='Ganho'
        WHERE ${accounts.sql}`).bind(...accounts.args),
      db.prepare(`SELECT COUNT(*) amount FROM crm_activities r JOIN crm_deals d ON d.id=r.deal
        WHERE ${deals.sql} AND r.kind IN ('WhatsApp','Ligação','Reunião','E-mail','Nota')
        AND r.at>=? AND r.at<?`).bind(...deals.args, week + "T03:00:00", offsetDay(end, 1) + "T03:00:00"),
      db.prepare(`SELECT d.id,d.due date,d.next summary,COALESCE(c.name,x.name,'Oportunidade') title
        FROM crm_deals d LEFT JOIN crm_companies c ON c.id=d.company LEFT JOIN crm_contacts x ON x.id=d.contact
        WHERE ${deals.sql} AND d.status='Aberto' AND d.due<>'' AND d.due<=? AND d.next<>''`)
        .bind(...deals.args, until),
      db.prepare(`SELECT h.deal id,h.date,h."first" summary,c.name title
        FROM crm_handoffs h JOIN crm_deals d ON d.id=h.deal JOIN crm_companies c ON c.id=h.company
        WHERE ${deals.sql} AND h.date BETWEEN ? AND ?`).bind(...deals.args, week < day ? week : day, until),
      db.prepare(`SELECT p.id,p.company,c.name title,json_extract(p.data,'$.due') date,
        COALESCE(NULLIF(json_extract(p.data,'$.step'),''),json_extract(p.data,'$.action')) summary
        FROM carteira_decisions p JOIN crm_companies c ON c.id=p.company
        WHERE ${decisions.sql} AND json_extract(p.data,'$.status')='Aberta'
        AND json_extract(p.data,'$.due') BETWEEN '0001-01-01' AND ?
        AND NOT EXISTS (SELECT 1 FROM carteira_decisions newer WHERE newer.id=p.id AND newer.version>p.version)`)
        .bind(...decisions.args, until),
      db.prepare(`SELECT e.id,e.brand,json_extract(e.data,'$.title') summary,json_extract(e.data,'$.due') date,
        json_extract(p.data,'$.status') status
        FROM hub_entries p JOIN hub_entries e ON e.brand=p.brand AND e.id=p.id AND e.kind='edition'
          AND e.version=json_extract(p.data,'$.edition')
        WHERE p.kind='piece' AND p.brand IN (SELECT value FROM json_each(?))
        AND json_extract(p.data,'$.status') NOT IN ('Publicada','Avaliada')
        AND (json_extract(e.data,'$.due') BETWEEN '0001-01-01' AND ? OR json_extract(p.data,'$.status')='Revisão')
        AND NOT EXISTS (SELECT 1 FROM hub_entries newer WHERE newer.brand=p.brand AND newer.kind=p.kind
          AND newer.id=p.id AND newer.version>p.version)`).bind(JSON.stringify(brands.map((brand) => brand.id)), until),
    ]);
    const names = new Map(brands.map((brand) => [brand.id, brand.name]));
    const items: Commitment[] = [];
    for (const [kind, source] of [["return", crm], ["handoff", handoffs], ["decision", pico], ["piece", pieces]] as const) {
      for (const row of source.results) {
        const id = String(row.id), date = String(row.date || "");
        const href = kind === "piece"
          ? "/conteudo?" + new URLSearchParams({ marca: String(row.brand), vista: "editorial", id })
          : kind === "decision"
            ? "/carteira?" + new URLSearchParams({ vista: "contas", conta: String(row.company) }) + "#decisao-" + id
            : "/crm?" + new URLSearchParams(kind === "return" ? { ficha: id, acao: "retorno" } : { ficha: id, vista: "contas" });
        items.push({
          id, date, href, kind, title: kind === "piece" ? names.get(String(row.brand)) || "Conteúdo" : String(row.title),
          summary: kind === "piece" && row.status === "Revisão" ? "Revisar peça · " + String(row.summary) : String(row.summary),
          review: kind === "piece" && row.status === "Revisão",
        });
      }
    }
    items.sort((a, b) => (a.date || "9999").localeCompare(b.date || "9999") || a.title.localeCompare(b.title, "pt-BR"));
    const clients = Number(book.results[0].clients);
    const overview: Overview = {
      name: String(member.results[0]?.name || ""), clients,
      monthly: clients && book.results[0].monthly === null ? null : Number(book.results[0].monthly || 0),
      returns: Number(returns.results[0].amount), week, end, today: day,
      commitments: items.filter((item) => item.date >= week && item.date <= end),
      priorities: items.filter((item) => (item.date && item.date <= day) || item.review).slice(0, 5),
    };
    return reply(overview);
  } catch {
    return fail("Não foi possível carregar a operação.", 503);
  }
}
