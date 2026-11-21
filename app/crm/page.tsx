"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, ArrowUpRight, BriefcaseBusiness, Plus, Search, UsersRound } from "lucide-react";
import { WorkspaceShell } from "../workspace/shell";
import { CrmForm, type FormKind } from "./forms";
import { Detail } from "./detail";
import { Pipeline, Queue, amount, dealName, matches, queueGroup, memberName } from "./views";
import { CompletedSales, JourneyBoard } from "./journey";
import { type Deal, type DealStage, type State, stages, today } from "./model";
import { Reactivation } from "./reactivation";
import "./workspace.css";
import "../workspace/operation.css";
import "./funnel.css";
import "./journey.css";

const views = { hoje: "Hoje", funil: "Funil", jornada: "Jornada" };
type View = keyof typeof views;
type JourneySection = "kanban" | "concluidas";
const emptyJourneyFilters = { origem: "", responsavel: "", proximo: "" };
type JourneyFilters = typeof emptyJourneyFilters;
type MoveRequest = { deal: Deal; stage: DealStage; requestId: string };
type MoveIssue = { message: string; retry?: MoveRequest };
const queueGroups = ["Vencidos", "Hoje", "Sem próximo passo"];
function route() {
  const q = new URLSearchParams(location.search),
    v = q.get("vista") || "hoje";
  return {
    view: (v === "contas" ? "jornada" : Object.hasOwn(views, v) ? v : "hoje") as View,
    journeySection: (v === "contas" || q.get("secao") === "concluidas" ? "concluidas" : "kanban") as JourneySection,
    journeyFilters: {
      origem: q.get("origem") || "",
      responsavel: q.get("responsavel") || "",
      proximo: ["missing", "defined"].includes(q.get("proximo") || "") ? q.get("proximo")! : "",
    },
    deal: q.get("ficha") || "",
    event: q.get("evento") || "",
    stage: stages.find((item) => item === q.get("etapa")) || "",
    query: q.get("busca") || "",
    action: q.get("acao"),
  };
}
export default function CrmPage() {
  const [s, setState] = useState<State | null>(null),
    [error, setError] = useState(""),
    [auth, setAuth] = useState(false);
  const [view, setView] = useState<View>("hoje"),
    [selected, select] = useState(""),
    [eventId, setEventId] = useState(""),
    [form, setForm] = useState<FormKind | null>(null);
  const [query, setQuery] = useState(""),
    [mine, setMine] = useState(true),
    [status, setStatus] = useState("Aberto"),
    [stage, setStage] = useState<string>("");
  const [queueFilter, setQueueFilter] = useState("");
  const [origin, setOrigin] = useState("");
  const [owner, setOwner] = useState("");
  const [nextFilter, setNextFilter] = useState("");
  const [journeySection, setJourneySection] = useState<JourneySection>("kanban");
  const [journeyFilters, setJourneyFilters] = useState(emptyJourneyFilters);
  const [moving, setMoving] = useState<ReadonlySet<string>>(() => new Set());
  const [moveIssue, setMoveIssue] = useState<MoveIssue>();
  const activeMoves = useRef(new Set<string>());
  const moveReceipts = useRef(new Map<string, MoveRequest>());
  const [message, setMessage] = useState(""),
    generation = useRef({ version: 0 });
  const load = useCallback(async () => {
    const n = ++generation.current.version;
    try {
      const r = await fetch("/api/crm", { cache: "no-store" });
      if (n !== generation.current.version) return;
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
      if (n === generation.current.version) {
        setState(data);
        setAuth(false);
        setError("");
      }
    } catch (e) {
      if (n === generation.current.version) {
        setError(e instanceof Error ? e.message : "Falha de conexão.");
        throw e;
      }
    }
  }, []);
  useEffect(() => {
    const sync = () => {
      const next = route();
      setView(next.view);
      setJourneySection(next.journeySection);
      setJourneyFilters(next.journeyFilters);
      select(next.deal);
      setEventId(next.event);
      setStage(next.stage);
      setQuery(next.query);
      if (next.query) setMine(false);
      setForm(next.action === "nova" ? "create" : next.action === "retorno" && next.deal ? "return" : null);
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
    const requests = generation.current;
    return () => {
      requests.version++;
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
  function change(v: View, id = "", replace = false, filter = stage, activity = "", section = journeySection) {
    const url = new URL(location.href);
    url.search = "";
    if (url.hash) url.hash = "";
    if (v !== "hoje") url.searchParams.set("vista", v);
    if (id) url.searchParams.set("ficha", id);
    if (id && activity) url.searchParams.set("evento", activity);
    if (v === "funil" && filter) url.searchParams.set("etapa", filter);
    if (v === "jornada") {
      if (section === "concluidas") url.searchParams.set("secao", section);
      for (const [key, value] of Object.entries(journeyFilters)) {
        if (value) url.searchParams.set(key, value);
      }
    }
    if (query) url.searchParams.set("busca", query);
    window.history[replace ? "replaceState" : "pushState"](null, "", url);
    setView(v);
    setJourneySection(section);
    setStage(v === "funil" ? filter : "");
    select(id);
    setEventId(activity);
    setForm(null);
  }
  function updateSearch(value: string) {
    setQuery(value);
    const url = new URL(location.href);
    if (value) url.searchParams.set("busca", value);
    else url.searchParams.delete("busca");
    window.history.replaceState(null, "", url);
  }
  function updateJourney(filters: JourneyFilters) {
    setJourneyFilters(filters);
    const url = new URL(location.href);
    for (const [key, value] of Object.entries(filters)) {
      if (value) url.searchParams.set(key, value);
      else url.searchParams.delete(key);
    }
    window.history.replaceState(null, "", url);
  }
  async function sendMove(request: MoveRequest) {
    const { deal, stage, requestId } = request;
    if (activeMoves.current.has(deal.id)) return false;
    activeMoves.current.add(deal.id);
    setMoving(new Set(activeMoves.current));
    setMoveIssue(undefined);
    try {
      const response = await fetch("/api/crm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "edit", deal: deal.id, revision: deal.revision, requestId, values: { stage } }),
      });
      if (!response.ok) {
        if (response.status >= 500) {
          setMoveIssue({ message: "Não foi possível confirmar a mudança de etapa. Tente novamente.", retry: request });
          return false;
        }
        moveReceipts.current.delete(deal.id);
        const result = await response.json().catch(() => ({})) as { error?: string };
        if (response.status === 409) {
          setMoveIssue({ message: "A oportunidade mudou em outra sessão. Confira a etapa atual antes de tentar novamente." });
        } else {
          setMoveIssue({ message: result.error || "Não foi possível mudar a etapa." });
        }
        if ([401, 403, 404, 409].includes(response.status)) await load().catch(() => {});
        return false;
      }
      moveReceipts.current.delete(deal.id);
      try {
        await load();
      } catch {
        setMoveIssue({ message: "A mudança foi salva. Atualize o CRM para conferir a etapa." });
        return false;
      }
      setMessage((s ? dealName(s, deal) : "Oportunidade") + " movida para " + stage + ".");
      return true;
    } catch {
      setMoveIssue({ message: "A conexão falhou antes da confirmação. Tente novamente para conferir a mudança.", retry: request });
      return false;
    } finally {
      activeMoves.current.delete(deal.id);
      setMoving(new Set(activeMoves.current));
    }
  }
  function moveDeal(deal: Deal, target: DealStage) {
    const previous = moveReceipts.current.get(deal.id);
    if (previous && previous.stage === target && previous.deal.revision === deal.revision) return sendMove(previous);
    if (activeMoves.current.has(deal.id) || deal.status !== "Aberto" || deal.stage === target) return Promise.resolve(false);
    const request = { deal, stage: target, requestId: crypto.randomUUID() };
    moveReceipts.current.set(deal.id, request);
    return sendMove(request);
  }
  const open = (d: Deal) => change(view, d.id);
  const schedule = (d: Deal) => { open(d); setForm("schedule"); };
  const active = s?.deals.find((d) => d.id === selected);
  const day = today();
  const openDeals = (s?.deals || []).filter((d) => d.status === "Aberto");
  const owned = openDeals.filter((d) => !mine || d.owner === s?.me);
  const searched = (s?.deals || []).filter((d) => matches(s!, d, query));
  const origins = [...new Set(["Ex-cliente", ...(s?.deals || []).map((d) => d.source).filter(Boolean)])].sort();
  const originMatches = (d: Deal) => !origin || d.source === origin;
  const commercial = view === "funil" ? openDeals.filter(originMatches) : openDeals;
  const funnelList = searched.filter((d) =>
    originMatches(d) && (status === "Todos" || status === d.status) &&
    (!stage || stage === d.stage) && (!owner || d.owner === owner) &&
    (!nextFilter || (nextFilter === "missing" ? !d.next || !d.due : !!d.next && !!d.due)));
  const journeyList = searched.filter((deal) => deal.status === "Aberto" &&
    (!journeyFilters.origem || deal.source === journeyFilters.origem) &&
    (!journeyFilters.responsavel || deal.owner === journeyFilters.responsavel) &&
    (!journeyFilters.proximo || (queueGroup(deal, day) === "Sem próximo passo") === (journeyFilters.proximo === "missing")));
  const journeyOrigin = origins.includes(journeyFilters.origem) || !journeyFilters.origem;
  const journeyOwner = s?.members.some(({ id }) => id === journeyFilters.responsavel) || !journeyFilters.responsavel;
  const stageAmounts = stages.map((name) => ({ name, count: commercial.filter((d) => d.stage === name).length }));
  const scale = Math.max(1, ...stageAmounts.map((item) => item.count));
  function funnel(filter = "") {
    setStatus("Aberto");
    change("funil", "", false, filter);
  }
  function closeForm() {
    const url = new URL(location.href);
    if (url.searchParams.has("acao")) {
      url.searchParams.delete("acao");
      window.history.replaceState(null, "", url);
    }
    setForm(null);
  }
  return (
    <WorkspaceShell current="/crm" name={s?.members.find((member) => member.id === s.me)?.name}
      search={query} setSearch={(value) => { updateSearch(value); if (value) setMine(false); }}>
          <div className={"crm-intro operation-crm-intro" + (view === "funil" ? " funnel-intro" : "")}>
            <h1>CRM comercial<em>.</em></h1>
            {s && <button className="crm-primary" onClick={() => setForm("create")}><Plus size={18} /> Nova oportunidade</button>}
          </div>
          <nav aria-label="Vistas comerciais" className="operation-crm-tabs">
            {(Object.keys(views) as View[]).map((v) => <button key={v} type="button"
              aria-current={view === v ? "page" : undefined}
              onClick={() => v === "funil" ? funnel(stage) : change(v, "", false, stage, "", view === "jornada" ? journeySection : "kanban")}>{views[v]}</button>)}
          </nav>
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
              {view === "funil" && <div className="funnel-origin">
                <label>Origem <select value={origin} onChange={(e) => setOrigin(e.target.value)}>
                  <option value="">Todas</option>{origins.map((item) => <option key={item}>{item}</option>)}
                </select></label>
                <button className="crm-secondary" type="button" aria-pressed={origin === "Ex-cliente"} onClick={() => setOrigin(origin === "Ex-cliente" ? "" : "Ex-cliente")}>
                  <UsersRound size={16} /> Ex-cliente
                </button>
                <label className="funnel-status">Situação <select value={status} onChange={(e) => setStatus(e.target.value)}>
                  {["Aberto", "Ganho", "Perdido", "Todos"].map((v) => <option key={v}>{v}</option>)}
                </select></label>
              </div>}
              {view === "funil" && <a className="operation-action funnel-mobile-jump" href="#crm-results">Ver próximos passos <ArrowRight size={15} /></a>}
              {view !== "jornada" && <section className={"operation-commercial" + (view === "funil" ? " funnel-summary" : "")} aria-label="Oportunidades abertas">
                <div className="operation-revenue">
                  <h2 className="eyebrow">{view === "funil" ? "Recorrente em negociação" : "Receita recorrente em aberto"}</h2>
                  <strong>{amount(commercial, "monthly").replace(/,00$/, "")}{commercial.some((d) => d.monthly !== null) || !commercial.length ? <small>/mês</small> : null}</strong>
                  <p>{amount(commercial, "once").replace(/,00$/, "")} em projetos pontuais</p>
                </div>
                <div className="operation-funnel">
                  <header><h2 className="eyebrow">Oportunidades por etapa</h2>
                    {view === "hoje" ? <button className="operation-action" onClick={() => funnel()}>Abrir funil <ArrowRight size={17} /></button> :
                    stage && <button className="operation-action" onClick={() => funnel()}>Todas as etapas</button>}
                  </header>
                  {stageAmounts.map(({ name, count }, index) => <button className="operation-stage" key={name} type="button"
                    onClick={() => funnel(name)} aria-pressed={view === "funil" ? stage === name : undefined} aria-label={name + ", " + count + " oportunidades"}>
                    <span>{name}</span><span className="operation-stage-track"><i style={{ width: count * 100 / scale + "%", opacity: view === "funil" ? undefined : 1 - 0.16 * index }} /></span><b>{count}</b>{view === "funil" && <ArrowRight className="funnel-stage-arrow" size={17} aria-hidden="true" />}
                  </button>)}
                </div>
              </section>}
              <section id="crm-results" tabIndex={-1}>
              {view === "hoje" && <h2 className="operation-queue-title">Fila de retornos</h2>}
              {view === "funil" && <div className="funnel-list-head">
                <h2 className="operation-queue-title">{stage === "Proposta" && status === "Aberto" ? "Propostas em aberto" :
                  stage ? "Oportunidades em " + stage : status === "Aberto" ? "Oportunidades em aberto" : "Oportunidades"}
                  <span>{funnelList.length}</span></h2>
                <div className="funnel-list-filters">
                  <select aria-label="Filtrar próximo passo" value={nextFilter} onChange={(e) => setNextFilter(e.target.value)}>
                    <option value="">Próximo passo</option><option value="missing">Sem próximo passo</option><option value="defined">Com retorno definido</option>
                  </select>
                  <select aria-label="Filtrar responsável" value={owner} onChange={(e) => setOwner(e.target.value)}>
                    <option value="">Responsável</option>{s.members.map((m) => <option key={m.id} value={m.id}>{memberName(s, m.id)}</option>)}
                  </select>
                </div>
              </div>}
              {view === "hoje" && <div className="crm-tools operation-tools">
                  <div className="crm-switch" role="group" aria-label="Responsável pela fila">
                    <button aria-pressed={mine} onClick={() => setMine(true)}>Minha fila</button>
                    <button aria-pressed={!mine} onClick={() => setMine(false)}>Equipe</button>
                  </div>
                <label className="crm-search"><Search size={17} aria-hidden="true" />
                  <input aria-label="Buscar no CRM" type="search" placeholder="Buscar oportunidade" value={query} onChange={(e) => updateSearch(e.target.value)} />
                </label>
                <div className="operation-queue-filters" role="group" aria-label="Prazo do retorno">
                  {queueGroups.map((group) => <button className="crm-secondary" key={group} type="button" aria-label={"Filtrar: " + group}
                    aria-pressed={queueFilter === group} onClick={() => setQueueFilter(queueFilter === group ? "" : group)}>{group}</button>)}
                </div>
              </div>}
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
                  list={funnelList}
                  open={open}
                  showStage={!stage}
                  schedule={schedule}
                />
              ) : (
                <div className="journey">
                  <header className="journey-heading">
                    <h2>{journeySection === "kanban" ? "Jornada comercial" : "Vendas concluídas"}</h2>
                    <div className="crm-switch" role="group" aria-label="Visualização da jornada">
                      <button type="button" aria-pressed={journeySection === "kanban"}
                        onClick={() => change("jornada", "", false, "", "", "kanban")}>Kanban</button>
                      <button type="button" aria-pressed={journeySection === "concluidas"}
                        onClick={() => change("jornada", "", false, "", "", "concluidas")}>Vendas concluídas</button>
                    </div>
                  </header>
                  {moveIssue && <div className="crm-error journey-issue" role="alert">
                    <span>{moveIssue.message}</span>
                    {moveIssue.retry && <button className="crm-secondary" type="button"
                      onClick={() => { if (moveIssue.retry) void sendMove(moveIssue.retry); }}>Tentar movimentação novamente</button>}
                  </div>}
                  {journeySection === "kanban" ? <>
                    <div className="journey-filters">
                      <label>Origem <select value={journeyFilters.origem}
                        onChange={(event) => updateJourney({ ...journeyFilters, origem: event.target.value })}>
                        <option value="">Todas</option>
                        {!journeyOrigin && <option value={journeyFilters.origem}>Origem indisponível</option>}
                        {origins.map((origin) => <option key={origin}>{origin}</option>)}
                      </select></label>
                      <label>Responsável <select value={journeyFilters.responsavel}
                        onChange={(event) => updateJourney({ ...journeyFilters, responsavel: event.target.value })}>
                        <option value="">Todos</option>
                        {!journeyOwner && <option value={journeyFilters.responsavel}>Responsável indisponível</option>}
                        {s.members.map(({ id, name }) => <option key={id} value={id}>{name}</option>)}
                      </select></label>
                      <label>Próximo passo <select value={journeyFilters.proximo}
                        onChange={(event) => updateJourney({ ...journeyFilters, proximo: event.target.value })}>
                        <option value="">Todos</option>
                        <option value="missing">Sem próximo passo</option>
                        <option value="defined">Com retorno definido</option>
                      </select></label>
                      {Object.values(journeyFilters).some(Boolean) && <button className="operation-action" type="button"
                        onClick={() => updateJourney(emptyJourneyFilters)}>Limpar filtros</button>}
                    </div>
                    <JourneyBoard state={s} list={journeyList} open={open} schedule={schedule} move={moveDeal} moving={moving} />
                  </> : <CompletedSales state={s} list={searched.filter((deal) => deal.status === "Ganho")} open={open} />}
                </div>
              )}
              </section>
              {view === "funil" && <Reactivation revision={s.deals.map((deal) => deal.id + ":" + deal.revision).join(",")} open={(id, event) => change("funil", id, false, stage, event)} />}
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
                  event={eventId}
                />
              )}
              {form && (form === "create" || active) && (
                <CrmForm
                  key={form + selected}
                  action={form}
                  deal={form === "create" ? undefined : active}
                  state={s}
                  close={closeForm}
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
      <div aria-live="polite" className={message ? "crm-toast" : "sr-only"}>{message}</div>
    </WorkspaceShell>
  );
}
