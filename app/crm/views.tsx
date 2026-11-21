import {
  ArrowRight,
  Inbox,
} from "lucide-react";
import {
  type Deal,
  type State,
  businessDay,
  dateLabel,
  money,
  normalize,
  stageDays,
  today,
  kinds,
} from "./model";

export const memberName = (s: State, id: string) =>
  s.members.find((m) => m.id === id)?.name || "Equipe";
export const companyName = (s: State, id: string | null) =>
  s.companies.find((c) => c.id === id)?.name;
export const dealName = (s: State, d: Deal) =>
  companyName(s, d.company) ||
  s.contacts.find((c) => c.id === d.contact)?.name ||
  "Oportunidade";
export const lastAgreement = (s: State, d: Deal) =>
  s.activities.find((a) => a.deal === d.id && kinds.some((k) => k === a.kind));
export function matches(s: State, d: Deal, query: string) {
  const contacts = s.contacts.filter(
    (c) =>
      c.id === d.contact ||
      s.people.some((p) => p.deal === d.id && p.contact === c.id),
  );
  return normalize(
    [
      dealName(s, d),
      d.service,
      d.reason,
      d.next,
      memberName(s, d.owner),
      ...contacts.flatMap((c) => [c.name, c.email, c.phone]),
    ].join(" "),
  ).includes(normalize(query));
}
export function queueGroup(d: Deal, day: string) {
  if (!d.due || !d.next) return "Sem próximo passo";
  return d.due < day ? "Vencidos" : d.due === day ? "Hoje" : "Agendados";
}
export function amount(list: Deal[], field: "monthly" | "once") {
  if (!list.length) return money(0);
  const known = list.flatMap((d) => (d[field] === null ? [] : [d[field]]));
  return known.length ? money(known.reduce((a, b) => a + b, 0)) : "A definir";
}
type ViewProps = { state: State; list: Deal[]; open: (d: Deal) => void };
export function Queue({
  state,
  list,
  open,
  follow,
  filtered,
}: {
  follow: (d: Deal) => void;
  filtered: boolean;
} & ViewProps) {
  const day = today();
  if (!list.length)
    return (
      <div className="crm-empty">
        <Inbox size={28} />
        <h2>
          {filtered
            ? "Nenhum retorno encontrado"
            : state.deals.length
              ? "Sua fila está em dia"
              : "Cadastre a primeira oportunidade"}
        </h2>
        <p>
          {filtered
            ? "Ajuste a busca ou os filtros para ver outras oportunidades."
            : state.deals.length
              ? "Nenhuma negociação aberta nesta fila."
              : "Use Nova oportunidade para registrar a empresa ou o contato da primeira conversa."}
        </p>
      </div>
    );
  const order = ["Vencidos", "Hoje", "Agendados", "Sem próximo passo"];
  const sorted = [...list].sort((a, b) =>
    order.indexOf(queueGroup(a, day)) - order.indexOf(queueGroup(b, day)) ||
    a.due.localeCompare(b.due) || b.updated.localeCompare(a.updated));
  return <table className="operation-queue">
    <thead><tr><th scope="col">Empresa</th><th scope="col">Próximo passo</th><th scope="col">Prazo</th><th scope="col">Ação</th></tr></thead>
    <tbody>{sorted.map((d) => {
      const group = queueGroup(d, day);
      return <tr key={d.id}>
        <th scope="row"><button className="deal-link" onClick={() => open(d)}>{dealName(state, d)}</button></th>
        <td>{d.next || "Definir próximo passo"}</td>
        <td>{group === "Vencidos" || group === "Hoje" ? <span className={"operation-due" + (group === "Vencidos" ? " overdue" : "")}>{group}</span> : dateLabel(d.due)}</td>
        <td><button className="crm-secondary" onClick={() => follow(d)}>Registrar retorno <ArrowRight size={16} /></button></td>
      </tr>;
    })}</tbody>
  </table>;
}
export function Pipeline({
  state, list, open, schedule, showStage,
}: ViewProps & { schedule: (d: Deal) => void; showStage: boolean }) {
  if (!list.length) return <div className="crm-empty">
    <Inbox size={28} /><h2>Nenhuma oportunidade nesta seleção</h2>
    <p>Ajuste a etapa ou os filtros para ver outras oportunidades.</p>
  </div>;
  const day = today();
  const sorted = [...list].sort((a, b) =>
    Number(!!a.next && !!a.due) - Number(!!b.next && !!b.due) || a.due.localeCompare(b.due) ||
    (a.stageSince || "").localeCompare(b.stageSince || ""));
  return <table className="operation-queue funnel-table">
    <thead><tr><th scope="col">Empresa</th><th scope="col">Dias na etapa</th><th scope="col">Próximo passo</th><th scope="col">Responsável</th><th scope="col">Ação</th></tr></thead>
    <tbody>{sorted.map((d) => {
      const age = stageDays(d.stageSince, d.status === "Aberto" ? day : businessDay(new Date(d.updated)));
      const needsReturn = d.status === "Aberto" && (!d.next || !d.due);
      const context = [showStage ? d.stage : "", d.source, d.status !== "Aberto" ? d.status : ""].filter(Boolean);
      return <tr key={d.id}>
        <th scope="row"><button className="deal-link" onClick={() => open(d)}>{dealName(state, d)}</button>
          {context.length > 0 && <small>{context.join(" · ")}</small>}</th>
        <td><span className="funnel-mobile-label">Dias na etapa</span>{age === null ? "Sem registro" :
          <span className={needsReturn ? "funnel-warning" : ""}>{age} {age === 1 ? "dia" : "dias"}</span>}</td>
        <td className="funnel-next"><span className="funnel-mobile-label">Próximo passo</span>
          <span className={needsReturn ? "funnel-warning" : ""}>{d.next || "Sem próximo passo"}</span>
          {d.due ? <small>{d.status === "Aberto" && !needsReturn
            ? <button className="funnel-reschedule" type="button" onClick={() => schedule(d)} aria-label={"Reagendar retorno de " + dealName(state, d) + ", marcado para " + dateLabel(d.due)}>{dateLabel(d.due)}</button>
            : dateLabel(d.due)}</small> : d.next && needsReturn ? <small>Sem data combinada</small> : null}</td>
        <td><span className="funnel-mobile-label">Responsável</span>{memberName(state, d.owner)}</td>
        <td className="funnel-row-action"><button className="crm-secondary" onClick={() => needsReturn ? schedule(d) : open(d)}>
          {needsReturn ? "Definir retorno" : "Abrir oportunidade"} <ArrowRight size={16} />
        </button></td>
      </tr>;
    })}</tbody>
  </table>;
}
