import { useEffect, useRef, useState } from "react";
import { X, ArrowUpRight } from "lucide-react";
import { type Activity, type Deal, type State, kinds, money, dateLabel } from "./model";
import { dealName, memberName } from "./views";
import { Contact } from "./contact";
import type { FormKind } from "./forms";

function ActivityHistory({ deal, state }: { deal: Deal; state: State }) {
  const [kind, setKind] = useState("");
  const [before, setBefore] = useState<number | null>(null);
  const [result, setResult] = useState<{ entries: Activity[]; next: number | null }>();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const abort = new AbortController();
    const query = new URLSearchParams({ historico: deal.id, tipo: kind });
    if (before) query.set("antes", String(before));
    async function load() {
      setLoading(true);
      setError("");
      try {
        const res = await fetch("/api/crm?" + query, { signal: abort.signal, cache: "no-store" });
        if (!res.ok) throw Error();
        setResult(await res.json());
      } catch {
        if (!abort.signal.aborted) setError("Não foi possível carregar o histórico.");
      } finally {
        if (!abort.signal.aborted) setLoading(false);
      }
    }
    queueMicrotask(() => { if (!abort.signal.aborted) void load(); });
    return () => abort.abort();
  }, [deal.id, deal.revision, kind, before]);
  return <section>
    <div className="detail-heading">
      <h3>Histórico</h3>
      <select aria-label="Tipo de atividade" value={kind} onChange={(event) => {
        setBefore(null);
        setKind(event.target.value);
      }}>
        <option value="">Todas as atividades</option>
        {[...new Set([...kinds, "Cadastro", "Atualização", "Contato", "Venda ganha", "Perda"])].map((item) =>
          <option key={item}>{item}</option>)}
      </select>
    </div>
    {loading ? <p role="status">Carregando histórico…</p> : error ? <p role="alert">{error}</p> : <>
      {result?.entries.length ? result.entries.map((activity) => <div className="crm-event" key={activity.id}>
        <b>{activity.kind}</b>
        <small>{new Date(activity.at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })} · {memberName(state, activity.author)}</small>
        <p>{activity.note}</p>
      </div>) : <p>Nenhuma atividade para este filtro.</p>}
      {before && <button className="crm-secondary" onClick={() => setBefore(null)}>Mais recentes</button>}
      {result?.next != null && <button className="crm-secondary" onClick={() => setBefore(result.next)}>Mais antigas</button>}
    </>}
  </section>;
}
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
        <ActivityHistory key={d.id} deal={d} state={s} />
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
