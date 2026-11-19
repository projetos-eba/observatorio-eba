import { useEffect, useState, type ReactNode } from "react";
import {
  ArrowUpRight,
  ArrowLeft,
  CalendarDays,
  ClipboardList,
  ExternalLink,
  Plus,
  RotateCcw,
  Target,
} from "lucide-react";
import {
  agenda,
  dateLabel,
  displayRate,
  forAccount,
  measureFor,
  metricLabel,
  offsetDay,
  pico,
  profileFor,
  rateText,
  reading,
  suggestions,
  templates,
  weekLabel,
  type Account,
  type Decision,
  type Measurement,
  type Minutes,
  type Portfolio,
  type Profile,
  type Signal,
} from "./model";
import type { Modal } from "./forms";

export const nameOf = (data: Portfolio, id: string) =>
  data.members.find((m) => m.id === id)?.name || "Equipe EBA";
export const accountUrl = (company: string) =>
  "/carteira?vista=contas&conta=" + encodeURIComponent(company);
export const radarUrl = (id: string) =>
  "/?analise=" + encodeURIComponent(id) + "#radar";
export const timeLabel = (iso: string) =>
  new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(iso));

export function Blank({
  title,
  text,
  children,
}: {
  title: string;
  text: string;
  children?: React.ReactNode;
}) {
  return (
    <section className="portfolio-blank">
      <ClipboardList size={25} />
      <h2>{title}</h2>
      <p>{text}</p>
      {children}
    </section>
  );
}

export function AgendaList({
  rows,
  data,
  show,
  closed,
}: {
  rows: ReturnType<typeof agenda>;
  data: Portfolio;
  show: (m: Modal) => void;
  closed: boolean;
}) {
  return (
    <div className="agenda-table">
      <div className="agenda-columns" aria-hidden="true">
        <span>Conta</span>
        <span>Evidência e próximo passo</span>
        <span>Decisão</span>
      </div>
      {rows.map((item) => (
        <article className="agenda-row" key={item.company}>
          <div>
            <div className="agenda-reasons">
              {item.reasons.map((reason, i) => (
                <span
                  className={
                    i === 0 && item.priority < 2 ? "agenda-urgent" : ""
                  }
                  key={reason}
                >
                  {reason}
                </span>
              ))}
            </div>
            <a className="portfolio-name" href={accountUrl(item.company)}>
              {item.name}
              <ArrowUpRight size={15} />
            </a>
            <p>
              {item.stage} ·{" "}
              {item.owner ? nameOf(data, item.owner) : "Responsável a definir"}
            </p>
          </div>
          <div className="agenda-evidence">
            <p>{item.observation}</p>
            {item.open.map((d) => (
              <div className="agenda-next" key={d.id}>
                <span>{d.step}</span>
                <small>
                  {nameOf(data, d.owner)} · {dateLabel(d.due)}
                </small>
                <button
                  className="link-action"
                  onClick={() => show({ kind: "review", decision: d })}
                >
                  Revisar decisão
                </button>
              </div>
            ))}
            {!item.open.length && item.decisions.length > 0 && (
              <small>Última decisão · {item.decisions[0].action}</small>
            )}
          </div>
          <div className="agenda-action">
            <button
              className="crm-secondary"
              onClick={() =>
                show({
                  kind: item.profile ? "decision" : "profile",
                  account: data.accounts.find(
                    (a) => a.company === item.company,
                  )!,
                })
              }
            >
              {item.profile
                ? closed
                  ? "Nova decisão"
                  : "Registrar decisão"
                : "Configurar conta"}
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}

export function AccountList({
  data,
  week,
  accounts,
  show,
}: {
  data: Portfolio;
  week: string;
  accounts: Account[];
  show: (m: Modal) => void;
}) {
  return (
    <div className="account-grid">
      {accounts.map((account) => {
        const profile = profileFor(data, account.company);
        const latest = measureFor(data, account.company, week);
        const open = forAccount(data, account.company).filter(
          (d) => d.status === "Aberta",
        ).length;
        return (
          <article className="account-card" key={account.company}>
            <div className="account-card-top">
              <span>
                {profile
                  ? templates[profile.niche].name
                  : "Configuração pendente"}
              </span>
              {profile && <span>{profile.stage}</span>}
            </div>
            <a className="portfolio-name" href={accountUrl(account.company)}>
              {account.name}
              <ArrowUpRight size={17} />
            </a>
            <p>
              {account.contracts[0]?.goal || "Objetivo comercial a definir"}
            </p>
            {profile ? (
              <div className="account-card-value">
                <b>{rateText(reading(latest, profile.metric))}</b>
                <span>Meta {displayRate(profile.target)}</span>
              </div>
            ) : (
              <button
                className="link-action"
                onClick={() => show({ kind: "profile", account })}
              >
                Configurar conta
              </button>
            )}
            <div className="account-card-footer">
              <span>
                {nameOf(
                  data,
                  profile?.owner || account.contracts[0]?.lead || "",
                )}
              </span>
              <span>
                {open} {open === 1 ? "decisão aberta" : "decisões abertas"}
              </span>
            </div>
          </article>
        );
      })}
    </div>
  );
}
export function MeasurementPanel({
  data,
  profile,
  company,
  week,
}: {
  data: Portfolio;
  profile: Profile;
  company: string;
  week: string;
}) {
  const current = measureFor(data, company, week),
    prior = measureFor(data, company, offsetDay(week, -7));
  const value = reading(current, profile.metric),
    old = reading(prior, profile.metric);
  const delta =
    value.rate !== null && old.rate !== null ? value.rate - old.rate : null;
  const steps = templates[profile.niche].steps;
  const funnel = steps.slice(1).map((_, i) => reading(current, i));
  const valid = funnel
    .map((r, i) => ({ rate: r.rate, i }))
    .filter((r): r is { rate: number; i: number } => r.rate !== null);
  const lowest =
    valid.length > 1
      ? valid.reduce((a, b) => (a.rate <= b.rate ? a : b)).i
      : -1;
  const weeks = Array.from({ length: 6 }, (_, i) =>
    offsetDay(week, (i - 5) * 7),
  );
  return (
    <>
      <div className="measure-hero">
        <div>
          <span className="eyebrow">Indicador principal</span>
          <h3>{metricLabel(profile.niche, profile.metric)}</h3>
          <b>{rateText(value)}</b>
          <small>
            {value.value ?? "—"} de {value.base ?? "—"} · Meta{" "}
            {displayRate(profile.target)}
          </small>
        </div>
        <div className="measure-previous">
          <span>Semana anterior</span>
          <strong>{rateText(old)}</strong>
          {delta !== null && (
            <small>
              {delta > 0 ? "+" : ""}
              {delta.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} p.p.
            </small>
          )}
        </div>
      </div>
      <div className="portfolio-funnel">
        {steps.map((step, i) => (
          <div key={step}>
            <span>{step}</span>
            <b>{current?.counts[i]?.toLocaleString("pt-BR") ?? "—"}</b>
            {i > 0 && (
              <small className={i - 1 === lowest ? "late" : ""}>
                {rateText(funnel[i - 1])}
                {i - 1 === lowest && " · Menor avanço"}
              </small>
            )}
          </div>
        ))}
      </div>
      {current && (
        <p className="portfolio-note">
          Fonte {current.source} · {nameOf(data, current.author)} ·{" "}
          {timeLabel(current.at)}
        </p>
      )}
      <div className="portfolio-trend">
        <h3>Últimas seis semanas</h3>
        <div>
          {weeks.map((w) => {
            const r = reading(measureFor(data, company, w), profile.metric);
            return (
              <figure key={w}>
                <b title={rateText(r)}>
                  {r.rate === null ? "—" : displayRate(r.rate)}
                </b>
                <div className="trend-track">
                  <i
                    style={{
                      height:
                        (r.rate === null
                          ? 0
                          : Math.max(3, Math.min(100, r.rate))) + "%",
                    }}
                  />
                </div>
                <figcaption>
                  {dateLabel(w).replace(/ de \d{4}$/, "")}
                </figcaption>
              </figure>
            );
          })}
        </div>
      </div>
      <PortfolioHistory<Measurement> title="Versões anteriores das medições" kind="medicao" filter={company}
        render={(m) => <p>
          {dateLabel(m.week)} · {m.counts.map((n) => n ?? "—").join(" / ")}{" "}
          · {m.source} · {nameOf(data, m.author)} · {timeLabel(m.at)}
        </p>} />
    </>
  );
}

function PortfolioHistory<Row extends { version: number }>({ title, kind, filter, render }: {
  title: string;
  kind: "decisao" | "medicao";
  filter: string;
  render: (row: Row) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<{ entries: Row[]; next: boolean }>();
  const [error, setError] = useState(false);
  useEffect(() => {
    if (!open) return;
    const abort = new AbortController();
    const query = new URLSearchParams({ historico: kind, filtro: filter, pagina: String(page) });
    async function load() {
      setResult(undefined);
      setError(false);
      try {
        const response = await fetch("/api/carteira?" + query, { signal: abort.signal, cache: "no-store" });
        if (!response.ok) throw Error();
        setResult(await response.json());
      } catch {
        if (!abort.signal.aborted) setError(true);
      }
    }
    queueMicrotask(() => { if (!abort.signal.aborted) void load(); });
    return () => abort.abort();
  }, [open, page, kind, filter]);
  return <details className="portfolio-history" onToggle={(event) => setOpen(event.currentTarget.open)}>
    <summary>{title}</summary>
    {error ? <p role="alert">Não foi possível carregar as versões.</p> :
      !result ? <p role="status">Carregando versões…</p> :
      result.entries.length ? result.entries.map((row, i) => <div key={row.version + ":" + i}>{render(row)}</div>) :
      <p>Nenhuma versão neste histórico.</p>}
    {(page > 1 || result?.next) && <div>
      <button className="crm-secondary" disabled={page === 1} onClick={() => setPage(page - 1)}>Anterior</button>{" "}
      <span>Página {page}</span>{" "}
      <button className="crm-secondary" disabled={!result?.next} onClick={() => setPage(page + 1)}>Próxima</button>
    </div>}
  </details>;
}

function DecisionCard({
  d,
  data,
  show,
  history = false,
  signal,
}: {
  d: Decision;
  data: Portfolio;
  show?: (m: Modal) => void;
  history?: boolean;
  signal?: Signal;
}) {
  return (
    <article className="decision-card">
      <div className="decision-head">
        <span>{d.stage}</span>
        <span className={d.status === "Aberta" ? "decision-open" : ""}>
          {d.status}
        </span>
      </div>
      <h3>
        {d.action}
        {d.step && " · " + d.step}
      </h3>
      <p>{d.reason}</p>
      <blockquote>{d.evidence}</blockquote>
      {d.radarId && (
        <a className="link-action" href={radarUrl(d.radarId)}>
          {signal?.title || "Análise do Radar"} <ArrowUpRight size={14} />
        </a>
      )}
      {d.owner && (
        <small>
          {nameOf(data, d.owner)} · Revisão em {dateLabel(d.due)}
        </small>
      )}
      <small>
        Registrado por {nameOf(data, d.author)} · {timeLabel(d.at)}
      </small>
      {d.review && (
        <div className="review-result">
          <strong>{d.review.outcome}</strong>
          <p>{d.review.note}</p>
        </div>
      )}
      {show && <a className="link-action" href={"/conteudo?"+new URLSearchParams({marca:"conta:"+d.company,vista:"editorial",decisao:d.id})}>Criar briefing desta decisão <ArrowUpRight size={14}/></a>}
      {show && d.status === "Aberta" && (
        <button
          className="crm-secondary"
          onClick={() => show({ kind: "review", decision: d })}
        >
          <RotateCcw size={14} />
          Revisar decisão
        </button>
      )}
      {history && <PortfolioHistory<Decision> title="Histórico da decisão" kind="decisao" filter={d.id}
        render={(rev) => <>
          <strong>{timeLabel(rev.at)} · {nameOf(data, rev.author)}</strong>
          <p>{rev.review ? rev.review.outcome + " · " + rev.review.note : rev.reason}</p>
          {rev.step && <small>{rev.step} · {dateLabel(rev.due)}</small>}
        </>} />}
    </article>
  );
}

export function AccountDetail({
  data,
  account,
  week,
  show,
  link,
}: {
  data: Portfolio;
  account: Account;
  week: string;
  show: (m: Modal) => void;
  link: (id: string, linked: boolean) => void;
}) {
  const profile = profileFor(data, account.company);
  const signalMap = new Map(data.signals.map((s) => [s.id, s]));
  const linked = profile?.radarIds || [];
  const related = profile
      ? suggestions(data, profile).filter((s) => !linked.includes(s.id))
      : [],
    decisions = forAccount(data, account.company);
  return (
    <>
      <a className="link-action" href="/carteira?vista=contas">
        <ArrowLeft size={15} /> Todas as contas
      </a>
      {profile && (
        <nav className="account-shortcuts" aria-label="Seções da conta">
          <a href="#indicadores">Indicadores</a>
          <a href="#metodo-pico">Método PICO</a>
          <a href="#analises-radar">Radar</a>
          <a href="#decisoes-conta">Decisões</a>
        </nav>
      )}
      <section className="portfolio-contracts">
        <div className="portfolio-section-head">
          <div>
            <span className="eyebrow">CRM comercial</span>
            <h2>O que foi vendido</h2>
          </div>
          <button
            className="crm-secondary"
            onClick={() => show({ kind: "profile", account })}
          >
            {profile ? "Editar configuração" : "Configurar conta"}
          </button>
        </div>
        {account.contracts.map((c) => (
          <details key={c.id} open={c === account.contracts[0]}>
            <summary>{c.scope || "Escopo do contrato"}</summary>
            <dl>
              <div>
                <dt>Objetivo contratado</dt>
                <dd>{c.goal}</dd>
              </div>
              <div>
                <dt>Primeiro compromisso</dt>
                <dd>
                  {c.first} · {dateLabel(c.date)}
                </dd>
              </div>
              <div>
                <dt>Atendimento</dt>
                <dd>{nameOf(data, c.lead)}</dd>
              </div>
              <div>
                <dt>Condições</dt>
                <dd>{c.terms}</dd>
              </div>
            </dl>
            <a
              className="link-action"
              href={"/crm?vista=contas&ficha=" + encodeURIComponent(c.id)}
            >
              Ver venda no CRM <ArrowUpRight size={14} />
            </a>
          </details>
        ))}
        <p className="portfolio-note">
          ID para importação <code>{account.company}</code>
        </p>
      </section>
      {profile && (
        <>
          <section id="indicadores" className="portfolio-section">
            <div className="portfolio-section-head">
              <div>
                <span className="eyebrow">
                  <CalendarDays size={13} /> {weekLabel(week)}
                </span>
                <h2>Indicadores da conta</h2>
              </div>
              <button
                className="crm-secondary"
                onClick={() => show({ kind: "measure", account })}
              >
                <Plus size={15} />
                Registrar indicadores
              </button>
            </div>
            <MeasurementPanel
              data={data}
              week={week}
              company={account.company}
              profile={profile}
            />
          </section>
          <section id="metodo-pico" className="portfolio-section">
            <div className="portfolio-section-head">
              <h2>Método PICO</h2>
              <span className="portfolio-note">
                {nameOf(data, profile.owner)} · {templates[profile.niche].name}
              </span>
            </div>
            <div className="pico-board">
              {pico.map((stage) => (
                <div
                  key={stage}
                  className={stage === profile.stage ? "pico-active" : ""}
                >
                  <b>{stage}</b>
                  {stage === profile.stage && <small>Em foco</small>}
                  <p>{profile.diagnosis[stage] || "Diagnóstico a registrar"}</p>
                </div>
              ))}
            </div>
          </section>
          <section id="analises-radar" className="portfolio-section">
            <div className="portfolio-section-head">
              <h2>Análises do Radar</h2>
            </div>
            {!linked.length && !related.length && (
              <p className="portfolio-note">
                Nenhuma análise concluída cruza este nicho e a etapa em foco.
              </p>
            )}
            <div className="signal-grid">
              {[
                ...linked.map((id) => ({
                  id,
                  signal: signalMap.get(id),
                  isLinked: true,
                })),
                ...related.map((signal) => ({
                  id: signal.id,
                  signal,
                  isLinked: false,
                })),
              ].map(({ id, signal, isLinked }) => (
                <article className="portfolio-signal" key={id}>
                  <span className="eyebrow">
                    {isLinked
                      ? "Vinculada"
                      : templates[profile.niche].name + " · " + profile.stage}
                  </span>
                  <h3>{signal?.title || "Análise indisponível"}</h3>
                  {signal && (
                    <>
                      <p>{signal.summary}</p>
                      <div className="signal-actions">
                        <a className="link-action" href={radarUrl(id)}>
                          Ver análise <ArrowUpRight size={14} />
                        </a>
                        {signal.url && (
                          <a
                            className="link-action"
                            href={signal.url}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {signal.source || "Fonte"}{" "}
                            <ExternalLink size={13} />
                          </a>
                        )}
                      </div>
                    </>
                  )}
                  <div className="signal-actions">
                    <button
                      className="crm-secondary"
                      onClick={() => link(id, !isLinked)}
                    >
                      {isLinked ? "Desvincular" : "Vincular à conta"}
                    </button>
                    {signal && (
                      <button
                        className="link-action"
                        onClick={() =>
                          show({ kind: "decision", account, radarId: id })
                        }
                      >
                        Usar em decisão
                      </button>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </section>
          <section id="decisoes-conta" className="portfolio-section">
            <div className="portfolio-section-head">
              <h2>Decisões e revisões</h2>
              <button
                className="crm-primary"
                onClick={() => show({ kind: "decision", account })}
              >
                <Plus size={15} />
                Registrar decisão
              </button>
            </div>
            {decisions.length ? (
              <div className="decision-grid">
                {decisions.map((d) => (
                  <DecisionCard
                    key={d.id}
                    d={d}
                    data={data}
                    signal={signalMap.get(d.radarId)}
                    show={show}
                    history
                  />
                ))}
              </div>
            ) : (
              <p className="portfolio-note">
                Nenhuma decisão registrada para esta conta.
              </p>
            )}
          </section>
        </>
      )}
    </>
  );
}

export function Archive({
  data,
  minutes,
}: {
  data: Portfolio;
  minutes?: Minutes;
}) {
  if (!data.minutes.length)
    return (
      <Blank
        title="Nenhuma ata fechada"
        text="A ata aparece aqui depois de fechar a pauta da semana."
      />
    );
  if (!minutes)
    return (
      <div className="archive-list">
        {data.minutes.map((m) => (
          <a key={m.week} href={"/carteira?vista=atas&ata=" + m.week}>
            <ClipboardList size={20} />
            <div>
              <b>{weekLabel(m.week)}</b>
              <p>
                {m.items.length} {m.items.length === 1 ? "conta" : "contas"} ·{" "}
                {m.participants.join(", ")}
              </p>
            </div>
            <ArrowUpRight size={17} />
          </a>
        ))}
      </div>
    );
  return (
    <>
      <a className="link-action" href="/carteira?vista=atas">
        <ArrowLeft size={15} /> Todas as atas
      </a>
      <div className="archive-meta">
        <h2>{weekLabel(minutes.week)}</h2>
        <p>
          Fechada por {minutes.author} · {timeLabel(minutes.at)}
        </p>
        <p>Participantes · {minutes.participants.join(", ")}</p>
      </div>
      {minutes.items.map((item) => (
        <section className="archive-item" key={item.company}>
          <header>
            <h3>{item.name}</h3>
            <span>
              {item.disposition} · {item.stage}
            </span>
          </header>
          <p>{item.reasons.join(" · ")}</p>
          <p>{item.observation}</p>
          {item.profile && item.measurement && (
            <p className="portfolio-note">
              {weekLabel(item.measurement.week)} ·{" "}
              {item.measurement.counts.map((n) => n ?? "—").join(" / ")} · Fonte{" "}
              {item.measurement.source}
            </p>
          )}
          {item.prior && (
            <p className="portfolio-note">
              Referência anterior · {weekLabel(item.prior.week)} ·{" "}
              {item.prior.counts.map((n) => n ?? "—").join(" / ")} · Fonte{" "}
              {item.prior.source}
            </p>
          )}
          {item.decisions.map((d) => (
            <DecisionCard key={d.id} d={d} data={data} />
          ))}
        </section>
      ))}
    </>
  );
}
