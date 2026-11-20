"use client";

import { useEffect, useState, type MouseEvent } from "react";
import { ArrowRight, ArrowUpRight, Plus } from "lucide-react";
import { editionFor, type HubData } from "../conteudo/model";
import { businessDay } from "../crm/model";
import { validDate } from "./csv";
import type { Modal } from "./forms";
import {
  dateLabel, displayRate, forAccount, metricLabel, monday, offsetDay, pico,
  profileFor, rateText, reading, today, weekLabel,
  type Account, type Decision, type HistoryEvent, type Measurement, type Portfolio, type Profile,
} from "./model";
import { AccountPlan, DecisionCard, MeasurementPanel, accountUrl, nameOf } from "./views";

const tabs = {
  geral: "Visão geral", plano: "Plano PICO", resultados: "Resultados", conteudo: "Conteúdo", historico: "Histórico",
};
const timelineDate = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "short", timeZone: "America/Sao_Paulo" });
type Tab = keyof typeof tabs;

function readLocation() {
  const query = new URLSearchParams(window.location.search);
  const anchor = window.location.hash.slice(1);
  const requested = query.get("aba") || "";
  const tab = Object.hasOwn(tabs, requested) ? requested as Tab :
    /^(decisao-|decisoes-conta$|metodo-pico$|analises-radar$)/.test(anchor) ? "plano" :
    /^(medicao-|indicadores$)/.test(anchor) ? "resultados" : "geral";
  const week = query.get("semana") || "";
  const version = Number(query.get("versao"));
  return {
    tab, anchor, week: validDate(week) && monday(week) === week ? week : "",
    version: Number.isSafeInteger(version) && version > 0 ? version : 0,
  };
}

export function openCustomerTab(href: string) {
  window.history.pushState(null, "", href);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

function followTab(event: MouseEvent<HTMLAnchorElement>) {
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
  event.preventDefault();
  openCustomerTab(event.currentTarget.href);
}

function useSource<T>(url: string) {
  const [attempt, retry] = useState(0);
  const [state, setState] = useState<{ url: string; data?: T; error?: boolean }>();
  useEffect(() => {
    if (!url) return;
    const abort = new AbortController();
    async function load() {
      try {
        const response = await fetch(url, { signal: abort.signal, cache: "no-store" });
        if (!response.ok) throw Error();
        const data = await response.json() as T;
        if (!abort.signal.aborted) setState({ url, data });
      } catch {
        if (!abort.signal.aborted) setState({ url, error: true });
      }
    }
    void load();
    return () => abort.abort();
  }, [url, attempt]);
  return { ...(state?.url === url ? state : {}), retry: () => { setState(undefined); retry(attempt + 1); } };
}

function LoadingSource({ error, retry, label }: { error?: boolean; retry: () => void; label: string }) {
  return error ? <p className="crm-error" role="alert">Não foi possível abrir {label}. <button onClick={retry}>Tentar novamente</button></p> :
    <p className="operation-empty" role="status">Carregando {label}…</p>;
}

function metricCounts(measure: Measurement, profile: Profile) {
  const { base, value } = reading(measure, profile.metric);
  const [from] = metricLabel(profile.niche, profile.metric).split(" → ");
  return base === null || value === null ? "Contagem incompleta" :
    value.toLocaleString("pt-BR") + " de " + base.toLocaleString("pt-BR") + " " + from.toLocaleLowerCase("pt-BR");
}

function SalesHandoff({ account, data }: { account: Account; data: Portfolio }) {
  if (!account.contracts.length) return <section className="customer-panel">
    <h2>Passagem para atendimento</h2><p className="operation-empty">Nenhuma passagem registrada para esta conta.</p>
  </section>;
  const [contract, ...others] = account.contracts;
  function fields(item: Account["contracts"][number]) {
    return <>
      <dl className="customer-handoff">
        <div><dt>Escopo</dt><dd>{item.scope || "A definir"}</dd></div>
        <div><dt>Responsável</dt><dd>{nameOf(data, item.lead)}</dd></div>
        <div><dt>Primeiro compromisso</dt><dd>{item.first || "A definir"}{item.date && <> · {dateLabel(item.date)}</>}</dd></div>
      </dl>
      <a className="operation-action" href={item.proposalUrl || "/crm?vista=contas&ficha=" + encodeURIComponent(item.id)}
        target={item.proposalUrl ? "_blank" : undefined} rel={item.proposalUrl ? "noreferrer" : undefined}>
        {item.proposalUrl ? "Ver proposta aceita" : "Ver venda no CRM"} <ArrowRight size={16} />
      </a>
      {(item.goal || item.terms) && <details className="customer-conditions">
        <summary>Objetivo e condições</summary>{item.goal && <p>{item.goal}</p>}{item.terms && <p>{item.terms}</p>}
      </details>}
    </>;
  }
  return <section className="customer-panel">
    <h2>Passagem para atendimento</h2>{fields(contract)}
    {others.map((item) => <details key={item.id} className="customer-conditions">
      <summary>{item.scope || "Outra venda"}</summary>{fields(item)}
    </details>)}
  </section>;
}

function History({ company, data, compact }: { company: string; data: Portfolio; compact?: boolean }) {
  const [page, setPage] = useState(1);
  const source = useSource<{ entries: HistoryEvent[]; next: boolean }>(
    "/api/carteira?" + new URLSearchParams({ linha: company, pagina: String(page), revisao: String(data.version) }),
  );
  function origin(item: HistoryEvent) {
    if (item.kind === "crm") return "/crm?" + new URLSearchParams({ vista: "contas", ficha: item.record, evento: item.id });
    const common = accountUrl(company) + "&versao=" + item.version;
    return item.kind === "medicao"
      ? common + "&aba=resultados&semana=" + item.record + "#medicao-" + item.record
      : common + "&aba=plano#decisao-" + item.record;
  }
  const rows = source.data?.entries.slice(0, compact ? 3 : 15);
  return <section className="customer-panel">
    <h2>{compact ? "Histórico recente" : "Histórico da conta"}</h2>
    {!rows ? <LoadingSource {...source} label="o histórico" /> : rows.length ? <ul className="customer-timeline">
      {rows.map((item) => <li key={item.kind + item.id + item.version}>
        <a href={origin(item)} onClick={item.kind === "crm" ? undefined : followTab}>
          <time dateTime={item.at} title={dateLabel(businessDay(new Date(item.at)))}>{timelineDate.format(new Date(item.at))}</time>
          <span>{item.title}{!compact && <small>{nameOf(data, item.author)}</small>}</span>
          <ArrowUpRight size={15} aria-hidden="true" />
        </a>
      </li>)}
    </ul> : <p className="operation-empty">Nenhum evento registrado.</p>}
    {compact ? <a className="operation-action" href={accountUrl(company) + "&aba=historico"} onClick={followTab}>Ver histórico <ArrowRight size={16} /></a> :
      <div className="funnel-pages">
        {page > 1 && <button className="crm-secondary" onClick={() => setPage(page - 1)}>Página anterior</button>}
        {source.data?.next && <button className="crm-secondary" onClick={() => setPage(page + 1)}>Próxima página</button>}
      </div>}
  </section>;
}

function Content({ company }: { company: string }) {
  const mark = "conta:" + company;
  const source = useSource<HubData>("/api/conteudo?" + new URLSearchParams({ marca: mark }));
  const editorial = "/conteudo?" + new URLSearchParams({ marca: mark, vista: "editorial" });
  return <section className="customer-panel">
    <header className="customer-panel-head"><h2>Conteúdo da marca</h2>
      <a className="operation-action" href={editorial}>Abrir Hub <ArrowRight size={16} /></a>
    </header>
    {!source.data ? <LoadingSource {...source} label="o espaço editorial" /> :
      source.data.pieces.length ? <ul className="customer-timeline">
        {source.data.pieces.map((piece) => {
          const edition = editionFor(source.data!, piece);
          return edition && <li key={piece.id}><a href={editorial + "&id=" + encodeURIComponent(piece.id)}>
            <time dateTime={edition.due || undefined}>{dateLabel(edition.due)}</time>
            <span>{edition.title}<small>{piece.status} · {edition.channel}</small></span><ArrowUpRight size={15} />
          </a></li>;
        })}
      </ul> : <p className="operation-empty">{source.data.brand.active ? "Nenhuma peça editorial nesta marca." : "Ative o espaço editorial no Hub para registrar as peças desta marca."}</p>}
  </section>;
}

export function CustomerProfile({ account, data, show, link }: {
  account: Account; data: Portfolio; show: (form: Modal) => void; link: (id: string, linked: boolean) => void;
}) {
  const [location, setLocation] = useState(readLocation);
  const baseUrl = accountUrl(account.company);
  const profile = profileFor(data, account.company);
  const measurements = data.measurements.filter((m) => m.company === account.company).sort((a, b) => b.week.localeCompare(a.week));
  const latest = measurements[0];
  const lastClosed = offsetDay(monday(today()), -7);
  const week = location.week || latest?.week || lastClosed;
  const decisions = forAccount(data, account.company);
  const next = decisions.filter((d) => d.status === "Aberta" && d.due)
    .sort((a, b) => a.due.localeCompare(b.due))[0];
  const selectedMeasurement = measurements.find((m) => m.week === week);
  const selectedDecision = decisions.find((d) => "decisao-" + d.id === location.anchor);
  const historicalMeasurement = location.tab === "resultados" && location.version && selectedMeasurement?.version !== location.version;
  const historicalDecision = location.tab === "plano" && location.version && selectedDecision && selectedDecision.version !== location.version;
  const snapshot = useSource<Measurement | Decision>(historicalMeasurement || historicalDecision ? "/api/carteira?" + new URLSearchParams({
    registro: historicalMeasurement ? "medicao" : "decisao", conta: account.company,
    chave: historicalMeasurement ? week : selectedDecision!.id, versao: String(location.version),
  }) : "");
  const activeMeasurement = historicalMeasurement ? snapshot.data as Measurement | undefined : selectedMeasurement;
  const contract = account.contracts[0];
  const rate = profile && reading(latest, profile.metric);
  const progress = profile && rate && rate.rate !== null ? profile.target === 0 ? 100 : rate.rate / profile.target * 100 : null;
  const measureUrl = (period: string, version?: number) => baseUrl + "&aba=resultados&semana=" + period +
    (version ? "&versao=" + version : "") + "#medicao-" + period;
  const measure = () => show(profile ? { kind: "measure", account, week: location.tab === "resultados" ? week : lastClosed } : { kind: "profile", account });
  const initials = account.name.trim().split(/\s+/).slice(0, 2).map((word) => word[0]).join("").toUpperCase();

  useEffect(() => {
    const sync = () => setLocation(readLocation());
    window.addEventListener("popstate", sync);
    window.addEventListener("hashchange", sync);
    return () => {
      window.removeEventListener("popstate", sync);
      window.removeEventListener("hashchange", sync);
    };
  }, []);
  useEffect(() => {
    if (!location.anchor || ((historicalMeasurement || historicalDecision) && !snapshot.data)) return;
    const target = document.getElementById(historicalDecision ? "customer-decision-version" : location.anchor);
    target?.scrollIntoView({ block: "start" });
    target?.focus({ preventScroll: true });
  }, [location.anchor, location.tab, historicalMeasurement, historicalDecision, snapshot.data]);

  return <div className="portfolio customer-profile">
    <header className="customer-profile-head">
      <div className="customer-initials" aria-hidden="true">{initials}</div>
      <div>
        <h1>{account.name}<em>.</em></h1>
        <p><span><i className="crm-light" /> Cliente ativo</span>
          <span>{contract ? nameOf(data, profile?.owner || contract.lead) : "EBA Growth"}</span>
          {contract && <a href={"/crm?vista=contas&ficha=" + encodeURIComponent(contract.id)}>Ver origem no CRM <ArrowUpRight size={15} /></a>}
        </p>
      </div>
      <button className="crm-primary" onClick={measure}><Plus size={18} /> {profile ? "Registrar medição" : "Configurar indicador"}</button>
    </header>
    <nav className="operation-crm-tabs customer-tabs" aria-label="Seções da ficha do cliente">
      {(Object.keys(tabs) as Tab[]).map((tab) => <a key={tab} href={baseUrl + (tab === "geral" ? "" : "&aba=" + tab)}
        aria-current={location.tab === tab ? "page" : undefined} onClick={followTab}>{tabs[tab]}</a>)}
    </nav>
    {location.tab === "geral" && <div className="customer-columns">
      <div>
        <section className="customer-panel customer-target">
          <header className="customer-panel-head">
            <h2>Meta de 90 dias</h2>
            {latest && <div><span>{weekLabel(latest.week)}</span>
              <a className="operation-action" href={measureUrl(latest.week)} onClick={followTab}>Ver medição <ArrowRight size={16} /></a>
            </div>}
          </header>
          {profile ? <>
            <div className="customer-reading">
              <strong className={rate?.rate == null ? "customer-no-rate" : ""}>{rate ? rateText(rate) : "Sem dado"}</strong>
              <span>{metricLabel(profile.niche, profile.metric)}</span>
              {latest && <small>{metricCounts(latest, profile)}</small>}
            </div>
            {progress !== null && <progress aria-label="Progresso da medição semanal até a meta de 90 dias" max={100} value={Math.min(progress, 100)} />}
            <footer><span>{progress === null ? "Aguardando medição com base válida" : displayRate(progress) + " da meta"}</span><span>Meta {displayRate(profile.target)}</span></footer>
          </> : <p className="operation-empty">Defina o indicador e a meta no Plano PICO para começar a acompanhar a conta.</p>}
        </section>
        <section className="customer-panel customer-pico">
          <h2>Método PICO</h2>
          <ol>{pico.map((stage) => <li key={stage} aria-current={profile?.stage === stage ? "step" : undefined}>{stage}</li>)}</ol>
          {next ? <div className="customer-next">
            <strong>{next.step}</strong><span>Revisão em {dateLabel(next.due)}</span>
            <a className="operation-action" href={baseUrl + "&aba=plano#decisao-" + next.id} onClick={followTab}>Abrir decisão <ArrowRight size={16} /></a>
          </div> : <p className="operation-empty">Nenhuma revisão agendada. <a className="operation-action" href={baseUrl + "&aba=plano"} onClick={followTab}>Abrir plano <ArrowRight size={15} /></a></p>}
        </section>
      </div>
      <div><SalesHandoff account={account} data={data} /><History company={account.company} data={data} compact /></div>
    </div>}
    {location.tab === "plano" && <div className="customer-tab-body">
      {historicalDecision && <section className="customer-panel">
        <h2>Versão histórica da decisão</h2>
        {snapshot.data ? <DecisionCard d={snapshot.data as Decision} data={data} anchor="customer-decision-version" /> :
          <LoadingSource {...snapshot} label="a versão da decisão" />}
      </section>}
      <AccountPlan account={account} data={data} show={show} link={link} />
    </div>}
    {location.tab === "resultados" && <section className="customer-panel customer-tab-body" id="indicadores" tabIndex={-1}>
      <header className="customer-panel-head"><h2>Indicadores da conta</h2>
        {profile && <label>Semana <select value={week} onChange={(event) => openCustomerTab(measureUrl(event.target.value))}>
          {[...new Set([week, lastClosed, ...measurements.map((m) => m.week)])].sort().reverse().map((period) =>
            <option key={period} value={period}>{weekLabel(period)}</option>)}
        </select></label>}
      </header>
      {!profile ? <p className="operation-empty">Configure o indicador da conta antes de registrar a primeira medição.</p> : <>
        {historicalMeasurement && !snapshot.data ? <LoadingSource {...snapshot} label="a versão da medição" /> :
          <div id={"medicao-" + week} tabIndex={-1}>
            {activeMeasurement && <div className="customer-measure-action">
              <span>Versão {activeMeasurement.version}{historicalMeasurement ? " · Histórica" : ""}</span>
              <button className="crm-secondary" onClick={() => show({ kind: "decision", account, measurement: activeMeasurement })}>
                <Plus size={16} /> Criar decisão PICO
              </button>
            </div>}
            {!activeMeasurement && <p className="operation-empty">Nenhuma medição registrada para esta semana.</p>}
            <MeasurementPanel data={data} profile={profile} company={account.company} week={week} measurement={activeMeasurement} />
          </div>}
      </>}
    </section>}
    {location.tab === "conteudo" && <Content company={account.company} />}
    {location.tab === "historico" && <History company={account.company} data={data} />}
  </div>;
}
