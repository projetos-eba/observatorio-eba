import { LinkedPost } from "./linked-post";
import { useState } from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  Copy,
  GitFork,
  Plus,
  Upload,
} from "lucide-react";
import { money } from "../crm/model";
import {
  credited,
  dateLabel,
  editionFor,
  latest,
  matchesResult,
  memberName,
  outcomes,
  suggestion,
  today,
  totals,
  windowOpen,
  offsetDay,
  type Goal,
  type HubData,
  type Publication,
  type Result,
} from "./model";
import {
  Blank,
  recordedAt,
  section,
  sectionUrl,
  Source,
  type Open,
} from "./editorial";

function Numbers({ results }: { results: Result[] }) {
  const total = totals(results);
  return (
    <div className="hub-numbers">
      {outcomes.map((o) => (
        <div key={o}>
          <span>
            {o === "Venda"
              ? "Vendas"
              : o === "Agendamento"
                ? "Agendamentos"
                : "Leads confirmados"}
          </span>
          <strong>{total.count[o]}</strong>
        </div>
      ))}
      <div>
        <span>Valor confirmado</span>
        <strong>
          {results.some((r) => r.goal === "Venda" && r.value !== null)
            ? money(total.revenue)
            : "—"}
        </strong>
      </div>
    </div>
  );
}
function Events({ data, list }: { data: HubData; list: Result[] }) {
  return (
    <div className="hub-rows">
      {list.map((r) => (
        <a
          className="hub-row"
          key={r.id}
          href={sectionUrl(data, "resultados", r.id)}
        >
          <div>
            <b>
              {r.goal} · {r.externalId}
            </b>
            <p>
              {r.source} · {dateLabel(r.date)}{" "}
              {r.value !== null && "· " + money(r.value)}
            </p>
          </div>
          <span className={matchesResult(data, r).issue ? "hub-warn" : ""}>
            {matchesResult(data, r).issue || "Confirmado"}
          </span>
          <ArrowUpRight size={15} />
        </a>
      ))}
    </div>
  );
}
function PublicationDetail({
  data,
  p,
  open,
}: {
  data: HubData;
  p: Publication;
  open: Open;
}) {
  const [message, setMessage] = useState("");
  const e = editionFor(data, p),
    current = latest(data.pieces).find((row) => row.id === p.piece);
  const results = credited(data, p),
    idea = suggestion(data, p);
  const approved = data.feedback.find(
    (f) =>
      f.edition === p.edition && f.piece === p.piece && f.kind === "Aprovação",
  );
  return (
    <>
      <a className="link-action" href={sectionUrl(data, "resultados")}>
        <ArrowLeft size={15} /> Resultados
      </a>
      <header className="hub-detail-header">
        <div>
          <span className="hub-tag">
            {p.published ? "Publicada" : "Preparada"}
          </span>
          <h2>{e?.title || "Publicação"}</h2>
          <p>
            {p.destination} ·{" "}
            {p.published ? dateLabel(p.published) : "Aguardando confirmação"} ·
            v{p.edition}
          </p>
        </div>
        {p.published ? (
          <button
            className="crm-primary"
            onClick={() => open({ type: "result", pub: p })}
          >
            <Plus size={15} />
            Registrar resultado
          </button>
        ) : current?.edition === p.edition ? (
          <button
            className="crm-primary"
            onClick={() => open({ type: "publish", pub: p })}
          >
            Confirmar publicação
          </button>
        ) : (
          <span className="hub-warn">
            A versão foi substituída. Prepare um novo link.
          </span>
        )}
      </header>
      <section className="hub-panel">
        <h3>Link da campanha</h3>
        <code className="hub-code">{p.code}</code>
        <a
          className="hub-track-link link-action"
          href={p.link}
          target="_blank"
          rel="noreferrer"
        >
          {p.link}
        </a>
        <div className="hub-actions">
          <button
            className="crm-secondary"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(p.link);
                setMessage("Link copiado.");
              } catch {
                setMessage("Selecione o endereço acima para copiar.");
              }
            }}
          >
            <Copy size={14} />
            Copiar link
          </button>
          <a
            className="link-action"
            href={
              sectionUrl(data, "editorial", p.piece) + "#edicao-" + p.edition
            }
          >
            Abrir versão aprovada <ArrowUpRight size={14} />
          </a>
        </div>
        {message && <p role="status">{message}</p>}
        {p.published && (
          <p>
            Publicação confirmada · <Source value={p.reference} />
          </p>
        )}
        {approved && (
          <p>
            Aprovação · {memberName(data, approved.author)} ·{" "}
            {recordedAt(approved.at)} · <Source value={approved.proof} />
          </p>
        )}
      </section>
      {data.brand.id === "eba" && p.published && <LinkedPost key={p.id} id={p.id}/>}
      {p.published && (
        <>
          {section(
            "Resultados confirmados",
            idea ? (
              <button
                className="crm-secondary"
                onClick={() => open({ type: "edition", reuse: p })}
              >
                <GitFork size={14} />
                Reaproveitar
              </button>
            ) : null,
          )}
          <Numbers results={results} />
          <p className="hub-muted">
            Janela de comparação · {dateLabel(p.published)} a{" "}
            {dateLabel(offsetDay(p.published, 29))} ·{" "}
            {windowOpen(p) ? "Janela aberta" : "Janela consolidada"}.
          </p>
          {results.length ? (
            <Events data={data} list={results} />
          ) : (
            <p className="hub-muted">
              Nenhum evento confirmado com este código.
            </p>
          )}
        </>
      )}
    </>
  );
}
function EventDetail({
  data,
  result,
  open,
}: {
  data: HubData;
  result: Result;
  open: Open;
}) {
  const hit = matchesResult(data, result),
    p = hit.publication,
    e = p && editionFor(data, p);
  return (
    <>
      <a className="link-action" href={sectionUrl(data, "resultados")}>
        <ArrowLeft size={15} /> Resultados
      </a>
      <header className="hub-detail-header">
        <div>
          <span className="hub-tag">
            {hit.issue ? "Vínculo pendente" : "Vínculo confirmado"}
          </span>
          <h2>
            {result.goal} · {result.externalId}
          </h2>
          <p>
            {dateLabel(result.date)} · {result.source}{" "}
            {result.value !== null && "· " + money(result.value)}
          </p>
        </div>
        <button
          className="crm-secondary"
          onClick={() => open({ type: "result", edit: result })}
        >
          Corrigir evento
        </button>
      </header>
      <section className="hub-panel">
        <h3>Evidência registrada</h3>
        <p>
          Origem · {result.source} · {result.externalId}
        </p>
        <p>Código · {result.code || "Ausente"}</p>
        {p ? (
          <a
            className="link-action"
            href={sectionUrl(data, "resultados", p.id)}
          >
            {e?.title || "Publicação"} · v{p.edition} <ArrowUpRight size={15} />
          </a>
        ) : (
          <p className="hub-warn">{hit.issue}</p>
        )}
      </section>
      {section("Histórico do evento")}
      {data.results
        .filter((r) => r.id === result.id)
        .map((r) => (
          <div className="hub-history-event" key={r.version}>
            <b>{recordedAt(r.at)}</b> · {memberName(data, r.author)}
            <p>
              {dateLabel(r.date)} · {r.source} · {r.code || "Código ausente"}{" "}
              {r.value !== null && "· " + money(r.value)}
            </p>
          </div>
        ))}
    </>
  );
}
export function Evidence({
  data,
  selected,
  open,
}: {
  data: HubData;
  selected: string;
  open: Open;
}) {
  const [goal, setGoal] = useState<Goal>("Agendamento");
  const [view, setView] = useState<"publications" | "pending">("publications");
  const pubs = latest(data.publications),
    results = latest(data.results);
  const publication = pubs.find((p) => p.id === selected),
    event = results.find((r) => r.id === selected);
  if (publication)
    return <PublicationDetail data={data} p={publication} open={open} />;
  if (event) return <EventDetail data={data} result={event} open={open} />;
  const pending = results.filter((r) => matchesResult(data, r).issue),
    valid = results.filter((r) => !matchesResult(data, r).issue);
  const matched = pubs.filter(
    (p) => p.published && editionFor(data, p)?.goal === goal,
  );
  const count = (p: Publication) => totals(credited(data, p, true)).count[goal];
  const mature = matched
    .filter((p) => !windowOpen(p))
    .sort(
      (a, b) => count(b) - count(a) || b.published.localeCompare(a.published),
    );
  const growing = matched
    .filter((p) => windowOpen(p))
    .sort((a, b) => b.published.localeCompare(a.published));
  return (
    <>
      <Numbers results={valid} />
      <div className="hub-tools">
        <div className="crm-switch">
          <button
            aria-pressed={view === "publications"}
            onClick={() => setView("publications")}
          >
            Publicações
          </button>
          <button
            aria-pressed={view === "pending"}
            onClick={() => setView("pending")}
          >
            Vínculos pendentes · {pending.length}
          </button>
        </div>
        <div className="hub-actions">
          <button
            className="crm-secondary"
            onClick={() => open({ type: "csv" })}
          >
            <Upload size={14} />
            Importar CSV
          </button>
          <button
            className="crm-primary"
            onClick={() => open({ type: "result" })}
          >
            <Plus size={15} />
            Registrar resultado
          </button>
        </div>
      </div>
      {view === "pending" ? (
        pending.length ? (
          <Events data={data} list={pending} />
        ) : (
          <Blank title="Nenhum vínculo pendente">
            Eventos sem referência verificável aparecem aqui para conferência.
          </Blank>
        )
      ) : (
        <>
          {section(
            "Comparação em 30 dias",
            <label className="hub-inline-label">
              Objetivo
              <select
                value={goal}
                onChange={(e) => setGoal(e.target.value as Goal)}
              >
                {outcomes.map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
            </label>,
          )}
          <p className="hub-muted">
            Contagem confirmada nos primeiros 30 dias para o objetivo
            selecionado.
          </p>
          {mature.map((p) => (
            <a
              className="hub-row"
              key={p.id}
              href={sectionUrl(data, "resultados", p.id)}
            >
              <b>{editionFor(data, p)?.title}</b>
              <span>
                {count(p)} · {dateLabel(p.published)}
              </span>
              <ArrowUpRight size={15} />
            </a>
          ))}
          {!mature.length && (
            <p className="hub-muted">
              Nenhuma publicação com janela completa para este objetivo.
            </p>
          )}
          {!!growing.length && (
            <>
              <h3 className="hub-subheading">Janelas abertas</h3>
              {growing.map((p) => (
                <a
                  className="hub-row"
                  key={p.id}
                  href={sectionUrl(data, "resultados", p.id)}
                >
                  <b>{editionFor(data, p)?.title}</b>
                  <span>
                    {count(p)} até {dateLabel(today())}
                  </span>
                  <ArrowUpRight size={15} />
                </a>
              ))}
            </>
          )}
          {section("Todas as publicações")}
          {pubs.length ? (
            <div className="hub-rows">
              {pubs.map((p) => (
                <a
                  className="hub-row"
                  key={p.id}
                  href={sectionUrl(data, "resultados", p.id)}
                >
                  <div>
                    <b>{editionFor(data, p)?.title}</b>
                    <p>
                      {p.destination} · {p.code}
                    </p>
                  </div>
                  <span>
                    {p.published ? dateLabel(p.published) : "Preparada"}
                  </span>
                  <ArrowUpRight size={15} />
                </a>
              ))}
            </div>
          ) : (
            <Blank title="Nenhuma publicação registrada">
              Prepare o link a partir de uma peça aprovada.
            </Blank>
          )}
        </>
      )}
    </>
  );
}
