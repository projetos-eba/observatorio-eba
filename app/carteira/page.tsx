/* eslint-disable @next/next/no-html-link-for-pages -- Use native navigation for the Cloudflare Pages build. */
"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowUpRight,
  BriefcaseBusiness,
  CalendarDays,
  ClipboardList,
  FolderOpen,
  RefreshCw,
  Search,
  Upload,
  UsersRound,
} from "lucide-react";
import { normalize } from "../crm/model";
import {
  agenda,
  monday,
  niches,
  offsetDay,
  pico,
  profileFor,
  templates,
  today,
  weekLabel,
  type Portfolio,
} from "./model";
import { PortfolioForm, type Modal } from "./forms";
import {
  accountUrl,
  AccountList,
  AgendaList,
  Archive,
  Blank,
} from "./views";
import { WorkspaceShell } from "../workspace/shell";
import { CustomerProfile, openCustomerTab } from "./profile";
import "../crm/workspace.css";
import "../workspace/operation.css";
import "./workspace.css";
import "./profile.css";

const tabs = [
  {
    id: "pauta",
    label: "Pauta da semana",
    icon: CalendarDays,
    url: "/carteira",
  },
  {
    id: "contas",
    label: "Contas",
    icon: UsersRound,
    url: "/carteira?vista=contas",
  },
  { id: "atas", label: "Atas", icon: FolderOpen, url: "/carteira?vista=atas" },
];
type Location = { view: string; company: string; minutes: string };
function getLocation(): Location {
  const query = new URLSearchParams(window.location.search),
    view = query.get("vista");
  return {
    view: view === "contas" || view === "atas" ? view : "pauta",
    company: query.get("conta") || "",
    minutes: query.get("ata") || "",
  };
}
export default function PortfolioPage() {
  const [location, setLocation] = useState<Location>({
    view: "pauta",
    company: "",
    minutes: "",
  });
  const [data, setData] = useState<Portfolio | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [login, setLogin] = useState(false);
  const [modal, setModal] = useState<{
    form: Modal;
    snapshot: Portfolio;
  } | null>(null);
  const [niche, setNiche] = useState(""),
    [member, setMember] = useState(""),
    [stage, setStage] = useState(""),
    [query, setQuery] = useState("");
  const [message, setMessage] = useState(""),
    [linkBusy, setLinkBusy] = useState(false);
  const generation = useRef({ request: 0 });
  const pending = useRef<{ body: string; token: string } | null>(null);
  const refresh = useCallback(async () => {
    const active = ++generation.current.request;
    setLoading(true);
    try {
      const response = await fetch("/api/carteira", { cache: "no-store" });
      if (active !== generation.current.request) return;
      if (response.status === 401 || response.status === 403) {
        setData(null);
        setModal(null);
        setLogin(true);
        setError("");
        return;
      }
      if (!response.ok) throw Error("Não foi possível carregar a Carteira.");
      const content = (await response.json()) as Portfolio;
      if (active === generation.current.request) {
        setData(content);
        setError("");
        setLogin(false);
      }
    } catch (e) {
      if (active === generation.current.request) {
        setError(
          e instanceof Error
            ? e.message
            : "Não foi possível carregar a Carteira.",
        );
        throw e;
      }
    } finally {
      if (active === generation.current.request) setLoading(false);
    }
  }, []);
  useEffect(() => {
    const sync = () => setLocation(getLocation());
    const requests = generation.current;
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      sync();
      refresh().catch(() => {});
    });
    window.addEventListener("popstate", sync);
    document.title = "Carteira e Método PICO · EBA Growth";
    return () => {
      active = false;
      requests.request++;
      window.removeEventListener("popstate", sync);
    };
  }, [refresh]);
  useEffect(() => {
    if (message !== "Alterações salvas.") return;
    const timeout = setTimeout(() => setMessage(""), 4200);
    return () => clearTimeout(timeout);
  }, [message]);
  function open(form: Modal) {
    if (data) {
      pending.current = null;
      setModal({ form, snapshot: data });
    }
  }
  async function send(change: Record<string, unknown>, version: number) {
    const body = JSON.stringify({ version, change });
    if (pending.current?.body !== body)
      pending.current = { body, token: crypto.randomUUID() };
    const response = await fetch("/api/carteira", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: pending.current.token, version, change }),
    });
    const result = (await response.json()) as { error?: string };
    if (!response.ok) {
      if (response.status === 409) await refresh().catch(() => {});
      throw Error(
        response.status === 409
          ? "A Carteira mudou. Feche o formulário e abra novamente para conferir os dados."
          : result.error || "Falha ao salvar.",
      );
    }
    const submitted = pending.current.token;
    await refresh();
    pending.current = null;
    if (location.company && change.kind === "measure" && Array.isArray(change.rows)) {
      const measurement = change.rows.find((row) => row.company === location.company);
      if (measurement) openCustomerTab(accountUrl(location.company) + "&aba=resultados&semana=" + measurement.week + "#medicao-" + measurement.week);
    }
    if (location.company && change.kind === "decision")
      openCustomerTab(accountUrl(location.company) + "&aba=plano#decisao-" + submitted);
    setMessage(
      change.kind === "close"
        ? "Ata fechada e guardada."
        : change.kind === "link"
          ? change.linked
            ? "Análise vinculada à conta."
            : "Vínculo removido."
          : "Alterações salvas.",
    );
  }
  const day = today(),
    week = monday(day),
    last = offsetDay(week, -7);
  const closed = data?.minutes.find((m) => m.week === week);
  const { view, company, minutes } = location;
  const account = data?.accounts.find((a) => a.company === company);
  const archive = data?.minutes.find((m) => m.week === minutes);
  const rows = data ? agenda(data, week, day) : [];
  const matches = (id: string, name: string) => {
    const profile = data && profileFor(data, id);
    const owner =
      profile?.owner ||
      data?.accounts.find((a) => a.company === id)?.contracts[0]?.lead;
    return (
      (!niche || profile?.niche === niche) &&
      (!member || owner === member) &&
      (!stage || profile?.stage === stage) &&
      normalize(name).includes(normalize(query))
    );
  };
  const filtered = rows.filter((r) => matches(r.company, r.name));
  const accountRows =
    data?.accounts.filter((a) => matches(a.company, a.name)) || [];
  const heading = view === "pauta" ? "Pauta de decisões" : view === "contas" ? "Contas da carteira" : "Atas e revisões";
  const form = modal && <PortfolioForm modal={modal.form} data={modal.snapshot} close={() => setModal(null)}
    save={(change) => send(change, modal.snapshot.version)} />;
  const toast = message && <div className="crm-toast" role="status">
    <button onClick={() => setMessage("")} aria-label="Dispensar aviso">{message}</button>
  </div>;
  if (view === "contas" && company) {
    return <WorkspaceShell current="/carteira" title={account?.name || "Ficha do cliente"}
      name={data?.members.find((item) => item.id === data.me)?.name}>
      {error && <p className="crm-error" role="alert">{error} <button onClick={() => refresh().catch(() => {})}>Tentar novamente</button></p>}
      {account && data ? <CustomerProfile key={company} account={account} data={data} show={open} link={(signal, linked) => {
        if (linkBusy) return;
        setLinkBusy(true);
        send({ kind: "link", company, signal, linked }, data.version)
          .catch((e) => setMessage(e instanceof Error ? e.message : "Falha ao salvar."))
          .finally(() => setLinkBusy(false));
      }} /> : login ? <section className="crm-access">
        <p>Entre com a conta convidada para acessar a ficha do cliente.</p>
        <a className="crm-primary" href={"/signin-with-chatgpt?return_to=" + encodeURIComponent(window.location.pathname + window.location.search + window.location.hash)}>Entrar <ArrowUpRight size={15} /></a>
      </section> : loading ? <p role="status">Carregando ficha…</p> : !error && <Blank title="Conta indisponível" text="Confira se a conta está na sua carteira.">
        <a className="crm-secondary" href="/carteira?vista=contas">Ver contas</a>
      </Blank>}
      {form}{toast}
    </WorkspaceShell>;
  }
  const navigation = tabs.map(({ id, label, icon: Icon, url }) => (
    <a key={id} href={url} aria-current={view === id ? "page" : undefined}>
      <Icon size={17} />
      {label}
    </a>
  ));
  return (
    <div className="crm-space portfolio">
      <a className="skip" href="#portfolio-main">
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
        <nav aria-label="Carteira">
          <span className="eyebrow">Operação de contas</span>
          {navigation}
          <div className="crm-back">
            <a href="/conteudo"><ClipboardList size={17}/>Hub de Conteúdo</a>
            <a href="/crm">
              <BriefcaseBusiness size={17} />
              CRM comercial
            </a>
            <a href="/">
              <ChartIcon />
              Observatório
            </a>
          </div>
        </nav>
        <div className="crm-ws">
          <UsersRound size={18} />
          <div>
            <b>EBA Aceleradora</b>
            <small>Workspace privado</small>
          </div>
        </div>
      </aside>
      <main id="portfolio-main" className="crm-main">
        <header className="crm-bar">
          <a href="/crm">CRM comercial</a>
          <span className="portfolio-breadcrumb">/</span>
          <b>Carteira</b><a href="/conteudo">Hub de Conteúdo</a>
          {data && (
            <span>{data.members.find((m) => m.id === data.me)?.name}</span>
          )}
        </header>
        <div className="crm-inner portfolio-inner">
          <nav className="crm-mobile-nav" aria-label="Vistas da Carteira">
            {navigation}
            <a href="/" aria-label="Observatório">
              <ChartIcon />
            </a>
          </nav>
          <div className="crm-intro portfolio-intro">
            <div>
              <span className="eyebrow">
                <span className="crm-light" /> Carteira e Método PICO
              </span>
              <h1>
                {heading}
                <em>.</em>
              </h1>
              <p>
                {view === "pauta"
                  ? "Prepare a reunião com os dados da conta e leve cada decisão até a revisão."
                  : view === "atas"
                    ? "Recupere o combinado e a evidência registrada em cada reunião."
                    : account
                      ? "Indicadores, diagnóstico e decisões de crescimento desta conta."
                      : "Contas ganhas do CRM e a leitura de crescimento de cada cliente."}
              </p>
            </div>
            {data && view !== "atas" && !account && (
              <button
                className="crm-secondary"
                onClick={() => open({ kind: "import" })}
              >
                <Upload size={15} />
                Importar CSV
              </button>
            )}
          </div>
          {login && (
            <section className="crm-access">
              <BriefcaseBusiness size={22} />
              <div>
                <h2>Acesso da equipe</h2>
                <p>
                  Entre com a conta da equipe para consultar a Carteira da EBA.
                </p>
              </div>
              <a
                className="crm-primary"
                target="_top"
                href={
                  "/signin-with-chatgpt?return_to=" +
                  encodeURIComponent("/carteira" + window.location.search)
                }
              >
                Entrar na Carteira <ArrowUpRight size={15} />
              </a>
            </section>
          )}
          {error && (
            <div className="crm-error" role="alert">
              {error}{" "}
              <button onClick={() => refresh().catch(() => {})}>
                Tentar novamente
              </button>
            </div>
          )}
          {!data && loading && <p role="status">Carregando a Carteira…</p>}
          {data && (
            <>
              {view === "pauta" && (
                <>
                  <section className="portfolio-pulse">
                    <div>
                      <span className="eyebrow">Contas na pauta</span>
                      <b>
                        {String(closed?.items.length ?? rows.length).padStart(
                          2,
                          "0",
                        )}
                      </b>
                    </div>
                    <div>
                      <span className="eyebrow">Semana da reunião</span>
                      <strong>{weekLabel(week)}</strong>
                      <small>Indicadores de {weekLabel(last)}</small>
                    </div>
                    <div>
                      <span className="eyebrow">Situação</span>
                      <strong>
                        {closed ? "Ata fechada" : "Em preparação"}
                      </strong>
                      {closed && (
                        <a
                          className="link-action"
                          href={"/carteira?vista=atas&ata=" + week}
                        >
                          Abrir ata <ArrowUpRight size={15} />
                        </a>
                      )}
                    </div>
                  </section>
                  {!closed && (
                    <div className="portfolio-actions">
                      <button
                        className="crm-secondary"
                        onClick={() => open({ kind: "include" })}
                        disabled={!data.accounts.length}
                      >
                        Incluir conta na pauta
                      </button>
                      {data.canClose && <button
                        className="crm-primary"
                        onClick={() => open({ kind: "close" })}
                        disabled={!rows.length}
                      >
                        <ClipboardList size={15} />
                        Fechar pauta
                      </button>}
                    </div>
                  )}
                </>
              )}
              {view !== "atas" && !account && (
                <div className="portfolio-filters">
                  <label className="crm-search">
                    <Search size={15} />
                    <input
                      type="search"
                      aria-label="Buscar conta"
                      placeholder="Buscar conta…"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                  </label>
                  <label>
                    Nicho
                    <select
                      value={niche}
                      onChange={(e) => setNiche(e.target.value)}
                    >
                      <option value="">Todos</option>
                      {niches.map((n) => (
                        <option key={n} value={n}>
                          {templates[n].name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Responsável
                    <select
                      value={member}
                      onChange={(e) => setMember(e.target.value)}
                    >
                      <option value="">Todos</option>
                      {data.members.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Etapa PICO
                    <select
                      value={stage}
                      onChange={(e) => setStage(e.target.value)}
                    >
                      <option value="">Todas</option>
                      {pico.map((p) => (
                        <option key={p}>{p}</option>
                      ))}
                    </select>
                  </label>
                  <button
                    className="crm-secondary refresh-portfolio"
                    onClick={() => refresh().catch(() => {})}
                    aria-label="Atualizar Carteira"
                    disabled={loading}
                  >
                    <RefreshCw size={15} />
                  </button>
                </div>
              )}
              {view === "pauta" && closed && rows.length > 0 && (
                <h2 className="portfolio-live-heading">Acompanhamento atual</h2>
              )}
              {view === "pauta" &&
                (filtered.length ? (
                  <AgendaList
                    rows={filtered}
                    data={data}
                    show={open}
                    closed={!!closed}
                  />
                ) : (
                  <Blank
                    title={
                      data.accounts.length
                        ? rows.length
                          ? "Nenhuma conta com estes filtros"
                          : "Pauta em dia"
                        : "A Carteira começa com uma venda ganha"
                    }
                    text={
                      data.accounts.length
                        ? "As pendências das contas e os compromissos da semana aparecem aqui."
                        : "Conclua uma oportunidade no CRM para acompanhar o objetivo e os indicadores da conta."
                    }
                  >
                    {!data.accounts.length && (
                      <a className="crm-primary" href="/crm?vista=funil">
                        Abrir funil comercial <ArrowUpRight size={15} />
                      </a>
                    )}
                  </Blank>
                ))}
              {view === "contas" &&
                (accountRows.length ? (
                  <AccountList
                    data={data}
                    week={last}
                    accounts={accountRows}
                    show={open}
                  />
                ) : (
                  <Blank
                    title={
                      company
                        ? "Conta indisponível"
                        : "Nenhuma conta nesta seleção"
                    }
                    text="As contas ganhas no CRM ficam disponíveis para configurar o Método PICO."
                  />
                ))}
              {view === "atas" && <Archive data={data} minutes={archive} />}
              {form}
            </>
          )}
          {toast}
        </div>
        <footer className="crm-foot">
          EBA Growth <ArrowUpRight size={12} /> Carteira
        </footer>
      </main>
    </div>
  );
}
function ChartIcon() {
  return <ClipboardList size={17} />;
}
