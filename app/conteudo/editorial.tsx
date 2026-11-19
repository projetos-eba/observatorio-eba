import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  ClipboardList,
  GitFork,
  LayoutGrid,
  Plus,
} from "lucide-react";
import { accountUrl } from "../carteira/views";
import {
  assetIssue,
  dateLabel,
  editionFor,
  latest,
  memberName,
  monday,
  nameUrl,
  offsetDay,
  opportunities,
  stages,
  today,
  weekLabel,
  windowOpen,
  type Edition,
  type HubData,
  type Piece,
} from "./model";
import type { Dialog, Workflow } from "./forms";

export type Open = (dialog: Dialog) => void;
export const sectionUrl = (data: HubData, view: string, id?: string) =>
  nameUrl(data.brand.id, view, id);
export function Blank({
  title,
  children,
}: {
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <section className="hub-empty">
      <ClipboardList size={27} />
      <h2>{title}</h2>
      {children && <p>{children}</p>}
    </section>
  );
}
export function Source({ value }: { value: string }) {
  if (/^https:\/\//i.test(value))
    return (
      <a className="link-action" href={value} target="_blank" rel="noreferrer">
        {value} <ArrowUpRight size={14} />
      </a>
    );
  return <span>{value}</span>;
}
export function stageName(s: string) {
  return <span className="hub-tag">{s}</span>;
}
export function section(title: string, action?: React.ReactNode) {
  return (
    <div className="hub-section">
      <h2>{title}</h2>
      {action}
    </div>
  );
}
export function recordedAt(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}
function PieceLink({ data, p, e }: { data: HubData; p: Piece; e: Edition }) {
  return (
    <a className="hub-piece" href={sectionUrl(data, "editorial", p.id)}>
      <span>
        {e.channel} · {e.format}
      </span>
      <strong>{e.title}</strong>
      <small>
        {memberName(data, e.owner)} · {dateLabel(e.due)}
      </small>
    </a>
  );
}
export function Today({ data, open }: { data: HubData; open: Open }) {
  const all = latest(data.pieces);
  const queue = all
    .flatMap((p) => {
      const e = editionFor(data, p);
      return e &&
        ["Pauta", "Produção", "Revisão", "Aprovada"].includes(p.status)
        ? [{ p, e }]
        : [];
    })
    .sort((a, b) => a.e.due.localeCompare(b.e.due));
  const assets = latest(data.assets.filter((a) => a.approved))
    .filter((a) => a.expires && a.expires <= offsetDay(today(), 14))
    .sort((a, b) => a.expires.localeCompare(b.expires));
  const ideas = opportunities(data);
  return (
    <>
      <section className="hub-pulse">
        <div>
          <span>Peças em andamento</span>
          <b>{String(queue.length).padStart(2, "0")}</b>
        </div>
        <div>
          <span>Em revisão</span>
          <strong>
            {queue.filter((x) => x.p.status === "Revisão").length}
          </strong>
        </div>
        <div>
          <span>Sugestões de reuso</span>
          <strong>{ideas.length}</strong>
        </div>
      </section>
      <div className="hub-home-grid">
        <section>
          {section(
            "Próximas entregas",
            <a className="link-action" href={sectionUrl(data, "editorial")}>
              Abrir calendário <ArrowUpRight size={14} />
            </a>,
          )}
          {queue.length ? (
            <div className="hub-rows">
              {queue.slice(0, 10).map(({ p, e }) => (
                <div className="hub-row" key={p.id}>
                  <PieceLink data={data} p={p} e={e} />
                  <span className={e.due < today() ? "hub-warn" : ""}>
                    {p.status} {e.due < today() && "· Prazo vencido"}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <Blank
              title={
                all.length ? "Produção em dia" : "Comece pela primeira peça"
              }
            >
              {all.length
                ? "Sem entregas editoriais abertas para esta marca."
                : "Abra um briefing e defina como a equipe vai medir o resultado."}
            </Blank>
          )}
          {assets.length > 0 && (
            <section className="hub-due-assets">
              {section("Validade dos ativos")}
              {assets.map((a) => (
                <a
                  className="hub-row"
                  key={a.id}
                  href={sectionUrl(data, "marca", a.id)}
                >
                  <b>{a.title}</b>
                  <span className="hub-warn">
                    {a.expires < today() ? "Vencido" : "Vence"} ·{" "}
                    {dateLabel(a.expires)}
                  </span>
                </a>
              ))}
            </section>
          )}
        </section>
        <aside className="hub-reuse">
          {section("Vale reaproveitar")}
          {ideas.length ? (
            ideas.slice(0, 7).map((idea) => (
              <article className="reuse-card" key={idea.publication.id}>
                <span className="hub-tag">
                  {idea.edition.goal} · {idea.count}
                </span>
                <h3>{idea.edition.title}</h3>
                <p>
                  {idea.edition.format} → {idea.format} · {idea.channel}
                </p>
                <p>
                  {windowOpen(idea.publication)
                    ? "Janela de 30 dias aberta"
                    : "Primeiros 30 dias consolidados"}{" "}
                  · {idea.assets.length} ativos elegíveis
                </p>
                {idea.guides.find((g) => g.kind === "CTA") && (
                  <p>
                    CTA aprovado ·{" "}
                    {idea.guides.find((g) => g.kind === "CTA")!.title}
                  </p>
                )}
                <div className="hub-actions">
                  <button
                    className="crm-secondary"
                    onClick={() =>
                      open({ type: "edition", reuse: idea.publication })
                    }
                  >
                    <GitFork size={15} />
                    Reaproveitar
                  </button>
                  <a
                    className="link-action"
                    href={sectionUrl(data, "resultados", idea.publication.id)}
                  >
                    Ver evidência <ArrowUpRight size={14} />
                  </a>
                </div>
              </article>
            ))
          ) : (
            <p className="hub-muted">
              As sugestões aparecem quando uma peça tiver resultados confirmados
              para o objetivo do briefing.
            </p>
          )}
        </aside>
      </div>
    </>
  );
}
export function Editorial({
  data,
  open,
  selected,
}: {
  data: HubData;
  open: Open;
  selected: string;
}) {
  const [mode, setMode] = useState<"calendar" | "board">("calendar"),
    [week, setWeek] = useState(monday(today()));
  const [query, setQuery] = useState("");
  const pieces = latest(data.pieces);
  const piece = pieces.find((p) => p.id === selected),
    edition = piece && editionFor(data, piece);
  if (piece && edition)
    return (
      <PieceDetail data={data} piece={piece} edition={edition} open={open} />
    );
  const entries = pieces.flatMap((p) => {
    const e = editionFor(data, p);
    return e &&
      [e.title, e.channel, e.format]
        .join(" ")
        .toLocaleLowerCase()
        .includes(query.toLocaleLowerCase())
      ? [{ p, e }]
      : [];
  });
  const dates = Array.from({ length: 7 }, (_, i) => offsetDay(week, i));
  return (
    <>
      <div className="hub-tools">
        <div
          className="crm-switch"
          role="group"
          aria-label="Visualização editorial"
        >
          <button
            aria-pressed={mode === "calendar"}
            onClick={() => setMode("calendar")}
          >
            <CalendarDays size={15} />
            Calendário
          </button>
          <button
            aria-pressed={mode === "board"}
            onClick={() => setMode("board")}
          >
            <LayoutGrid size={15} />
            Quadro
          </button>
        </div>
        <input
          className="hub-search"
          aria-label="Buscar conteúdo"
          type="search"
          placeholder="Buscar conteúdo…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      {mode === "calendar" ? (
        <>
          <div className="hub-calendar-bar">
            <button
              className="crm-secondary"
              aria-label="Semana anterior"
              onClick={() => setWeek(offsetDay(week, -7))}
            >
              <ArrowLeft size={15} />
            </button>
            <strong>{weekLabel(week)}</strong>
            <button
              className="crm-secondary"
              aria-label="Próxima semana"
              onClick={() => setWeek(offsetDay(week, 7))}
            >
              <ArrowRight size={15} />
            </button>
          </div>
          <div className="hub-calendar">
            {dates.map((d) => (
              <section
                key={d}
                className={"hub-day" + (d === today() ? " is-today" : "")}
              >
                <h3>
                  {dateLabel(d).split(" de ")[0]}{" "}
                  <span>
                    {new Date(d + "T12:00:00Z").toLocaleDateString("pt-BR", {
                      weekday: "short",
                      timeZone: "UTC",
                    })}
                  </span>
                </h3>
                {entries
                  .filter(({ e }) => e.due === d)
                  .map(({ e, p }) => (
                    <PieceLink key={p.id} data={data} p={p} e={e} />
                  ))}
              </section>
            ))}
          </div>
          {!entries.some(({ e }) => dates.includes(e.due)) && (
            <p className="hub-muted">Nenhuma peça com prazo nesta semana.</p>
          )}
        </>
      ) : (
        <div className="hub-board">
          {stages.map((status) => (
            <section key={status}>
              <h3>{status}</h3>
              {entries
                .filter(({ p }) => p.status === status)
                .map(({ p, e }) => (
                  <PieceLink key={p.id} data={data} p={p} e={e} />
                ))}
            </section>
          ))}
        </div>
      )}
      {!pieces.length && (
        <Blank title="Nenhuma peça nesta marca">
          <button
            className="crm-secondary"
            onClick={() => open({ type: "edition" })}
          >
            <Plus size={15} />
            Criar briefing
          </button>
        </Blank>
      )}
    </>
  );
}

function PieceDetail({
  data,
  piece,
  edition,
  open,
}: {
  data: HubData;
  piece: Piece;
  edition: Edition;
  open: Open;
}) {
  const versions = data.editions.filter((e) => e.id === piece.id);
  const current = data.feedback.filter(
    (f) => f.piece === piece.id && f.edition === edition.version,
  );
  const publication = latest(data.publications).filter(
    (p) => p.piece === piece.id,
  );
  const origin =
    edition.parent && data.editions.find((e) => e.id === edition.parent);
  const derived = latest(data.editions).filter((e) => e.parent === piece.id);
  const decision = data.references.find(
    (r) => r.kind === "PICO" && r.id === edition.decision,
  );
  const radar = data.references.find(
    (r) => r.kind + ":" + r.id === edition.radar,
  );
  const warning = edition.assets
    .map((a) => assetIssue(data, a, edition.channel))
    .find(Boolean);
  const workflow = (action: Workflow, primary = false) => (
    <button
      className={primary ? "crm-primary" : "crm-secondary"}
      onClick={() => open({ type: "workflow", piece, action })}
    >
      {action}
    </button>
  );
  const links = (e: Edition) => (
    <>
      {e.assets.map((ref) => {
        const a = data.assets.find(
          (a) => a.id === ref.id && a.version === ref.version,
        );
        return (
          a && (
            <a
              className="link-action"
              key={a.id}
              href={sectionUrl(data, "marca", a.id) + "#asset-" + a.version}
            >
              {a.title} · v{a.version} <ArrowUpRight size={13} />
            </a>
          )
        );
      })}
    </>
  );
  const guidance = (e: Edition) =>
    e.guides.map((ref) => {
      const g = data.directives.find(
        (g) => g.id === ref.id && g.version === ref.version,
      );
      return (
        g && (
          <details key={g.id}>
            <summary>
              {g.kind} · {g.title} · v{g.version}
            </summary>
            <p>{g.text}</p>
            <Source value={g.source} />
          </details>
        )
      );
    });
  return (
    <>
      <a className="link-action" href={sectionUrl(data, "editorial")}>
        <ArrowLeft size={15} /> Conteúdo
      </a>
      <header className="hub-detail-header">
        <div>
          {stageName(piece.status)}
          <h2>{edition.title}</h2>
          <p>
            {edition.format} · {edition.channel} · {edition.stage} ·{" "}
            {memberName(data, edition.owner)} · {dateLabel(edition.due)} · v
            {edition.version}
          </p>
        </div>
        <button
          className="crm-secondary"
          onClick={() => open({ type: "edition", edit: edition })}
        >
          Editar briefing
        </button>
      </header>
      {warning && (
        <p className="hub-alert" role="status">
          Revise os ativos antes de publicar · {warning}
        </p>
      )}
      <div className="hub-actions hub-flow">
        {piece.status === "Pauta" && workflow("Produzir", true)}
        {piece.status === "Produção" && workflow("Enviar para revisão", true)}
        {piece.status === "Revisão" && (
          <>
            {workflow("Aprovar", true)}
            {workflow("Solicitar ajustes")}
          </>
        )}
        {["Aprovada", "Publicada", "Avaliada"].includes(piece.status) && (
          <button
            className="crm-primary"
            onClick={() => open({ type: "prepare", piece })}
          >
            Preparar publicação
          </button>
        )}
        {piece.status === "Publicada" && workflow("Avaliar")}
        {workflow("Comentar")}
      </div>
      <div className="hub-detail-grid">
        <section className="hub-panel">
          <h3>Briefing e hipótese</h3>
          <p className="hub-copy">{edition.brief}</p>
          <h3>Plano de medição · {edition.goal}</h3>
          <p className="hub-copy">{edition.plan}</p>
          {decision && (
            <a
              className="link-action"
              href={accountUrl(data.brand.id.slice(6)) + "#decisoes-conta"}
            >
              {decision.title} <ArrowUpRight size={14} />
            </a>
          )}
          {radar && (
            <a
              className="link-action"
              href={
                radar.kind === "Radar"
                  ? "/?analise=" + encodeURIComponent(radar.id) + "#radar"
                  : "/?insight=" + encodeURIComponent(radar.id) + "#insights"
              }
            >
              {radar.title} <ArrowUpRight size={14} />
            </a>
          )}
          {origin && (
            <div className="hub-lineage">
              <a
                className="link-action"
                href={sectionUrl(data, "editorial", origin.id)}
              >
                <GitFork size={15} />
                {origin.title}
              </a>
              <p>{edition.basis}</p>
              {edition.originPublication && (
                <a
                  className="link-action"
                  href={sectionUrl(
                    data,
                    "resultados",
                    edition.originPublication,
                  )}
                >
                  Ver evidência que originou esta peça{" "}
                  <ArrowUpRight size={14} />
                </a>
              )}
            </div>
          )}
          {!!derived.length && (
            <div className="hub-lineage">
              <b>Peças derivadas</b>
              {derived.map((e) => (
                <a
                  className="link-action"
                  href={sectionUrl(data, "editorial", e.id)}
                  key={e.id}
                >
                  {e.title} <ArrowUpRight size={14} />
                </a>
              ))}
            </div>
          )}
        </section>
        <section className="hub-panel">
          <h3>Ativos desta versão</h3>
          <div className="stack-links">{links(edition)}</div>
          {!edition.assets.length && <p>Nenhum ativo vinculado.</p>}
          <h3>Memória usada no briefing</h3>
          {guidance(edition)}
          {!edition.guides.length && <p>Nenhuma diretriz vinculada.</p>}
        </section>
      </div>
      {section("Publicações")}
      {publication.length ? (
        <div className="hub-rows">
          {publication.map((p) => (
            <a
              className="hub-row"
              key={p.id}
              href={sectionUrl(data, "resultados", p.id)}
            >
              <div>
                <b>
                  {p.destination} · {p.published ? "Publicada" : "Preparada"}
                </b>
                <p>
                  v{p.edition} · {p.code}
                </p>
              </div>
              <ArrowUpRight size={17} />
            </a>
          ))}
        </div>
      ) : (
        <p className="hub-muted">Nenhuma publicação preparada.</p>
      )}
      {section("Versões e histórico")}
      {versions.map((e) => (
        <details
          className="hub-history"
          id={"edicao-" + e.version}
          key={e.version}
          open={e === edition}
        >
          <summary>
            {e === edition ? "Versão atual" : "Versão anterior"} · v{e.version}{" "}
            · {recordedAt(e.at)} · {memberName(data, e.author)}
          </summary>
          {e !== edition && (
            <>
              <h3>{e.title}</h3>
              <p className="hub-copy">{e.brief}</p>
              <div className="stack-links">{links(e)}</div>
              {guidance(e)}
            </>
          )}
          {(e === edition
            ? current
            : data.feedback.filter(
                (f) => f.piece === piece.id && f.edition === e.version,
              )
          ).map((f) => (
            <div className="hub-history-event" key={f.id}>
              <b>{f.kind}</b> · {memberName(data, f.author)} ·{" "}
              {recordedAt(f.at)}
              {f.note && <p>{f.note}</p>}
              {f.proof && (
                <p>
                  Comprovante · <Source value={f.proof} />
                </p>
              )}
            </div>
          ))}
        </details>
      ))}
    </>
  );
}
