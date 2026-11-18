import {
  ArrowUpRight,
  CalendarDays,
  CheckCheck,
  ChevronRight,
  Inbox,
} from "lucide-react";
import {
  type Deal,
  type State,
  dateLabel,
  relativeDue,
  money,
  normalize,
  stages,
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
  if (!d.due) return "Sem próximo passo";
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
  return (
    <>
      {["Vencidos", "Hoje", "Sem próximo passo", "Agendados"].map((group) => {
        const rows = list
          .filter((d) => queueGroup(d, day) === group)
          .sort(
            (a, b) =>
              a.due.localeCompare(b.due) || b.updated.localeCompare(a.updated),
          );
        return (
          rows.length > 0 && (
            <section className="crm-group" key={group}>
              <h2>
                {group} <small>{rows.length}</small>
              </h2>
              {rows.map((d) => (
                <article className="crm-row" key={d.id}>
                  <div>
                    <button className="deal-link" onClick={() => open(d)}>
                      {dealName(state, d)} <ArrowUpRight size={14} />
                    </button>
                    <p>
                      {lastAgreement(state, d)?.note ||
                        "Primeira conversa a registrar"}
                    </p>
                  </div>
                  <div>
                    <strong>{d.next || "Definir próximo passo"}</strong>
                    <small className={group === "Vencidos" ? "late" : ""}>
                      {relativeDue(d.due, day)} · {memberName(state, d.owner)}
                    </small>
                  </div>
                  <button className="crm-secondary" onClick={() => follow(d)}>
                    Registrar retorno
                  </button>
                </article>
              ))}
            </section>
          )
        );
      })}
    </>
  );
}
export function Pipeline({
  state,
  list,
  open,
  stage,
  setStage,
  searching,
}: {
  stage: string;
  setStage: (v: string) => void;
  searching: boolean;
} & ViewProps) {
  return (
    <>
      {searching && !list.length && (
        <p className="crm-search-feedback" role="status">
          Nenhuma oportunidade encontrada para esta busca.
        </p>
      )}
      <label
        className={
          "crm-mobile-stage" +
          (searching && list.length ? " search-stages" : "")
        }
      >
        Etapa
        <select value={stage} onChange={(e) => setStage(e.target.value)}>
          {stages.map((s) => (
            <option key={s} value={s}>
              {s} ({list.filter((d) => d.stage === s).length})
            </option>
          ))}
        </select>
      </label>
      <div className="crm-board">
        {stages.map((s, i) => {
          const rows = list.filter((d) => d.stage === s);
          return (
            <section
              className={
                "crm-lane " +
                ((searching && list.length ? rows.length > 0 : s === stage)
                  ? "mobile-selected"
                  : "")
              }
              key={s}
            >
              <div className="lane-head">
                <small>0{i + 1}</small>
                <h2>{s}</h2>
                <b>{rows.length}</b>
              </div>
              <dl className="lane-amount">
                <dt>Mensal</dt>
                <dd>{amount(rows, "monthly")}</dd>
                <dt>Pontual</dt>
                <dd>{amount(rows, "once")}</dd>
              </dl>
              {rows.length ? (
                rows.map((d) => (
                  <button
                    className="deal-card"
                    key={d.id}
                    onClick={() => open(d)}
                  >
                    <b>{dealName(state, d)}</b>
                    <span>{d.service || "Serviço a definir"}</span>
                    <span>{memberName(state, d.owner)}</span>
                    <small>
                      <CalendarDays size={13} />
                      {d.status === "Aberto" ? dateLabel(d.due) : d.status}
                    </small>
                    {d.next && d.status === "Aberto" && <span>{d.next}</span>}
                  </button>
                ))
              ) : (
                <p className="lane-empty">Nenhuma oportunidade</p>
              )}
            </section>
          );
        })}
      </div>
    </>
  );
}
export function Accounts({ state, list, open }: ViewProps) {
  const accounts = state.accounts.filter((a) =>
    list.some((d) => d.company === a.company),
  );
  return (
    <section>
      {accounts.length ? (
        accounts.map((a) => (
          <article className="crm-account" key={a.company}>
            <div>
              <span className="eyebrow">Conta ganha</span>
              <h2>{companyName(state, a.company)}</h2>
            </div>
            {list
              .filter((d) => d.company === a.company)
              .map((d) => {
                const h = state.handoffs.find((h) => h.deal === d.id);
                return (
                  <button key={d.id} onClick={() => open(d)}>
                    <span>
                      <b>{h?.scope || d.service}</b>
                      <small>
                        {memberName(state, h?.lead || d.owner)} ·{" "}
                        {dateLabel(h?.date || "")}
                      </small>
                    </span>
                    <span>{h?.first}</span>
                    <ChevronRight size={17} />
                  </button>
                );
              })}
          </article>
        ))
      ) : (
        <div className="crm-empty">
          <CheckCheck size={28} />
          <h2>Nenhuma conta nesta seleção</h2>
          <p>
            Ao confirmar uma venda, a passagem para o atendimento aparece aqui.
          </p>
        </div>
      )}
    </section>
  );
}
