import { HubHistory } from "./history";
import { useState } from "react";
import { ArrowLeft, ArrowUpRight, FileText, Image, Plus } from "lucide-react";
import { normalize } from "../crm/model";
import {
  activeAssets,
  activeGuides,
  assetKinds,
  dateLabel,
  downloadUrl,
  latest,
  memberName,
  pointerKey,
  today,
  type Asset,
  type Directive,
  type HubData,
} from "./model";
import {
  Blank,
  recordedAt,
  section,
  sectionUrl,
  Source,
  type Open,
} from "./editorial";

function AssetPreview({ asset, data }: { asset: Asset; data: HubData }) {
  if (asset.file?.type.startsWith("image/"))
    return (
      <img
        className="hub-asset-preview"
        src={downloadUrl(data.brand.id, asset)}
        alt={asset.title}
        loading="lazy"
      />
    );
  return (
    <div className="hub-asset-placeholder">
      {asset.file ? <FileText size={23} /> : <Image size={23} />}
    </div>
  );
}
function AssetDetail({
  data,
  asset,
  open,
}: {
  data: HubData;
  asset: Asset;
  open: Open;
}) {
  const effective = activeAssets(data).find((a) => a.id === asset.id);
  return (
    <>
      <a className="link-action" href={sectionUrl(data, "marca")}>
        <ArrowLeft size={15} /> Marca e ativos
      </a>
      <header className="hub-detail-header">
        <div>
          <span className="hub-tag">{asset.kind}</span>
          <h2>{asset.title}</h2>
          <p>
            {effective
              ? "Versão aprovada v" + effective.version
              : "Aprovação pendente"}{" "}
            · {memberName(data, asset.owner)}
          </p>
        </div>
        <div className="hub-actions">
          <button
            className="crm-secondary"
            onClick={() => open({ type: "asset", edit: asset })}
          >
            Criar nova versão
          </button>
          {!asset.approved && (
            <button
              className="crm-primary"
              onClick={() => open({ type: "assetApprove", record: asset })}
            >
              Aprovar ativo
            </button>
          )}
        </div>
      </header>
      <AssetPreview asset={effective || asset} data={data} />
      {section("Versões, direitos e histórico de uso")}
      <HubHistory<Asset> key={asset.id} brand={data.brand.id} revision={data.version} id={asset.id} kind="asset" anchorPrefix="asset-" render={(a) => (
        <details
          key={a.version}
          id={"asset-" + a.version}
          className="hub-history"
        >
          <summary>
            v{a.version} · {a.approved ? "Aprovada" : "Rascunho"} ·{" "}
            {recordedAt(a.at)}
          </summary>
          <p>
            Responsável · {memberName(data, a.owner)} · Registrado por{" "}
            {memberName(data, a.author)}
          </p>
          <p>{a.rights}</p>
          <p>
            Canais · {a.channels.join(", ")} ·{" "}
            {a.expires
              ? "Validade " + dateLabel(a.expires)
              : "Sem prazo informado"}
          </p>
          {a.proof && (
            <p>
              Comprovante · <Source value={a.proof} />
            </p>
          )}
          {a.file ? (
            <a
              className="link-action"
              href={downloadUrl(data.brand.id, a)}
              target="_blank"
              rel="noreferrer"
            >
              Abrir {a.file.name}
              <ArrowUpRight size={14} />
            </a>
          ) : (
            <Source value={a.url} />
          )}
          <div className="stack-links">
            {data.editions
              .filter((e) =>
                e.assets.some((ref) => pointerKey(ref) === pointerKey(a)),
              )
              .map((e) => (
                <a
                  className="link-action"
                  key={e.version}
                  href={
                    sectionUrl(data, "editorial", e.id) + "#edicao-" + e.version
                  }
                >
                  {e.title} · v{e.version} · {memberName(data, e.author)}{" "}
                  <ArrowUpRight size={14} />
                </a>
              ))}
          </div>
          {data.publications
            .filter(
              (p) =>
                p.published &&
                data.editions.some(
                  (e) =>
                    e.id === p.piece &&
                    e.version === p.edition &&
                    e.assets.some((ref) => pointerKey(ref) === pointerKey(a)),
                ),
            )
            .map((p) => (
              <a
                key={p.version}
                className="link-action"
                href={sectionUrl(data, "resultados", p.id)}
              >
                Publicação · {dateLabel(p.published)} · {p.destination}{" "}
                <ArrowUpRight size={14} />
              </a>
            ))}
        </details>
      )} />
    </>
  );
}
function DirectiveDetail({
  data,
  guide,
  open,
}: {
  data: HubData;
  guide: Directive;
  open: Open;
}) {
  const effective = activeGuides(data).find((g) => g.id === guide.id);
  return (
    <>
      <a className="link-action" href={sectionUrl(data, "marca")}>
        <ArrowLeft size={15} /> Marca e ativos
      </a>
      <header className="hub-detail-header">
        <div>
          <span className="hub-tag">{guide.kind}</span>
          <h2>{guide.title}</h2>
          <p>
            {effective
              ? "Versão aprovada v" + effective.version
              : "Aprovação pendente"}
          </p>
        </div>
        <div className="hub-actions">
          <button
            className="crm-secondary"
            onClick={() => open({ type: "guide", edit: guide })}
          >
            Criar nova versão
          </button>
          {!guide.approved && (
            <button
              className="crm-primary"
              onClick={() => open({ type: "guideApprove", record: guide })}
            >
              Aprovar diretriz
            </button>
          )}
        </div>
      </header>
      <HubHistory<Directive> key={guide.id} brand={data.brand.id} revision={data.version} id={guide.id} kind="guide" render={(g) => (
          <details className="hub-history" key={g.version} open={g.version === guide.version}>
            <summary>
              v{g.version} · {g.approved ? "Aprovada" : "Rascunho"} ·{" "}
              {memberName(data, g.author)}
            </summary>
            <p>{g.text}</p>
            <p>
              {memberName(data, g.owner)} · Revisão {dateLabel(g.review)} ·{" "}
              {[g.goal, g.stage, g.channel].filter(Boolean).join(" · ") ||
                "Aplicação geral"}
            </p>
            {g.source && (
              <p>
                Origem · <Source value={g.source} />
              </p>
            )}
            {g.proof && (
              <p>
                Comprovante · <Source value={g.proof} />
              </p>
            )}
          </details>
        )} />
    </>
  );
}
export function Library({
  data,
  selected,
  open,
}: {
  data: HubData;
  selected: string;
  open: Open;
}) {
  const [view, setView] = useState<"guides" | "assets">("guides");
  const [query, setQuery] = useState(""),
    [category, setCategory] = useState("");
  const assets = latest(data.assets),
    guides = latest(data.directives);
  const asset = assets.find((a) => a.id === selected),
    guide = guides.find((g) => g.id === selected);
  if (asset) return <AssetDetail data={data} asset={asset} open={open} />;
  if (guide) return <DirectiveDetail data={data} guide={guide} open={open} />;
  const contains = (s: string) => normalize(s).includes(normalize(query));
  const accepted = assets.filter(
    (a) =>
      (!category || a.kind === category) && contains(a.title + " " + a.rights),
  );
  const editorial = guides.filter((g) =>
    contains(g.title + " " + g.text + " " + g.kind),
  );
  return (
    <>
      <div className="hub-tools">
        <div className="crm-switch">
          <button
            aria-pressed={view === "guides"}
            onClick={() => setView("guides")}
          >
            Brand Brain
          </button>
          <button
            aria-pressed={view === "assets"}
            onClick={() => setView("assets")}
          >
            Biblioteca de ativos
          </button>
        </div>
        <div className="hub-actions">
          <input
            className="hub-search"
            aria-label="Buscar na memória e nos ativos"
            type="search"
            placeholder="Buscar…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {view === "assets" && (
            <select
              aria-label="Categoria de ativo"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="">Todas as categorias</option>
              {assetKinds.map((a) => (
                <option key={a}>{a}</option>
              ))}
            </select>
          )}
          <button
            className="crm-primary"
            onClick={() =>
              open(view === "assets" ? { type: "asset" } : { type: "guide" })
            }
          >
            <Plus size={16} />
            {view === "assets" ? "Novo ativo" : "Nova diretriz"}
          </button>
        </div>
      </div>
      {view === "guides" ? (
        editorial.length ? (
          <div className="hub-library">
            {editorial.map((g) => {
              const active = activeGuides(data).find((row) => row.id === g.id);
              return (
                <a
                  className="hub-panel"
                  href={sectionUrl(data, "marca", g.id)}
                  key={g.id}
                >
                  <span className="hub-tag">{g.kind}</span>
                  <h3>{g.title}</h3>
                  <p>{g.text}</p>
                  <p
                    className={
                      !active || active.review < today() ? "hub-warn" : ""
                    }
                  >
                    {!active
                      ? "Aprovação pendente"
                      : active.review < today()
                        ? "Revisão vencida"
                        : "Em vigor · v" + active.version}{" "}
                    · {dateLabel(g.review)}
                  </p>
                </a>
              );
            })}
          </div>
        ) : (
          <Blank title="Nenhuma diretriz encontrada">
            Cadastre voz, mensagens, provas, CTAs e restrições da marca.
          </Blank>
        )
      ) : accepted.length ? (
        <div className="hub-library">
          {accepted.map((a) => {
            const active = activeAssets(data).find((row) => row.id === a.id);
            return (
              <a
                className="hub-panel"
                href={sectionUrl(data, "marca", a.id)}
                key={a.id}
              >
                <AssetPreview data={data} asset={active || a} />
                <span className="hub-tag">{a.kind}</span>
                <h3>{a.title}</h3>
                <p
                  className={
                    !active || (active.expires && active.expires < today())
                      ? "hub-warn"
                      : ""
                  }
                >
                  {!active
                    ? "Aprovação pendente"
                    : active.expires && active.expires < today()
                      ? "Direitos vencidos"
                      : "Aprovada · v" + active.version}
                </p>
                <p>{a.channels.join(", ")}</p>
              </a>
            );
          })}
        </div>
      ) : (
        <Blank title="Nenhum ativo encontrado">
          Envie imagens e PDFs ou cadastre um link de arquivo da marca.
        </Blank>
      )}
    </>
  );
}
