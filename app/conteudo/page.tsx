"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowUpRight,
  BookOpen,
  BriefcaseBusiness,
  ChartNoAxesCombined,
  FolderOpen,
  LayoutGrid,
  Plus,
  RefreshCw,
  UsersRound,
} from "lucide-react";
import { Editorial, Today, Blank } from "./editorial";
import { Evidence } from "./evidence";
import { Library } from "./library";
import { HubForm, type Dialog } from "./forms";
import { nameUrl, type HubData } from "./model";
import "../crm/workspace.css";
import "./workspace.css";

const navigation = [
  { id: "hoje", title: "Hoje", icon: LayoutGrid },
  { id: "editorial", title: "Conteúdo", icon: FolderOpen },
  { id: "resultados", title: "Resultados", icon: ChartNoAxesCombined },
  { id: "marca", title: "Marca e ativos", icon: BookOpen },
];
const descriptions: Record<string, string> = {
  hoje: "Acompanhe o que vai ao ar e transforme resultados confirmados em novos briefings.",
  editorial:
    "Organize entregas, aprove as versões e prepare os links de cada publicação.",
  resultados:
    "Rastreie cada evento confirmado até sua publicação e confira a evidência de origem.",
  marca:
    "Encontre as diretrizes aprovadas e as versões de ativos autorizadas para uso.",
};
function getLocation() {
  const query = new URLSearchParams(window.location.search),
    view = query.get("vista");
  return {
    brand: query.get("marca") || "",
    view: navigation.some((n) => n.id === view) ? view! : "hoje",
    selected: query.get("id") || "",
    decision: query.get("decisao") || "",
  };
}
export default function HubPage() {
  const [loc, setLoc] = useState({
    brand: "",
    view: "hoje",
    selected: "",
    decision: "",
  });
  const [data, setData] = useState<HubData | null>(null),
    [loading, setLoading] = useState(true),
    [login, setLogin] = useState(false);
  const [status, setStatus] = useState(""),
    [error, setError] = useState(""),
    [working, setWorking] = useState(false);
  const [modal, setModal] = useState<{ dialog: Dialog; data: HubData } | null>(
    null,
  );
  const pending = useRef<{ body: string; id: string } | null>(null);
  const request = useRef(0),
    opened = useRef("");
  const load = useCallback(async (brand: string) => {
    const seq = ++request.current;
    setLoading(true);
    try {
      const r = await fetch(
        "/api/conteudo?" + new URLSearchParams({ marca: brand }),
        { cache: "no-store" },
      );
      if (request.current !== seq) return null;
      if (r.status === 401) {
        setData(null);
        setModal(null);
        setLogin(true);
        setError("");
        return null;
      }
      if (!r.ok) {
        setData(null);
        setModal(null);
        setLogin(false);
        const error = await r.json() as { error?: string };
        throw Error(error.error || "Não foi possível carregar esta marca.");
      }
      const hub = (await r.json()) as HubData;
      if (request.current === seq) {
        setData(hub);
        if (!brand) setLoc((current) => ({ ...current, brand: hub.brand.id }));
        setLogin(false);
        setError("");
      }
      return hub;
    } catch (error) {
      if (request.current === seq) setError((error as Error).message);
      throw error;
    } finally {
      if (request.current === seq) setLoading(false);
    }
  }, []);
  useEffect(() => {
    const sync = () => {
      setLoc(getLocation());
      setModal(null);
    };
    sync();
    document.title = "Hub de Conteúdo · EBA Growth";
    window.addEventListener("popstate", sync);
    return () => {
      window.removeEventListener("popstate", sync);
      request.current++;
    };
  }, []);
  useEffect(() => {
    load(loc.brand).catch(() => {});
  }, [loc.brand, load]);
  useEffect(() => {
    if (
      !loc.decision ||
      !data?.brand.active ||
      data.brand.id !== loc.brand ||
      opened.current === loc.decision
    )
      return;
    if (
      !data.references.some((r) => r.kind === "PICO" && r.id === loc.decision)
    )
      return;
    opened.current = loc.decision;
    pending.current = null;
    setModal({ dialog: { type: "edition", decision: loc.decision }, data });
  }, [data, loc.brand, loc.decision]);
  useEffect(() => {
    if (!data || data.brand.id !== loc.brand) return;
    const anchor = window.location.hash.slice(1);
    if (!/^(edicao|asset)-\d+$/.test(anchor)) return;
    const target = document.getElementById(anchor);
    if (target instanceof HTMLDetailsElement) {
      target.open = true;
      target.scrollIntoView({ block: "start" });
    }
  }, [data, loc.brand, loc.selected]);
  function show(dialog: Dialog) {
    if (data) {
      setStatus("");
      pending.current = null;
      setModal({ dialog, data });
    }
  }
  function take(view: string, id: string) {
    const target = nameUrl(loc.brand, view, id);
    window.history.pushState(null, "", target);
    setLoc(getLocation());
    window.scrollTo(0, 0);
  }
  async function save(change: Record<string, unknown>, snapshot: HubData) {
    const body = JSON.stringify({
      brand: snapshot.brand.id,
      version: snapshot.version,
      change,
    });
    if (pending.current?.body !== body)
      pending.current = { body, id: crypto.randomUUID() };
    const id = pending.current.id;
    const r = await fetch("/api/conteudo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...JSON.parse(body), id }),
    });
    const info = (await r.json()) as { error?: string };
    if (!r.ok) {
      if (r.status === 409) await load(snapshot.brand.id).catch(() => {});
      throw Error(info.error || "Não foi possível confirmar a alteração.");
    }
    await load(snapshot.brand.id);
    pending.current = null;
    setStatus(
      change.kind === "activate" ? "Marca ativada." : "Alteração salva.",
    );
    if (change.kind === "edition")
      take("editorial", (change.edition as { id: string }).id || id);
    if (change.kind === "prepare") take("resultados", id);
    if (change.kind === "asset" || change.kind === "guide")
      take(
        "marca",
        ((change.asset || change.guide) as { id: string }).id || id,
      );
    if (change.kind === "results" && (change.rows as unknown[]).length === 1)
      take("resultados", String(change.correct || id));
  }
  const view = navigation.find((n) => n.id === loc.view)!;
  const links = navigation.map(({ id, title, icon: Icon }) => (
    <a
      key={id}
      href={nameUrl(loc.brand, id)}
      aria-current={id === view.id ? "page" : undefined}
    >
      <Icon size={17} />
      {title}
    </a>
  ));
  const hub = data?.brand.id === loc.brand ? data : null;
  const intro = !loc.selected;
  return (
    <div className="crm-space hub">
      <a href="#hub-content" className="skip">
        Ir ao conteúdo
      </a>
      <aside className="crm-side" aria-label="Navegação do Hub">
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
        <nav aria-label="Hub de Conteúdo">
          <span className="eyebrow">Hub de Conteúdo</span>
          {links}
          <div className="crm-back">
            <a href="/integracoes"><ChartNoAxesCombined size={17}/>Integrações</a>
            <a href="/carteira?vista=contas">
              <UsersRound size={17} />
              Clientes
            </a>
            <a href="/crm">
              <BriefcaseBusiness size={17} />
              CRM comercial
            </a>
            <a href="/">
              <LayoutGrid size={17} />
              Observatório
            </a>
          </div>
        </nav>
        <div className="crm-ws">
          <BookOpen size={18} />
          <div>
            <b>EBA Aceleradora</b>
            <small>Workspace privado</small>
          </div>
        </div>
      </aside>
      <main className="crm-main" id="hub-content">
        <header className="crm-bar hub-bar">
          <a href="/" aria-label="Observatório">
            <LayoutGrid size={15} />
            <span>Observatório</span>
          </a>
          <b>Hub de Conteúdo</b><a className="hub-mobile-entry" href="/integracoes">Integrações</a>
          {hub && (
            <label>
              Marca
              <select
                aria-label="Marca editorial"
                value={loc.brand}
                onChange={(e) =>
                  window.location.assign(nameUrl(e.target.value, loc.view))
                }
              >
                {hub.brands.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                    {b.active ? "" : " · Ativar"}
                  </option>
                ))}
              </select>
            </label>
          )}
        </header>
        <div className="crm-inner hub-inner">
          <nav className="crm-mobile-nav" aria-label="Vistas do Hub">
            {links}
          </nav>
          {intro && (
            <div className="crm-intro hub-intro">
              <div>
                <span className="eyebrow">
                  <span className="crm-light" />{" "}
                  {hub?.brand.name || "Hub de Conteúdo"}
                </span>
                <h1>
                  {view.title}
                  <em>.</em>
                </h1>
                <p>{descriptions[view.id]}</p>
              </div>
              {hub?.brand.active && ["hoje", "editorial"].includes(view.id) && (
                <button
                  className="crm-primary"
                  onClick={() => show({ type: "edition" })}
                >
                  <Plus size={17} />
                  Novo briefing
                </button>
              )}
            </div>
          )}
          {login && (
            <section className="crm-access">
              <BookOpen size={22} />
              <div>
                <h2>Acesso da equipe</h2>
                <p>Entre para abrir o espaço editorial da marca.</p>
              </div>
              <a
                className="crm-primary"
                target="_top"
                href={
                  "/signin-with-chatgpt?return_to=" +
                  encodeURIComponent("/conteudo" + window.location.search)
                }
              >
                Entrar no Hub <ArrowUpRight size={15} />
              </a>
            </section>
          )}
          {error && (
            <div className="crm-error" role="alert">
              {error}{" "}
              <button onClick={() => load(loc.brand).catch(() => {})}>
                Tentar novamente
              </button>
            </div>
          )}
          {!hub && loading && <p role="status">Carregando o Hub…</p>}
          {hub && !hub.brand.active && (
            <Blank title="Ative o espaço editorial desta marca">
              <span>
                Use o espaço da conta para manter versões, ativos e resultados
                vinculados ao cliente.
              </span>
              <button
                className="crm-primary"
                disabled={working}
                onClick={async () => {
                  setWorking(true);
                  try {
                    await save({ kind: "activate" }, hub);
                  } catch (e) {
                    setError((e as Error).message);
                  } finally {
                    setWorking(false);
                  }
                }}
              >
                Ativar marca
              </button>
            </Blank>
          )}
          {hub?.brand.active && (
            <>
              {loc.view === "hoje" && <Today data={hub} open={show} />}
              {loc.view === "editorial" && (
                <Editorial data={hub} selected={loc.selected} open={show} />
              )}
              {loc.view === "resultados" && (
                <Evidence data={hub} selected={loc.selected} open={show} />
              )}
              {loc.view === "marca" && (
                <Library data={hub} selected={loc.selected} open={show} />
              )}
            </>
          )}
          {modal && (
            <HubForm
              data={modal.data}
              dialog={modal.dialog}
              close={() => setModal(null)}
              save={(change) => save(change, modal.data)}
            />
          )}
          {status && (
            <div className="crm-toast" role="status">
              <button
                onClick={() => setStatus("")}
                aria-label="Dispensar aviso"
              >
                {status}
              </button>
            </div>
          )}
        </div>
        <footer className="crm-foot">
          EBA Growth <ArrowUpRight size={12} /> Hub de Conteúdo{" "}
          <button
            className="link-action hub-refresh"
            onClick={() => load(loc.brand).catch(() => {})}
            disabled={loading}
          >
            <RefreshCw size={13} /> Atualizar
          </button>
        </footer>
      </main>
    </div>
  );
}
