"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, CalendarDays, Layers, Target, UserRound } from "lucide-react";
import { monday } from "./carteira/model";
import { dateLabel, money, offsetDay, today } from "./crm/model";
import { WorkspaceShell } from "./workspace/shell";
import { commitmentAction, returnGoal, type Commitment, type Overview } from "./workspace/overview-model";
import "./crm/workspace.css";
import "./workspace/operation.css";

const pad = (value: number) => String(value).padStart(2, "0");
const periods = [[0, "Esta semana"], [1, "Próxima semana"], [-1, "Semana passada"], [-2, "Há 2 semanas"], [-3, "Há 3 semanas"]] as const;
const shortDate = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "short", timeZone: "UTC" });
const weekLabel = (start: string) => {
  const end = offsetDay(start, 6);
  const label = (date: string) => shortDate.format(new Date(date + "T12:00:00Z"));
  return (start.slice(0, 7) === end.slice(0, 7) ? Number(start.slice(-2)) : label(start)) + " – " + label(end);
};

function AgendaRows({ items, day }: { items: Commitment[]; day: string }) {
  return items.length ? <ul className="operation-list">{items.map((item) =>
    <li key={item.kind + item.id}><a href={item.href}>
      <div><b>{item.date === day ? "Hoje, " : item.date === offsetDay(day, 1) ? "Amanhã, " : ""}{dateLabel(item.date)}</b></div>
      <div><b>{item.title}</b><span>{item.summary}</span></div>
      <ArrowRight size={16} aria-hidden="true" />
    </a></li>
  )}</ul> : <p className="operation-empty">Nenhum compromisso neste período.</p>;
}

export default function Home() {
  const [offset, setOffset] = useState(0);
  const [data, setData] = useState<Overview>();
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const week = offsetDay(monday(today()), offset * 7);
  useEffect(() => {
    function redirectRadar() {
      const legacy = window.location;
      if (legacy.pathname !== "/") return false;
      const query = new URLSearchParams(legacy.search);
      if (!/^#(overview|radar|weekly|compare|tests|insights|history)$/.test(legacy.hash) && !query.has("analise") && !query.has("insight")) return false;
      legacy.replace("/radar" + legacy.search + legacy.hash);
      return true;
    }
    if (redirectRadar()) return;
    window.addEventListener("hashchange", redirectRadar);
    document.title = "Visão geral · EBA Growth";
    const abort = new AbortController();
    fetch("/api/visao-geral?" + new URLSearchParams({ semana: week }), { cache: "no-store", signal: abort.signal })
      .then(async (response) => {
        if (!response.ok) {
          const problem = await response.json() as { error?: string };
          throw Error(problem.error || "Não foi possível carregar a operação.");
        }
        return await response.json() as Overview;
      })
      .then((overview) => { if (!abort.signal.aborted) { setData(overview); setError(""); } })
      .catch((problem) => { if (!abort.signal.aborted) setError(problem.message || "Não foi possível carregar a operação."); });
    return () => {
      abort.abort();
      window.removeEventListener("hashchange", redirectRadar);
    };
  }, [week, retry]);
  const selected = data?.week === week ? data : undefined;
  const percent = selected ? Math.round(selected.returns * 100 / returnGoal) : 0;
  const limit = Math.min(100, percent);
  const agenda = selected?.commitments || [];
  const upcoming = selected ? agenda.filter((item) => offset < 0 || item.date >= selected.today) : [];
  return <WorkspaceShell current="/" name={data?.name}>
    <section className="operation-hero">
      <div className="operation-orbits" aria-hidden="true"><i/><i/><i/><i/><b/><b/><b/></div>
      <div className="operation-hero-content">
        <span className="eyebrow"><span className="crm-light" /> EBA Growth</span>
        <h1>Visão geral<em>.</em></h1>
        <p>Clientes, comercial e operação em um só lugar.</p>
        <a className="operation-action" href="#agenda" onClick={() => setExpanded(true)}>Abrir agenda <ArrowRight size={18} /></a>
      </div>
    </section>
    <section className="operation-pulse" aria-labelledby="pulse-title" aria-busy={!selected && !error}>
      <header>
        <div><h2 id="pulse-title">Pulso da semana</h2><span>{weekLabel(week)}</span></div>
        <label><CalendarDays size={16} aria-hidden="true" /><select aria-label="Semana de referência" value={offset} onChange={(event) => { setError(""); setExpanded(false); setOffset(Number(event.target.value)); }}>
          {periods.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select></label>
      </header>
      {error && <p className="crm-error" role="alert">{error} <button type="button" onClick={() => { setError(""); setRetry(retry + 1); }}>Tentar novamente</button></p>}
      {!selected && !error && <p className="sr-only" role="status">Carregando indicadores da semana…</p>}
      <div className="operation-metrics">
        <div><span><UserRound size={17} />Clientes ativos</span><strong className="operation-accent">{data ? pad(data.clients) : "—"}</strong><small>Carteira atual</small></div>
        <div><span><CalendarDays size={17} />Compromissos da semana</span><strong>{selected ? pad(agenda.length) : "—"}</strong><small>{selected ? agenda.filter((item) => item.date === selected.today).length + " hoje" : "Na semana"}</small></div>
        <div><span><Layers size={17} />Receita recorrente</span><strong className="operation-currency">{data ? money(data.monthly) : "—"}</strong><small>Carteira atual · mensalidades</small></div>
        <div><span><Target size={17} />Meta de retornos</span><div className="operation-goal"><strong>{selected ? pad(selected.returns) : "—"}<small>/{pad(returnGoal)}</small></strong><b>{selected ? percent + "%" : "—"}</b></div><progress aria-label="Progresso da meta de retornos" max={100} value={limit} /></div>
      </div>
    </section>
    <div className="operation-columns">
      <section aria-labelledby="priorities-title">
        <h2 id="priorities-title"><span className="operation-heading-icon"><Target size={20} /></span>Prioridades de hoje</h2>
        {data ? data.priorities.length ? <ul className="operation-list operation-priorities">{data.priorities.map((item) => <li key={item.kind + item.id}>
          <b>{item.title}</b><span>{item.summary}</span><a href={item.href} className={item.kind === "return" ? "crm-primary" : "crm-secondary"}>{commitmentAction[item.kind]}</a>
        </li>)}</ul> : <p className="operation-empty">Nenhuma prioridade para hoje.</p> : !error && <p className="operation-empty">Carregando prioridades…</p>}
        <Link className="operation-action radar-entry" href="/radar#radar">Últimos sinais do Radar <ArrowRight size={17} /></Link>
      </section>
      <section className="operation-agenda" id="agenda" aria-labelledby="agenda-title">
        <h2 id="agenda-title"><CalendarDays size={22} /> {expanded ? "Agenda da semana" : "Próximos compromissos"}</h2>
        {selected ? <AgendaRows items={expanded ? agenda : upcoming.slice(0, 3)} day={selected.today} /> : !error && <p className="operation-empty">Carregando agenda…</p>}
        {!expanded && selected && <button className="operation-action" onClick={() => setExpanded(true)}>Ver agenda <ArrowRight size={17} /></button>}
        {expanded && <button className="operation-action" onClick={() => setExpanded(false)}>Ver próximos <ArrowRight size={17} /></button>}
      </section>
    </div>
  </WorkspaceShell>;
}
