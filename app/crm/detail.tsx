import { useEffect, useRef } from "react";
import { X, ArrowUpRight } from "lucide-react";
import { type Deal, type State, money, dateLabel } from "./model";
import { dealName, memberName } from "./views";
import { Contact } from "./contact";
import type { FormKind } from "./forms";
export function Detail({
  d,
  s,
  close,
  refresh,
  action,
}: {
  d: Deal;
  s: State;
  close: () => void;
  refresh: () => Promise<void>;
  action: (v: FormKind) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const node = ref.current;
    node?.showModal();
    return () => node?.close();
  }, []);
  const facts = (rows: [string, string][]) => (
    <dl className="crm-facts">
      {rows.map(([k, v]) => (
        <div key={k}>
          <dt>{k}</dt>
          <dd>{v || "A definir"}</dd>
        </div>
      ))}
    </dl>
  );
  const hand = s.handoffs.find((x) => x.deal === d.id);
  const contacts = s.contacts.filter(
    (x) =>
      x.id === d.contact ||
      s.people.some((p) => p.deal === d.id && p.contact === x.id),
  );
  const stamp = (at: string) =>
    new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
      timeZone: "America/Sao_Paulo",
    }).format(new Date(at));
  return (
    <dialog
      ref={ref}
      className="crm-detail"
      aria-labelledby="detail-name"
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
    >
      <header>
        <span className="eyebrow">
          {d.status} · {d.stage}
        </span>
        <button
          className="icon-action"
          aria-label="Fechar ficha"
          onClick={close}
        >
          <X size={20} />
        </button>
        <h2 id="detail-name">{dealName(s, d)}</h2>
        <p>{memberName(s, d.owner)}</p>
      </header>
      <div className="detail-body">
        {d.status === "Aberto" && (
          <section className="next-box">
            <small>Próximo passo · {dateLabel(d.due)}</small>
            <h3>{d.next || "Definir próximo passo"}</h3>
            <button className="crm-primary" onClick={() => action("return")}>
              Registrar retorno <ArrowUpRight size={15} />
            </button>
          </section>
        )}
        {hand && (
          <section>
            <h3>Passagem ao atendimento</h3>
            {facts([
              ["Escopo vendido", hand.scope],
              ["Condições", hand.terms],
              ["Atendimento", memberName(s, hand.lead)],
              ["Primeiro compromisso", hand.first],
              ["Data", dateLabel(hand.date)],
            ])}
          </section>
        )}
        {d.reason && (
          <section>
            <h3>Motivo da perda</h3>
            <p>{d.reason}</p>
          </section>
        )}
        <section>
          <div className="detail-heading">
            <h3>Dados comerciais</h3>
            {d.status === "Aberto" && (
              <button onClick={() => action("edit")}>
                Editar oportunidade
              </button>
            )}
          </div>
          {facts([
            ["Serviço", d.service],
            ["Origem", d.source],
            ["Mensalidade", money(d.monthly)],
            ["Valor pontual", money(d.once)],
            ["Objetivo", d.goal],
          ])}
        </section>
        <section>
          <div className="detail-heading">
            <h3>Contatos</h3>
            {d.status === "Aberto" && (
              <button onClick={() => action("contact")}>
                Vincular contato
              </button>
            )}
          </div>
          {contacts.length ? (
            contacts.map((c) => (
              <Contact
                key={c.id}
                person={c}
                primary={c.id === d.contact}
                refresh={refresh}
              />
            ))
          ) : (
            <p>Nenhum contato vinculado.</p>
          )}
        </section>
        <section>
          <h3>Histórico</h3>
          {s.activities
            .filter((a) => a.deal === d.id)
            .map((a) => (
              <div className="crm-event" key={a.id}>
                <b>{a.kind}</b>
                <small>
                  {stamp(a.at)} · {memberName(s, a.author)}
                </small>
                <p>{a.note}</p>
              </div>
            ))}
        </section>
        {d.status === "Aberto" && (
          <div className="close-deal">
            <button className="crm-secondary" onClick={() => action("won")}>
              Marcar como ganho
            </button>
            <button className="crm-secondary" onClick={() => action("lost")}>
              Registrar perda
            </button>
          </div>
        )}
      </div>
    </dialog>
  );
}
