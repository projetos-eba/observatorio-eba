"use client";

import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import { monday, weekLabel } from "../carteira/model";
import { businessDay, dateLabel, offsetDay, reactivationTypes, today, type Reactivation as Report, type ReactivationType } from "./model";

const categories = Object.keys(reactivationTypes) as ReactivationType[];
const singular: Record<ReactivationType, string> = { retornos: "retorno", conversas: "conversa", propostas: "proposta", contratos: "contrato" };

export function Reactivation({ open, revision }: { open: (deal: string, event: string) => void; revision: string }) {
  const current = monday(today());
  const [week, setWeek] = useState(current);
  const [category, setCategory] = useState<ReactivationType | "">("");
  const [page, setPage] = useState(1);
  const [attempt, retry] = useState(0);
  const [state, setState] = useState<{ report?: Report; error?: boolean }>({});
  useEffect(() => {
    const abort = new AbortController();
    async function load() {
      setState({});
      try {
        const query = new URLSearchParams({ reativacao: week, categoria: category, pagina: String(page) });
        const response = await fetch("/api/crm?" + query, { cache: "no-store", signal: abort.signal });
        if (!response.ok) throw Error();
        const report: Report = await response.json();
        if (!abort.signal.aborted) setState({ report });
      } catch {
        if (!abort.signal.aborted) setState({ error: true });
      }
    }
    queueMicrotask(() => { if (!abort.signal.aborted) void load(); });
    return () => abort.abort();
  }, [week, category, page, attempt, revision]);
  return <section className="funnel-reactivation" aria-labelledby="reactivation-title">
    <div className="funnel-reactivation-head">
      <div><h2 id="reactivation-title">Reativação de ex-clientes</h2><small>{weekLabel(week)}</small></div>
      <div className="funnel-reactivation-stats">
        {categories.map((key) => <button type="button" key={key} aria-pressed={category === key} aria-controls="funnel-reactivation-entries"
          onClick={() => { setCategory(category === key ? "" : key); setPage(1); }}>
          <strong>{state.report?.totals[key] ?? "—"}</strong> {state.report?.totals[key] === 1 ? singular[key] : reactivationTypes[key].toLowerCase()}
        </button>)}
      </div>
    </div>
    <div className="funnel-reactivation-period">
      <label>Período <select value={week} onChange={(event) => { setWeek(event.target.value); setPage(1); }}>
        {Array.from({ length: 13 }, (_, i) => offsetDay(current, -7 * i)).map((start, i) =>
          <option key={start} value={start}>{i === 0 ? "Esta semana" : i === 1 ? "Semana passada" : weekLabel(start)}</option>)}
      </select></label>
      <details><summary>Como os totais são calculados</summary>
        <p>Contamos os agendamentos registrados, as conversas por WhatsApp, ligação, reunião ou e-mail, as entradas em Proposta e as vendas ganhas. Todos usam a data de registro da atividade e a origem atual Ex-cliente.</p>
      </details>
    </div>
    {state.error ? <p role="alert">Não foi possível carregar a reativação. <button className="operation-action" onClick={() => retry(attempt + 1)}>Tentar novamente</button></p> :
      !state.report ? <p role="status">Carregando reativação…</p> : null}
    <div id="funnel-reactivation-entries" hidden={!category}>
      {category && state.report && <>
        <h3>{reactivationTypes[category]} no período</h3>
        {state.report.entries.length ? <ul className="funnel-event-list">
          {state.report.entries.map((entry) => <li key={entry.id}>
            <button type="button" onClick={() => open(entry.deal, entry.id)}>
              <strong>{entry.companyName}</strong><span>{entry.kind} · {entry.note}</span><time dateTime={entry.at}>{dateLabel(businessDay(new Date(entry.at)))}</time><ArrowRight size={16} />
            </button>
          </li>)}
        </ul> : <p>Nenhum registro neste período.</p>}
        <div className="funnel-pages">
          {page > 1 && <button className="crm-secondary" onClick={() => setPage(page - 1)}>Página anterior</button>}
          {state.report.next && <button className="crm-secondary" onClick={() => setPage(page + 1)}>Próxima página</button>}
        </div>
      </>}
    </div>
  </section>;
}
