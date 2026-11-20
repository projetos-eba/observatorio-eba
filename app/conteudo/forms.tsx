"use client";
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { ArrowRight, X } from "lucide-react";
import {
  activeAssets,
  activeGuides,
  assetEligible,
  assetKinds,
  channels,
  directiveKinds,
  formats,
  guideEligible,
  matchesResult,
  memberName,
  outcomes,
  pico,
  pointerKey,
  suggestion,
  today,
  type Asset,
  type Channel,
  type Directive,
  type Edition,
  type FileRef,
  type Goal,
  type HubData,
  type Piece,
  type Publication,
  type Result,
  type ResultInput,
  type Stage,
} from "./model";
import { cents, csvModel, resultPreview } from "./results-csv";

export type Workflow =
  | "Produzir"
  | "Enviar para revisão"
  | "Solicitar ajustes"
  | "Aprovar"
  | "Avaliar"
  | "Comentar";
export type Dialog =
  | { type: "edition"; edit?: Edition; reuse?: Publication; decision?: string }
  | { type: "asset"; edit?: Asset }
  | { type: "guide"; edit?: Directive }
  | { type: "assetApprove"; record: Asset }
  | { type: "guideApprove"; record: Directive }
  | { type: "workflow"; piece: Piece; action: Workflow }
  | { type: "prepare"; piece: Piece }
  | { type: "publish"; pub: Publication }
  | { type: "result"; edit?: Result; pub?: Publication }
  | { type: "csv" };
type Save = (change: Record<string, unknown>) => Promise<void>;
const titles = {
  edition: "Briefing da peça",
  asset: "Versão do ativo",
  guide: "Diretriz de marca",
  assetApprove: "Aprovar ativo",
  guideApprove: "Aprovar diretriz",
  workflow: "Fluxo editorial",
  prepare: "Preparar publicação",
  publish: "Confirmar publicação",
  result: "Registrar resultado",
  csv: "Importar resultados",
};
function input(
  name: string,
  label: string,
  value = "",
  opts: React.InputHTMLAttributes<HTMLInputElement> = {},
) {
  return (
    <label>
      {label}
      <input name={name} defaultValue={value} maxLength={240} {...opts} />
    </label>
  );
}
function area(name: string, label: string, value = "", required = true) {
  return (
    <label className="cw">
      {label}
      <textarea
        name={name}
        rows={3}
        defaultValue={value}
        maxLength={6000}
        required={required}
      />
    </label>
  );
}
function select(
  name: string,
  label: string,
  options: readonly (string | [string, string])[],
  value: string,
  required = true,
) {
  return (
    <label>
      {label}
      <select name={name} defaultValue={value} required={required}>
        {options.map((o) => {
          const [v, label] = typeof o === "string" ? [o, o] : o;
          return (
            <option value={v} key={v}>
              {label}
            </option>
          );
        })}
      </select>
    </label>
  );
}
const optional = (
  label: string,
  values: readonly (string | [string, string])[],
) => [["", label] as [string, string], ...values];
function fileDownload() {
  const url = URL.createObjectURL(
    new Blob(["\uFEFF", csvModel], { type: "text/csv;charset=utf-8" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = "resultados-eba.csv";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function HubForm({
  dialog,
  data,
  save,
  close,
}: {
  dialog: Dialog;
  data: HubData;
  save: Save;
  close: () => void;
}) {
  const type = dialog.type,
    idea =
      dialog.type === "edition" && dialog.reuse
        ? suggestion(data, dialog.reuse)
        : null;
  const prior =
    dialog.type === "edition" ? dialog.edit || idea?.edition : undefined;
  const [channel, setChannel] = useState<Channel>(
    idea?.channel || prior?.channel || "Instagram",
  );
  const [goal, setGoal] = useState<Goal>(
    (dialog.type === "result" ? dialog.edit?.goal : prior?.goal) ||
      "Lead confirmado",
  );
  const [stage, setStage] = useState<Stage>(
    prior?.stage ||
      data.references.find(
        (r) => dialog.type === "edition" && r.id === dialog.decision,
      )?.stage ||
      "Posicionar",
  );
  const [chosen, setChosen] = useState<string[]>(
    (idea?.assets || prior?.assets || []).map(pointerKey),
  );
  const [destination, setDestination] =
    useState<Publication["destination"]>("Site");
  const [source, setSource] = useState<"file" | "link">(
    dialog.type === "asset" && dialog.edit?.url ? "link" : "file",
  );
  const [csv, setCsv] = useState<ReturnType<typeof resultPreview>>([]);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const node = useRef<HTMLDialogElement>(null);
  const staged = useRef<{
    file: File;
    token: string;
    uploaded?: FileRef;
  } | null>(null);
  const team = data.members.map((m) => [m.id, m.name] as [string, string]);
  const assets = activeAssets(data).filter((a) => assetEligible(a, channel));
  const matching = activeGuides(data).filter((g) =>
    guideEligible(g, { channel, goal, stage }),
  );
  const [resultCode, setResultCode] = useState(
    dialog.type === "result" ? dialog.edit?.code || dialog.pub?.code || "" : "",
  );
  useEffect(() => {
    const modal = node.current;
    modal?.showModal();
    return () => modal?.close();
  }, []);

  let content: ReactNode;
  switch (type) {
    case "edition": {
      const leaf = dialog.edit;
      const decision = data.references.find((item) => item.kind === "PICO" && item.id === dialog.decision);
      const decisionBrief = decision?.context && [decision.title, decision.context.step, decision.context.evidence]
        .filter(Boolean).join("\n\n").slice(0, 4000);
      const precopy = idea
        ? "Adapte a abordagem de “" +
          idea.edition.title +
          "” para " +
          idea.format.toLowerCase() +
          ". Hipótese: manter a promessa e testar um novo formato."
        : decisionBrief || "";
      content = (
        <>
          {idea && (
            <p className="cw hub-form-note">
              Origem · {idea.edition.title} · {idea.count} {idea.edition.goal}{" "}
              em até 30 dias · {idea.publication.code}
            </p>
          )}
          <div className="cw">
            {input(
              "title",
              "Título",
              leaf?.title ||
                (idea ? idea.edition.title + " · " + idea.format : (decision?.context?.step || "").slice(0, 240)),
              { required: true },
            )}
          </div>
          <label>
            Canal
            <select
              value={channel}
              onChange={(e) => {
                setChannel(e.target.value as Channel);
                setChosen([]);
              }}
            >
              {channels.map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </label>
          {select(
            "format",
            "Formato",
            formats,
            idea?.format || prior?.format || "Carrossel",
          )}
          <label>
            Objetivo
            <select
              value={goal}
              onChange={(e) => setGoal(e.target.value as Goal)}
            >
              {outcomes.map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </label>
          <label>
            Etapa PICO
            <select
              value={stage}
              onChange={(e) => setStage(e.target.value as Stage)}
            >
              {pico.map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </label>
          {select("owner", "Responsável", team, leaf?.owner || data.me)}
          {input("due", "Prazo", leaf?.due || today(), {
            type: "date",
            required: true,
          })}
          {area("brief", "Briefing e hipótese", leaf?.brief || precopy)}
          {area(
            "plan",
            "Plano de medição",
            leaf?.plan ||
              (idea
                ? "Registrar " +
                  idea.edition.goal.toLowerCase() +
                  " com o código da nova publicação e revisar após 30 dias."
                : ""),
          )}
          {select(
            "decision",
            "Decisão da Carteira",
            optional(
              "Sem vínculo",
              data.references
                .filter((r) => r.kind === "PICO")
                .map((r) => [r.id, r.title]),
            ),
            leaf?.decision || dialog.decision || "",
            false,
          )}
          {select(
            "radar",
            "Análise ou insight do Radar",
            optional(
              "Sem vínculo",
              data.references
                .filter((r) => r.kind !== "PICO")
                .map((r) => [r.kind + ":" + r.id, r.title]),
            ),
            leaf?.radar || prior?.radar || "",
            false,
          )}
          <fieldset className="cw hub-choice">
            <legend>Ativos válidos para o canal</legend>
            {assets.length ? (
              assets.map((a) => (
                <label key={a.id}>
                  <input
                    type="checkbox"
                    checked={chosen.includes(pointerKey(a))}
                    onChange={(e) =>
                      setChosen(
                        e.target.checked
                          ? [...chosen, pointerKey(a)]
                          : chosen.filter((k) => k !== pointerKey(a)),
                      )
                    }
                  />
                  {a.title} · v{a.version}
                </label>
              ))
            ) : (
              <p>Sem ativos aprovados para este canal.</p>
            )}
            {chosen.some((k) => !assets.some((a) => pointerKey(a) === k)) && (
              <p className="hub-warn">
                Ativos vencidos ou substituídos serão retirados desta versão.
                Escolha os substitutos aqui.
              </p>
            )}
          </fieldset>
          <div className="cw hub-guides">
            <strong>Diretrizes vigentes para este briefing</strong>
            {matching.length ? (
              matching.map((g) => (
                <details key={g.id}>
                  <summary>
                    {g.kind} · {g.title}
                  </summary>
                  <p>{g.text}</p>
                  {g.source && <small>Origem · {g.source}</small>}
                </details>
              ))
            ) : (
              <p>Nenhuma diretriz aprovada coincide com este foco.</p>
            )}
          </div>
        </>
      );
      break;
    }
    case "asset": {
      const a = dialog.edit;
      content = (
        <>
          {input("title", "Nome do ativo", a?.title, { required: true })}
          {select("kind", "Categoria", assetKinds, a?.kind || "Fotografia")}
          {select("owner", "Responsável", team, a?.owner || data.me)}
          {input("expires", "Validade dos direitos", a?.expires, {
            type: "date",
          })}
          {area("rights", "Direitos de uso", a?.rights)}
          <fieldset className="cw hub-choice">
            <legend>Canais permitidos</legend>
            {channels.map((c) => (
              <label key={c}>
                <input
                  type="checkbox"
                  name="channels"
                  value={c}
                  defaultChecked={a?.channels.includes(c)}
                />
                {c}
              </label>
            ))}
          </fieldset>
          <label className="cw">
            Origem do ativo
            <select
              value={source}
              onChange={(e) => setSource(e.target.value as typeof source)}
            >
              <option value="file">Arquivo local</option>
              <option value="link">Link externo</option>
            </select>
          </label>
          {source === "file" ? (
            <label className="cw">
              Arquivo JPG, PNG, WebP ou PDF · até 15 MB
              <input
                aria-label="Arquivo do ativo"
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  staged.current = file
                    ? { file, token: crypto.randomUUID() }
                    : null;
                }}
              />
              {a?.file && <small>Arquivo desta versão · {a.file.name}</small>}
            </label>
          ) : (
            <div className="cw">
              {input("url", "Link HTTPS", a?.url, {
                type: "url",
                required: true,
                maxLength: 3000,
              })}
            </div>
          )}
        </>
      );
      break;
    }
    case "guide": {
      const g = dialog.edit;
      content = (
        <>
          {input("title", "Título da diretriz", g?.title, { required: true })}
          {select("kind", "Categoria", directiveKinds, g?.kind || "Mensagem")}
          {select("owner", "Responsável", team, g?.owner || data.me)}
          {input("review", "Data de revisão", g?.review, {
            required: true,
            type: "date",
          })}
          {area("text", "Diretriz", g?.text)}
          <div className="cw">
            {input("source", "Origem da diretriz", g?.source, {
              maxLength: 3000,
            })}
          </div>
          {select(
            "goal",
            "Objetivo",
            optional("Todos", outcomes),
            g?.goal || "",
            false,
          )}
          {select(
            "channel",
            "Canal",
            optional("Todos", channels),
            g?.channel || "",
            false,
          )}
          {select(
            "stage",
            "Etapa PICO",
            optional("Todas", pico),
            g?.stage || "",
            false,
          )}
        </>
      );
      break;
    }
    case "assetApprove":
    case "guideApprove":
      content = (
        <>
          <p className="cw hub-form-note">
            {dialog.record.title} · revisão v{dialog.record.version}
          </p>
          {area("proof", "Comprovante de aprovação")}
        </>
      );
      break;
    case "workflow":
      content = (
        <>
          <p className="cw hub-form-note">
            {dialog.action} · versão v{dialog.piece.edition}
          </p>
          {dialog.action === "Aprovar"
            ? area("proof", "Comprovante de aprovação")
            : null}
          {["Avaliar", "Comentar", "Solicitar ajustes"].includes(dialog.action)
            ? area(
                "note",
                dialog.action === "Avaliar"
                  ? "Resultado da avaliação"
                  : dialog.action === "Solicitar ajustes"
                    ? "Ajustes solicitados"
                    : "Comentário",
              )
            : null}
        </>
      );
      break;
    case "prepare":
      content = (
        <>
          <label>
            Destino do link
            <select
              value={destination}
              onChange={(e) =>
                setDestination(e.target.value as typeof destination)
              }
            >
              <option>Site</option>
              <option>WhatsApp</option>
            </select>
          </label>
          {destination === "Site" ? (
            input("target", "URL HTTPS do destino", "", {
              type: "url",
              required: true,
              maxLength: 3000,
            })
          ) : (
            <>
              {input("target", "Telefone com DDI e DDD", "", {
                type: "tel",
                required: true,
                pattern: "[1-9][0-9]{9,14}",
              })}
              {area(
                "message",
                "Mensagem inicial",
                "Olá! Quero saber mais.",
                false,
              )}
            </>
          )}
          <p className="cw hub-form-note">
            O destino precisa guardar o código para que o evento confirmado
            possa ser relacionado à publicação.
          </p>
        </>
      );
      break;
    case "publish":
      content = (
        <>
          {input("date", "Data em que foi ao ar", today(), {
            type: "date",
            required: true,
            max: today(),
          })}
          {area("reference", "URL publicada ou comprovante")}
          <p className="cw hub-form-note">
            Referência da campanha · {dialog.pub.code}
          </p>
        </>
      );
      break;
    case "result": {
      const r = dialog.edit;
      content = (
        <>
          <label>
            Tipo de resultado
            <select
              value={goal}
              disabled={!!r}
              onChange={(e) => setGoal(e.target.value as Goal)}
            >
              {outcomes.map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
          </label>
          {input("externalId", "ID do evento na origem", r?.externalId, {
            required: true,
            maxLength: 120,
            readOnly: !!r,
          })}
          {input("date", "Data do evento", r?.date || today(), {
            type: "date",
            required: true,
            max: today(),
          })}
          {input("source", "Fonte do resultado", r?.source, {
            required: true,
            placeholder: "Ex. Atendimento ou CRM do cliente",
          })}
          <label>
            Código da publicação
            <input
              value={resultCode}
              maxLength={80}
              onChange={(e) => setResultCode(e.target.value)}
            />
          </label>
          {goal === "Venda" &&
            input(
              "value",
              "Valor em reais",
              r?.value == null
                ? ""
                : (r.value / 100).toFixed(2).replace(".", ","),
              { inputMode: "decimal", placeholder: "1500,00" },
            )}
          <p className="cw hub-form-note">
            Use um identificador do evento na origem. Se a referência da
            publicação estiver ausente, o resultado entra na fila de vínculos
            pendentes.
          </p>
        </>
      );
      break;
    }
    case "csv":
      content = (
        <>
          <div className="cw hub-upload">
            <label>
              Arquivo de resultados CSV
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  setCsv([]);
                  setError("");
                  if (!file) return;
                  try {
                    setCsv(resultPreview(await file.text(), data));
                  } catch (error) {
                    setError((error as Error).message);
                  }
                }}
              />
            </label>
            <button
              type="button"
              className="link-action"
              onClick={fileDownload}
            >
              Baixar modelo CSV
            </button>
          </div>
          {csv.length > 0 && (
            <ul className="cw hub-preview">
              {csv.map((r) => (
                <li key={r.line}>
                  Linha {r.line} · {r.row.goal} · {r.row.externalId}
                  <span className={r.error || r.issue ? "hub-warn" : ""}>
                    {r.error || r.issue || "Vínculo confirmado"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </>
      );
      break;
  }

  async function submit(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    if (busy) return;
    const fields = new FormData(ev.currentTarget),
      value = (name: string) => String(fields.get(name) || "").trim();
    const pick = (keys: string[]) =>
      Object.fromEntries(keys.map((k) => [k, value(k)]));
    setBusy(true);
    setError("");
    try {
      let change: Record<string, unknown>;
      switch (dialog.type) {
        case "edition":
          change = {
            kind: "edition",
            edition: {
              id: dialog.edit?.id || "",
              ...pick([
                "title",
                "brief",
                "format",
                "owner",
                "due",
                "decision",
                "radar",
                "plan",
              ]),
              channel,
              goal,
              stage,
              reuse: dialog.reuse?.id || "",
              assets: assets
                .filter((a) => chosen.includes(pointerKey(a)))
                .map(({ id, version }) => ({ id, version })),
            },
          };
          break;
        case "guide":
          change = {
            kind: "guide",
            guide: {
              id: dialog.edit?.id || "",
              ...pick([
                "title",
                "kind",
                "text",
                "source",
                "owner",
                "review",
                "goal",
                "stage",
                "channel",
              ]),
            },
          };
          break;
        case "asset": {
          if (!fields.getAll("channels").length)
            throw Error("Escolha pelo menos um canal para o ativo.");
          let file = source === "file" ? dialog.edit?.file || null : null;
          const current = staged.current;
          if (source === "file" && current) {
            if (current.file.size > 15 * 1024 * 1024)
              throw Error("O arquivo excede 15 MB.");
            if (!current.uploaded) {
              const response = await fetch(
                "/api/conteudo/arquivo?" +
                  new URLSearchParams({
                    marca: data.brand.id,
                    envio: current.token,
                    nome: current.file.name,
                  }),
                { method: "PUT", body: current.file },
              );
              const result = (await response.json()) as FileRef & {
                error?: string;
              };
              if (!response.ok)
                throw Error(
                  result.error || "Tente enviar o arquivo novamente.",
                );
              current.uploaded = result;
            }
            file = current.uploaded;
          }
          if (source === "file" && !file) throw Error("Selecione o arquivo.");
          change = {
            kind: "asset",
            asset: {
              id: dialog.edit?.id || "",
              ...pick(["title", "kind", "owner", "rights", "expires"]),
              channels: fields.getAll("channels"),
              url: source === "link" ? value("url") : "",
              file,
            },
          };
          break;
        }
        case "assetApprove":
          change = {
            kind: "assetApprove",
            asset: { id: dialog.record.id, version: dialog.record.version },
            proof: value("proof"),
          };
          break;
        case "guideApprove":
          change = {
            kind: "guideApprove",
            guide: { id: dialog.record.id, version: dialog.record.version },
            proof: value("proof"),
          };
          break;
        case "workflow":
          change = {
            kind: "workflow",
            piece: dialog.piece.id,
            action: dialog.action,
            ...pick(["note", "proof"]),
          };
          break;
        case "prepare":
          change = {
            kind: "prepare",
            piece: dialog.piece.id,
            destination,
            ...pick(["target", "message"]),
          };
          break;
        case "publish":
          change = {
            kind: "publish",
            publication: dialog.pub.id,
            ...pick(["date", "reference"]),
          };
          break;
        case "result": {
          const row: ResultInput = {
            goal,
            externalId: value("externalId"),
            date: value("date"),
            source: value("source"),
            code: resultCode.trim(),
            value: goal === "Venda" ? cents(value("value")) : null,
          };
          change = {
            kind: "results",
            rows: [row],
            correct: dialog.edit?.id || "",
          };
          break;
        }
        case "csv":
          change = {
            kind: "results",
            rows: csv.map((r) => r.row),
            correct: "",
          };
          break;
      }
      await save(change);
      close();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Falha ao salvar.");
    } finally {
      setBusy(false);
    }
  }
  const disabled =
    busy || (type === "csv" && (!csv.length || csv.some((row) => row.error)));
  const submitLabel =
    type === "workflow"
      ? dialog.action
      : type === "csv"
        ? "Confirmar importação"
        : "Salvar";
  return (
    <dialog
      ref={node}
      className="crm-modal hub-modal"
      aria-labelledby="hub-dialog-title"
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) close();
      }}
    >
      <header>
        <span className="eyebrow">{data.brand.name}</span>
        <h2 id="hub-dialog-title">{titles[type]}</h2>
        <button
          className="icon-action"
          aria-label="Fechar formulário"
          onClick={close}
          disabled={busy}
        >
          <X size={18} />
        </button>
      </header>
      <form onSubmit={submit}>
        <div className="crm-fields">{content}</div>
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
              onClick={close}
              disabled={busy}
            >
              Cancelar
            </button>
            <button className="crm-primary" disabled={disabled}>
              {busy ? "Salvando…" : submitLabel}
              <ArrowRight size={15} />
            </button>
          </div>
        </footer>
      </form>
    </dialog>
  );
}
