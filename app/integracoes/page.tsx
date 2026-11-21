"use client";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  ChartNoAxesCombined,
  Check,
  ChevronRight,
  Copy,
  Camera,
  Link2,
  MessageCircle,
  Plug,
  RefreshCw,
  X,
} from "lucide-react";
import { guides } from "./guides";
import {
  cost,
  fmtDate,
  hubUrl,
  labels,
  num,
  providers,
  type Connection,
  type Provider,
  type Resource,
  type State,
} from "./model";
import "../crm/workspace.css";
import "./workspace.css";

const symbols = {
  instagram: Camera,
  meta_ads: ChartNoAxesCombined,
  whatsapp: MessageCircle,
};
const statusLabels: Record<string, string> = {
  connected: "Conectada",
  synced: "Sincronizada",
  disconnected: "Desconectada",
  attention: "Revisar acesso",
  expired: "Credencial expirada ou inválida",
  limited: "Aguardando limite",
  error: "Atualização falhou",
  ok: "Concluída",
  running: "Em andamento",
  failed: "Falhou",
  interrupted: "Interrompida",
  cancelled: "Cancelada",
};
type Command = Record<string, unknown>;
async function api(command: Command) {
  const r = await fetch("/api/integracoes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(command),
  });
  const d = (await r.json()) as {
    items?: Resource[];
    message?: string;
    error?: string;
    status?: string;
  };
  if (!r.ok) throw Error(d.error || "Não foi possível concluir.");
  return d;
}
function connectionStatus(c?: Connection) {
  return c?.busy
    ? "Atualizando"
    : statusLabels[c?.status || ""] || "Configuração pendente";
}
function Wizard({
  app,
  close,
  saved,
}: {
  app: Provider;
  close: () => void;
  saved: () => void;
}) {
  const node = useRef<HTMLDialogElement>(null);
  const [token, setToken] = useState(""),
    [secret, setSecret] = useState(""),
    [parent, setParent] = useState(""),
    [items, setItems] = useState<Resource[]>([]),
    [choice, setChoice] = useState("");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const g = guides[app];
  useEffect(() => {
    const m = node.current;
    m?.showModal();
    return () => m?.close();
  }, []);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const args = {
        provider: app,
        token,
        parent: parent.trim().replace(/^act_/, ""),
        secret,
      };
      if (items.length) {
        await api({ action: "connect", ...args, id: choice });
        saved();
        return;
      }
      const d = await api({ action: "test", ...args });
      if (!d.items?.length) throw Error("Nenhum recurso encontrado.");
      setItems(d.items);
      setChoice(d.items[0].id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const selected = items.find((i) => i.id === choice);
  return (
    <dialog
      ref={node}
      className="crm-modal integrations-modal"
      aria-labelledby="connector-title"
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) close();
      }}
    >
      <header>
        <span className="eyebrow">Integrações · EBA Growth</span>
        <h2 id="connector-title">{labels[app]}</h2>
        <button
          className="icon-action"
          aria-label="Fechar assistente"
          disabled={busy}
          onClick={close}
        >
          <X size={18} />
        </button>
      </header>
      <form onSubmit={submit}>
        <div className="crm-fields">
          <div className="cw integration-steps">
            <span aria-current={!items.length ? "step" : undefined}>
              Preparar e testar
            </span>
            <ChevronRight size={14} />
            <span aria-current={items.length ? "step" : undefined}>
              Escolher e confirmar
            </span>
          </div>
          {!items.length ? (
            <>
              <section className="cw guide-box">
                <strong>Na Meta</strong>
                <ol>
                  {g.steps.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
                <a
                  className="link-action"
                  href={g.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  Abrir guia oficial <ArrowUpRight size={14} />
                </a>
              </section>
              {(app === "whatsapp" || app === "meta_ads") && (
                <label className="cw">
                  {app === "whatsapp"
                    ? "ID da conta WhatsApp Business"
                    : "ID da conta de anúncios (opcional)"}
                  <input
                    required={app === "whatsapp"}
                    value={parent}
                    onChange={(e) => setParent(e.target.value)}
                    inputMode="numeric"
                    placeholder={
                      app === "meta_ads"
                        ? "Digite o ID ou deixe em branco para listar"
                        : ""
                    }
                  />
                </label>
              )}
              <label className="cw">
                Token de acesso
                <input
                  type="password"
                  autoComplete="off"
                  spellCheck={false}
                  required
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="Cole a credencial gerada na Meta"
                />
              </label>
              {app !== "instagram" && (
                <details className="cw">
                  <summary>Opção avançada da Meta</summary>
                  <label>
                    App Secret (se o app exigir prova)
                    <input
                      type="password"
                      autoComplete="off"
                      value={secret}
                      onChange={(e) => setSecret(e.target.value)}
                    />
                  </label>
                </details>
              )}
            </>
          ) : (
            <>
              <p className="cw guide-box">
                <Check size={17} /> O teste encontrou {items.length}{" "}
                {items.length === 1 ? "recurso" : "recursos"}. Confira a seleção
                antes de salvar.
              </p>
              <label className="cw">
                Recurso da EBA
                <select
                  value={choice}
                  onChange={(e) => setChoice(e.target.value)}
                >
                  {items.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} {r.phone ? "· +" + r.phone : "· " + r.id}
                    </option>
                  ))}
                </select>
              </label>
              {selected && (
                <p className="cw guide-box">
                  {selected.name} · ID {selected.id}
                  {selected.currency && " · " + selected.currency}
                  {selected.timezone && " · " + selected.timezone}
                </p>
              )}
            </>
          )}
        </div>
        <footer>
          {error && (
            <p className="crm-error" role="alert">
              {error}
            </p>
          )}
          <div>
            <button
              className="crm-secondary"
              type="button"
              disabled={busy}
              onClick={() => (items.length ? setItems([]) : close())}
            >
              {items.length ? "Voltar" : "Cancelar"}
            </button>
            <button className="crm-primary" disabled={busy}>
              {busy
                ? "Consultando a Meta…"
                : items.length
                  ? "Confirmar conexão"
                  : "Testar acesso"}
              <ArrowRight size={15} />
            </button>
          </div>
        </footer>
      </form>
    </dialog>
  );
}
function LinkPost({
  resource,
  id,
  data,
  done,
}: {
  resource: string;
  id: string;
  data: State;
  done: () => void;
}) {
  const [choice, setChoice] = useState(
      data.links.find((l) => l.resource === resource && l.media === id)
        ?.publication || "",
    ),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const node = ref.current;
    node?.showModal();
    return () => node?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="crm-modal integrations-modal"
      aria-labelledby="link-title"
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) done();
      }}
    >
      <header>
        <h2 id="link-title">Vincular ao Hub</h2>
      </header>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          try {
            await api({
              action: "link",
              resource,
              media: id,
              publication: choice,
            });
            done();
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="crm-fields">
          <label className="cw">
            Publicação confirmada
            <select
              required
              value={choice}
              onChange={(e) => setChoice(e.target.value)}
            >
              <option value="">
                Escolha a peça correspondente de Instagram
              </option>
              {data.publications
                .filter((p) => p.channel === "Instagram")
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title} · {p.published}
                  </option>
                ))}
            </select>
          </label>
        </div>
        <footer>
          {error && (
            <p className="crm-error" role="alert">
              {error}
            </p>
          )}
          <div>
            <button
              className="crm-secondary"
              type="button"
              disabled={busy}
              onClick={done}
            >
              Cancelar
            </button>
            <button className="crm-primary" disabled={busy}>
              Vincular
            </button>
          </div>
        </footer>
      </form>
    </dialog>
  );
}
function HistoryPages({ page, next, change, label }: { page: number; next: boolean; change: (value: number) => void; label: string }) {
  if (page === 1 && !next) return null;
  return <div className="connection-toolbar" role="group" aria-label={label}>
    <button className="crm-secondary" disabled={page === 1} onClick={() => change(page - 1)}>Anterior</button>
    <span>Página {page}</span>
    <button className="crm-secondary" disabled={!next} onClick={() => change(page + 1)}>Próxima</button>
  </div>;
}
export default function Integrations() {
  const [app, setApp] = useState<Provider>("instagram"),
    [resource, setResource] = useState(""),
    [page, setPage] = useState(1);
  const [jobPage, setJobPage] = useState(1),
    [jobStatus, setJobStatus] = useState(""),
    [auditPage, setAuditPage] = useState(1);
  const [data, setData] = useState<State | null>(null),
    [fatal, setFatal] = useState(""),
    [login, setLogin] = useState(false),
    [loading, setLoading] = useState(true);
  const [wizard, setWizard] = useState<Provider | null>(null),
    [link, setLink] = useState<{ resource: string; id: string } | null>(null),
    [remove, setRemove] = useState(false);
  const [busy, setBusy] = useState<Provider | null>(null),
    [notice, setNotice] = useState(""),
    [copied, setCopied] = useState("");
  const gen = useRef(0);
  const load = useCallback(async () => {
    const n = ++gen.current;
    setLoading(true);
    try {
      const r = await fetch(
        "/api/integracoes?" +
          new URLSearchParams({
            app, recurso: resource, pagina: String(page),
            historico: String(jobPage), estado: jobStatus, auditoria: String(auditPage),
          }),
        { cache: "no-store" },
      );
      if (gen.current !== n) return;
      if (r.status === 401) {
        setLogin(true);
        setData(null);
        return;
      }
      if (!r.ok) {
        setData(null);
        const problem = await r.json() as { error?: string };
        throw Error(problem.error || "Não foi possível carregar as integrações.");
      }
      const d = (await r.json()) as State;
      if (gen.current === n) {
        setData(d);
        setLogin(false);
        setFatal("");
      }
    } catch (e) {
      if (gen.current === n) setFatal((e as Error).message);
    } finally {
      if (gen.current === n) setLoading(false);
    }
  }, [app, resource, page, jobPage, jobStatus, auditPage]);
  useEffect(() => {
    document.title = "Integrações · EBA Growth";
    void load();
    return () => {
      gen.current++;
    };
  }, [load]);
  function tab(provider: Provider) {
    setApp(provider);
    setResource("");
    setPage(1);
    setJobPage(1);
    setJobStatus("");
    setAuditPage(1);
    setNotice("");
    setRemove(false);
  }
  async function operate(action: string) {
    setBusy(app);
    setNotice("");
    try {
      const d = await api({ action, provider: app });
      setNotice(d.message || "Atualização concluída.");
    } catch (e) {
      setNotice((e as Error).message);
    } finally {
      setRemove(false);
      setBusy(null);
      void load();
    }
  }
  const current = data?.connected.find((c) => c.provider === app),
    active = current && current.status !== "disconnected";
  const history = data?.sources.filter((s) => s.provider === app) || [],
    selected = data?.selected?.provider === app ? data.selected : null;
  const matchesWhats =
    data?.publications.filter(
      (p) => p.destination === "WhatsApp" && p.target === selected?.phone,
    ) || [];
  return (
    <div className="crm-space integrations">
      <a className="skip" href="#integration-main">
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
        <nav aria-label="Workspace">
          <span className="eyebrow">Workspace</span>
          <a href="/integracoes" aria-current="page">
            <Plug size={17} />
            Integrações
          </a>
          <div className="crm-back">
            <a href="/conteudo">
              <BookOpen size={17} />
              Hub de Conteúdo
            </a>
            <a href="/carteira?vista=contas">
              <ChartNoAxesCombined size={17} />
              Clientes
            </a>
            <a href="/crm">
              <Link2 size={17} />
              CRM comercial
            </a>
            <a href="/">
              <ArrowLeft size={17} />
              Observatório
            </a>
          </div>
        </nav>
        <div className="crm-ws">
          <Plug size={18} />
          <div>
            <b>EBA Aceleradora</b>
            <small>Workspace privado</small>
          </div>
        </div>
      </aside>
      <main className="crm-main" id="integration-main">
        <header className="crm-bar">
          <a href="/">Observatório</a>
          <ChevronRight size={14} />
          <b>Integrações</b>
          <span>EBA Growth</span>
        </header>
        <div className="crm-inner integration-inner">
          <div className="crm-intro integration-intro">
            <div>
              <span className="eyebrow">EBA Growth · Fontes conectadas</span>
              <h1>
                Integrações<em>.</em>
              </h1>
              <p>
                Conecte perfis, anúncios e números comerciais para usar os dados
                na operação da EBA.
              </p>
            </div>
            <a className="crm-secondary" href="/conteudo">
              <BookOpen size={16} />
              Abrir Hub
            </a>
          </div>
          {login && (
            <section className="crm-access">
              <div>
                <h2>Acesso da equipe</h2>
                <p>Entre para configurar as integrações da EBA.</p>
              </div>
              <a
                className="crm-primary"
                href="/signin-with-chatgpt?return_to=%2Fintegracoes"
                target="_top"
              >
                Entrar <ArrowUpRight size={15} />
              </a>
            </section>
          )}
          {fatal && (
            <div className="crm-error" role="alert">
              {fatal}{" "}
              <button onClick={() => void load()}>Tentar novamente</button>
            </div>
          )}
          {!data && loading && <p role="status">Carregando conexões…</p>}
          {data && (
            <>
              <div
                className="integration-cards"
                role="group"
                aria-label="Apps da EBA"
              >
                {providers.map((p) => {
                  const Icon = symbols[p],
                    c = data.connected.find((x) => x.provider === p),
                    s = data.sources.find(
                      (x) => x.provider === p && x.id === c?.id,
                    );
                  return (
                    <button
                      className="integration-card"
                      key={p}
                      onClick={() => tab(p)}
                      aria-pressed={app === p}
                    >
                      <Icon size={22} />
                      <span className="connection-state">
                        {c?.overdue && !c.error && !c.busy ? "Coleta atrasada" : connectionStatus(c)}
                      </span>
                      <strong>{labels[p]}</strong>
                      <small>{s?.name || guides[p].requirement}</small>
                    </button>
                  );
                })}
              </div>
              <section className="connection-detail">
                <div className="connection-heading">
                  <div>
                    <span className="eyebrow">Conexão selecionada</span>
                    <h2>{labels[app]}</h2>
                    <p>{guides[app].intro}</p>
                  </div>
                  {data.canManage ? <button className="crm-primary" onClick={() => setWizard(app)}>
                    <Plug size={16} />
                    {active ? "Trocar credencial" : "Conectar app"}
                  </button> : <small>Credenciais gerenciadas por administradores</small>}
                </div>
                {current && (
                  <div className="connection-toolbar">
                    <span>
                      {app === "whatsapp" ? "Última verificação" : "Última coleta bem-sucedida"} · {current.lastSuccess ? fmtDate(current.lastSuccess) : "Ainda não realizada"}
                    </span>
                    {active && (
                      <>
                        {data.canManage && <button className="crm-secondary" disabled={!!busy || current.busy}
                          onClick={() => void operate("verify")}>Testar novamente</button>}
                        {app !== "whatsapp" && (
                          <button
                            className="crm-secondary"
                            disabled={!!busy || current.busy}
                            onClick={() => void operate("sync")}
                          >
                            <RefreshCw size={14} />
                            Atualizar agora
                          </button>
                        )}
                        {data.canManage && <button className="link-action" onClick={() => setRemove(true)} disabled={!!busy}>
                          Desconectar
                        </button>}
                      </>
                    )}
                  </div>
                )}
                {remove && data.canManage && (
                  <div
                    className="guide-box"
                    role="group"
                    aria-label="Confirmar desconexão"
                  >
                    <p>
                      Remover a credencial e interromper as consultas deste app?
                    </p>
                    <button
                      className="crm-secondary"
                      onClick={() => setRemove(false)}
                    >
                      Cancelar
                    </button>{" "}
                    <button
                      className="crm-primary"
                      onClick={() => void operate("disconnect")}
                      disabled={!!busy}
                    >
                      Confirmar desconexão
                    </button>
                  </div>
                )}
                {busy && <p role="status">Consultando a Meta…</p>}
                {notice && (
                  <p role="status" className="integration-notice">
                    {notice}
                  </p>
                )}
                {current?.overdue && (
                  <p role="status" className="integration-notice">
                    {app === "whatsapp" ? "A verificação de hoje está atrasada." : "A coleta de hoje está atrasada."}
                  </p>
                )}
                {current?.error && (
                  <p role="alert" className="crm-error">
                    {current.error}{" "}
                    {current.retryAt &&
                      "Próxima tentativa · " + fmtDate(current.retryAt)}
                  </p>
                )}
              </section>
              {history.length > 0 && (
                <div className="source-toolbar">
                  <label>
                    Recurso
                    <select
                      value={selected?.id || ""}
                      onChange={(e) => {
                        setResource(e.target.value);
                        setPage(1);
                      }}
                    >
                      {history.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                          {s.id !== current?.id ? " · Histórico" : ""}
                        </option>
                      ))}
                    </select>
                  </label>
                  {selected?.syncedAt && (
                    <span>
                      {selected.from} a {selected.through} · Atualizada em{" "}
                      {fmtDate(selected.syncedAt)}{" "}
                      {selected.currency &&
                        "· " + selected.currency + " · " + selected.timezone}
                    </span>
                  )}
                </div>
              )}
              {app === "instagram" && selected && (
                <section className="integration-data">
                  <h3>Publicações orgânicas</h3>
                  {selected.syncedAt && data.posts.length === 0 && (
                    <p>Nenhuma publicação no período.</p>
                  )}
                  {data.posts.map((p) => {
                    const found = data.links.find(
                      (l) => l.media === p.id && l.resource === selected.id,
                    );
                    return (
                      <article key={p.id} className="integration-data-row">
                        <div>
                          <strong>
                            {p.caption || "Publicação do Instagram"}
                          </strong>
                          <small>
                            {p.day} · {p.format}
                          </small>
                        </div>
                        <span>
                          {num(p.likes)} curtidas · {num(p.comments)}{" "}
                          comentários
                        </span>
                        <div>
                          {p.url && (
                            <a
                              href={p.url}
                              className="link-action"
                              target="_blank"
                              rel="noreferrer"
                            >
                              Ver post <ArrowUpRight size={14} />
                            </a>
                          )}{" "}
                          {found ? (
                            <a
                              className="link-action"
                              href={hubUrl(found.publication)}
                            >
                              Abrir no Hub <ArrowUpRight size={14} />
                            </a>
                          ) : (
                            <button
                              className="crm-secondary"
                              onClick={() =>
                                setLink({ resource: selected.id, id: p.id })
                              }
                            >
                              Vincular ao Hub
                            </button>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </section>
              )}
              {app === "meta_ads" && selected && (
                <section className="integration-data">
                  <h3>Campanhas por dia</h3>
                  <p>Desempenho reportado pela conta de anúncios.</p>
                  {selected.syncedAt && data.campaigns.length === 0 && (
                    <p>Nenhuma campanha no período.</p>
                  )}
                  {data.campaigns.map((c) => (
                    <article
                      key={c.day + c.id}
                      className="integration-data-row"
                    >
                      <div>
                        <strong>{c.name}</strong>
                        <small>
                          {c.day} · {c.id}
                        </small>
                      </div>
                      <span>{cost(c.spend, selected.currency || "BRL")}</span>
                      <span>
                        {num(c.impressions)} impressões · {num(c.clicks)}{" "}
                        cliques
                      </span>
                    </article>
                  ))}
                </section>
              )}
              {selected?.syncedAt && data.total > 30 && (
                <div className="source-toolbar">
                  <button
                    className="crm-secondary"
                    disabled={page === 1 || loading}
                    onClick={() => setPage(page - 1)}
                  >
                    Anterior
                  </button>
                  <span>
                    Página {page} de {Math.ceil(data.total / 30)}
                  </span>
                  <button
                    className="crm-secondary"
                    disabled={page * 30 >= data.total || loading}
                    onClick={() => setPage(page + 1)}
                  >
                    Próxima
                  </button>
                </div>
              )}
              {app === "whatsapp" && selected && (
                <section className="integration-data">
                  <h3>Conversas com referência</h3>
                  <p>
                    Use +{selected.phone} como destino ao preparar uma
                    publicação no Hub. Registre o desfecho confirmado na ficha
                    da publicação.
                  </p>
                  {matchesWhats.length ? (
                    matchesWhats.map((p) => (
                      <article key={p.id} className="integration-data-row">
                        <div>
                          <strong>{p.title}</strong>
                          <small>{p.code}</small>
                        </div>
                        <div>
                          <a
                            className="link-action"
                            href={p.link}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Abrir conversa <ArrowUpRight size={14} />
                          </a>{" "}
                          <button
                            className="crm-secondary"
                            onClick={async () => {
                              try {
                                await navigator.clipboard.writeText(p.link);
                                setCopied(p.id);
                              } catch {
                                setNotice(
                                  "Abra o link para copiar o endereço.",
                                );
                              }
                            }}
                          >
                            <Copy size={14} />
                            {copied === p.id ? "Copiado" : "Copiar link"}
                          </button>
                        </div>
                        <a className="link-action" href={hubUrl(p.id)}>
                          Registrar resultado <ArrowUpRight size={14} />
                        </a>
                      </article>
                    ))
                  ) : (
                    <a
                      className="link-action"
                      href="/conteudo?marca=eba&vista=editorial"
                    >
                      Preparar uma publicação <ArrowUpRight size={14} />
                    </a>
                  )}
                </section>
              )}
              <section className="integration-data">
                  <h3>Histórico de consultas</h3>
                  <label>Estado da consulta{" "}
                    <select value={jobStatus} onChange={(event) => { setJobStatus(event.target.value); setJobPage(1); }}>
                      <option value="">Todos</option>
                      <option value="ok">Concluída</option>
                      <option value="failed">Falhou</option>
                      <option value="running">Em andamento ou interrompida</option>
                      <option value="cancelled">Cancelada</option>
                    </select>
                  </label>
                  {!data.jobs.length && <p>Nenhuma consulta neste filtro.</p>}
                  {data.jobs.map((j) => (
                    <article key={j.id} className="integration-data-row">
                      <div>
                        <strong>
                          {labels[j.provider]} ·{" "}
                          {statusLabels[j.status] || j.status}
                        </strong>
                        <small>
                          {fmtDate(j.started)} ·{" "}
                          {j.trigger === "daily"
                            ? "Diária"
                            : j.trigger === "test"
                              ? "Teste"
                              : "Manual"}
                        </small>
                      </div>
                      <span>{j.detail}</span>
                    </article>
                  ))}
                  <HistoryPages page={jobPage} next={data.jobsNext} change={setJobPage} label="Consultas" />
              </section>
              {data.canManage && (data.audit.length > 0 || auditPage > 1) && (
                <section className="integration-data">
                  <h3>Alterações de credenciais</h3>
                  {data.audit.map((item) => (
                    <article key={item.id} className="integration-data-row">
                      <div>
                        <strong>{{ connect: "Conectou", rotate: "Trocou a credencial", disconnect: "Desconectou" }[item.action]}</strong>
                        <small>{item.author} · {fmtDate(item.at)}</small>
                      </div>
                      <span>Recurso {item.resource}</span>
                    </article>
                  ))}
                  <HistoryPages page={auditPage} next={data.auditNext} change={setAuditPage} label="Alterações" />
                </section>
              )}
              {wizard && data.canManage && (
                <Wizard
                  app={wizard}
                  close={() => setWizard(null)}
                  saved={() => {
                    setWizard(null);
                    setResource("");
                    setPage(1);
                    setNotice("Conexão confirmada.");
                    void load();
                  }}
                />
              )}
              {link && (
                <LinkPost
                  {...link}
                  data={data}
                  done={() => {
                    setLink(null);
                    void load();
                  }}
                />
              )}
            </>
          )}
        </div>
        <footer className="crm-foot">
          EBA Growth <ArrowUpRight size={12} /> Integrações
        </footer>
      </main>
    </div>
  );
}
