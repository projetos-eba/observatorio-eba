"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  BriefcaseBusiness,
  CalendarDays,
  CheckCheck,
  ChevronRight,
  LayoutDashboard,
  ListFilter,
  Plus,
  Search,
  UsersRound,
} from "lucide-react";
import { CrmForm, type FormKind } from "./forms";
import { Detail } from "./detail";
import { Accounts, Pipeline, Queue, matches, queueGroup } from "./views";
import { type Deal, type State, stages, today, dateLabel } from "./model";
import "./workspace.css";

const views = { hoje: "Hoje", funil: "Funil", contas: "Contas ganhas" };
type View = keyof typeof views;
const symbols = { hoje: CalendarDays, funil: ListFilter, contas: CheckCheck };
function route() {
  const q = new URLSearchParams(location.search),
    v = q.get("vista") || "hoje";
  return {
    view: (Object.hasOwn(views, v) ? v : "hoje") as View,
    deal: q.get("ficha") || "",
  };
}
export default function CrmPage() {
  const [s, setState] = useState<State | null>(null),
    [error, setError] = useState(""),
    [auth, setAuth] = useState(false);
  const [view, setView] = useState<View>("hoje"),
    [selected, select] = useState(""),
    [form, setForm] = useState<FormKind | null>(null);
  const [query, setQuery] = useState(""),
    [mine, setMine] = useState(true),
    [status, setStatus] = useState("Aberto"),
    [stage, setStage] = useState<string>(stages[0]);
  const [queueFilter, setQueueFilter] = useState("");
  const [message, setMessage] = useState(""),
    generation = useRef(0);
  const load = useCallback(async () => {
    const n = ++generation.current;
    try {
      const r = await fetch("/api/crm", { cache: "no-store" });
      if (n !== generation.current) return;
      if (!r.ok) {
        setAuth(r.status === 401);
        if (r.status === 401 || r.status === 403) {
          setState(null);
          setForm(null);
        }
        throw Error(
          r.status === 401
            ? "Entre com sua conta para abrir sua fila."
            : "Não foi possível carregar os dados da equipe.",
        );
      }
      const data = (await r.json()) as State;
      if (n === generation.current) {
        setState(data);
        setAuth(false);
        setError("");
      }
    } catch (e) {
      if (n === generation.current) {
        setError(e instanceof Error ? e.message : "Falha de conexão.");
        throw e;
      }
    }
  }, []);
  useEffect(() => {
    const sync = () => {
      const next = route();
      setView(next.view);
      select(next.deal);
      setForm(null);
    };
    sync();
    document.title = "CRM comercial · EBA Growth";
    const refreshVisible = () => {
      if (document.visibilityState === "visible") load().catch(() => {});
    };
    refreshVisible();
    const timer = window.setInterval(refreshVisible, 60_000);
    window.addEventListener("focus", refreshVisible);
    window.addEventListener("popstate", sync);
    return () => {
      generation.current++;
      window.clearInterval(timer);
      window.removeEventListener("focus", refreshVisible);
      window.removeEventListener("popstate", sync);
    };
  }, [load]);
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(""), 4200);
    return () => clearTimeout(timer);
  }, [message]);
  function change(v: View, id = "", replace = false) {
    const url = new URL(location.href);
    url.search = "";
    if (v !== "hoje") url.searchParams.set("vista", v);
    if (id) url.searchParams.set("ficha", id);
    window.history[replace ? "replaceState" : "pushState"](null, "", url);
    setView(v);
    select(id);
    setForm(null);
  }
  const open = (d: Deal) => change(view, d.id);
  const active = s?.deals.find((d) => d.id === selected);
  const day = today(),
    owned = (s?.deals || []).filter(
      (d) => d.status === "Aberto" && (!mine || d.owner === s?.me),
    );
  const pending = owned.filter((d) => !d.due || d.due <= day);
  const searched = (s?.deals || []).filter((d) => matches(s!, d, query));
  const navigate = (v: View) => {
    setQuery("");
    setQueueFilter("");
    change(v);
    load().catch(() => {});
  };
  const tabs = (Object.keys(views) as View[]).map((v) => {
    const Icon = symbols[v];
    return (
      <a
        key={v}
        href={v === "hoje" ? "/crm" : "/crm?vista=" + v}
        aria-current={view === v ? "page" : undefined}
        onClick={(e) => {
          if (!e.ctrlKey && !e.metaKey && !e.shiftKey) {
            e.preventDefault();
            navigate(v);
          }
        }}
      >
        <Icon size={17} />
        {views[v]}
      </a>
    );
  });
  return (
    <div className="crm-space">
      <a className="skip" href="#crm-main">
        Ir ao conteúdo
      </a>
      <aside className="crm-side">
        <a
          className="brand-link"
          href="/"
          aria-label="EBA Growth, Observatório"
        >
          <span className="brand">
            <span className="brand-eba">
              eba<span>.</span>
            </span>
            <i />
            <span className="brand-growth">GROWTH</span>
          </span>
        </a>
        <nav aria-label="Comercial">
          <span className="eyebrow">CRM comercial</span>
          {tabs}
          <div className="crm-back">
            <a href="/">
              <LayoutDashboard size={17} />
              Observatório
            </a>
          </div>
        </nav>
        <div className="crm-ws">
          <BriefcaseBusiness size={18} />
          <div>
            <b>EBA Aceleradora</b>
            <small>Workspace privado</small>
          </div>
        </div>
      </aside>
      <main id="crm-main" className="crm-main">
        <header className="crm-bar">
          <a href="/" aria-label="Voltar ao Observatório">
            <ArrowLeft size={16} />
            Observatório
          </a>
          <ChevronRight size={13} />
          <b>CRM comercial</b>
          <span>{s?.members.find((x) => x.id === s.me)?.name}</span>
        </header>
        <div className="crm-inner">
          <nav aria-label="Vistas comerciais" className="crm-mobile-nav">
            {tabs}
          </nav>
          <div className="crm-intro">
            <div>
              <span className="eyebrow">
                <span className="crm-light" /> CRM comercial
              </span>
              <h1>
                {views[view]}
                <em>.</em>
              </h1>
              <p>
                {view === "hoje"
                  ? "Sua agenda de conversas e próximos passos."
                  : view === "funil"
                    ? "Acompanhe as negociações, da entrada à decisão."
                    : "Escopo, condições e compromissos de cada venda ganha."}
              </p>
            </div>
            {s && (
              <button className="crm-primary" onClick={() => setForm("create")}>
                <Plus size={16} />
                Nova oportunidade
              </button>
            )}
          </div>
          {auth ? (
            <section className="crm-access" aria-labelledby="crm-access-title">
              <BriefcaseBusiness size={22} />
              <div>
                <h2 id="crm-access-title">Acesso da equipe</h2>
                <p>
                  Entre com a conta convidada para consultar as oportunidades da
                  EBA.
                </p>
              </div>
              <a
                className="crm-primary"
                target="_top"
                href={
                  "/signin-with-chatgpt?return_to=" +
                  encodeURIComponent("/crm" + location.search)
                }
              >
                Entrar no CRM <ArrowUpRight size={15} />
              </a>
            </section>
          ) : (
            error && (
              <div className="crm-error" role="alert">
                {error}{" "}
                <button onClick={() => load().catch(() => {})}>
                  Tentar novamente
                </button>
              </div>
            )
          )}
          {!s && !error && <p role="status">Carregando a equipe…</p>}
          {s && (
            <>
              {view === "hoje" && (
                <div className="crm-pulse">
                  <div>
                    <small>Retornos pendentes</small>
                    <b>{String(pending.length).padStart(2, "0")}</b>
                  </div>
                  {(["Vencidos", "Hoje", "Sem próximo passo"] as const).map(
                    (group) => (
                      <button
                        type="button"
                        key={group}
                        className="pulse-choice"
                        aria-label={"Filtrar: " + group}
                        aria-pressed={queueFilter === group}
                        onClick={() =>
                          setQueueFilter(queueFilter === group ? "" : group)
                        }
                      >
                        <small>
                          {group === "Hoje"
                            ? "Para hoje"
                            : group === "Sem próximo passo"
                              ? "Sem data"
                              : group}
                        </small>
                        <strong
                          className={
                            group === "Vencidos" &&
                            owned.some((d) => queueGroup(d, day) === group)
                              ? "late"
                              : ""
                          }
                        >
                          {
                            owned.filter((d) => queueGroup(d, day) === group)
                              .length
                          }
                        </strong>
                      </button>
                    ),
                  )}
                  <span>
                    <CalendarDays size={15} />
                    {dateLabel(day)}
                  </span>
                </div>
              )}
              <div className="crm-tools">
                {view === "hoje" ? (
                  <div
                    className="crm-switch"
                    role="group"
                    aria-label="Responsável pela fila"
                  >
                    <button aria-pressed={mine} onClick={() => setMine(true)}>
                      Minha fila
                    </button>
                    <button aria-pressed={!mine} onClick={() => setMine(false)}>
                      <UsersRound size={14} />
                      Toda a equipe
                    </button>
                  </div>
                ) : view === "funil" ? (
                  <label className="crm-status">
                    Situação
                    <select
                      aria-label="Situação do negócio"
                      value={status}
                      onChange={(e) => setStatus(e.target.value)}
                    >
                      {["Aberto", "Ganho", "Perdido", "Todos"].map((v) => (
                        <option key={v}>{v}</option>
                      ))}
                    </select>
                  </label>
                ) : (
                  <h2>Carteira de clientes</h2>
                )}
                <label className="crm-search">
                  <Search size={15} />
                  <input
                    aria-label="Buscar no CRM"
                    type="search"
                    placeholder={
                      view === "funil"
                        ? "Empresa, contato ou motivo…"
                        : "Empresa ou contato…"
                    }
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </label>
              </div>
              {view === "hoje" && queueFilter && (
                <div className="queue-filter-note">
                  <span>Exibindo {queueFilter.toLocaleLowerCase("pt-BR")}</span>
                  <button onClick={() => setQueueFilter("")}>
                    Ver fila completa
                  </button>
                </div>
              )}
              {view === "hoje" ? (
                <Queue
                  state={s}
                  list={owned.filter(
                    (d) =>
                      matches(s, d, query) &&
                      (!queueFilter || queueGroup(d, day) === queueFilter),
                  )}
                  open={open}
                  filtered={!!query || !!queueFilter}
                  follow={(d) => {
                    open(d);
                    setForm("return");
                  }}
                />
              ) : view === "funil" ? (
                <Pipeline
                  state={s}
                  list={searched.filter(
                    (d) => status === "Todos" || status === d.status,
                  )}
                  open={open}
                  searching={!!query.trim()}
                  stage={stage}
                  setStage={setStage}
                />
              ) : (
                <Accounts
                  state={s}
                  list={searched.filter((d) => d.status === "Ganho")}
                  open={open}
                />
              )}
              {selected && !active && (
                <p role="alert">
                  Oportunidade não encontrada.{" "}
                  <button onClick={() => change(view)}>Voltar à lista</button>
                </p>
              )}
              {active && (
                <Detail
                  refresh={load}
                  d={active}
                  s={s}
                  close={() => change(view, "", true)}
                  action={setForm}
                />
              )}
              {form && (
                <CrmForm
                  key={form + selected}
                  action={form}
                  deal={form === "create" ? undefined : active}
                  state={s}
                  close={() => setForm(null)}
                  refresh={load}
                  saved={async (id) => {
                    await load();
                    change(view, id, true);
                    setMessage("Alterações salvas.");
                  }}
                />
              )}
            </>
          )}
        </div>
        <footer className="crm-foot">
          EBA Growth <ArrowUpRight size={12} /> Comercial
        </footer>
      </main>
      <div aria-live="polite" className={message ? "crm-toast" : "sr-only"}>
        {message}
      </div>
    </div>
  );
}
