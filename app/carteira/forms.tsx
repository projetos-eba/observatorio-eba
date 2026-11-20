"use client";
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { X, ArrowRight, Upload } from "lucide-react";
import {
  actions,
  agenda,
  measureFor,
  type Measurement,
  metricLabel,
  monday,
  niches,
  offsetDay,
  outcomes,
  pico,
  profileFor,
  reading,
  rateText,
  suggestions,
  templates,
  today,
  weekLabel,
  type Account,
  type Decision,
  type Portfolio,
  type Niche,
} from "./model";
import {
  csvTemplate,
  measureIssue,
  previewCsv,
  type MeasureInput,
} from "./csv";

export type Modal =
  | {
      kind: "profile" | "measure" | "decision";
      account: Account;
      radarId?: string;
      measurement?: Measurement;
      week?: string;
    }
  | { kind: "review"; decision: Decision }
  | { kind: "include" | "import" | "close" };

const labels = {
  profile: "Configurar conta",
  measure: "Registrar medição",
  decision: "Registrar decisão",
  review: "Revisar decisão",
  include: "Incluir na pauta",
  import: "Importar indicadores",
  close: "Fechar pauta da semana",
};
export type Save = (change: Record<string, unknown>) => Promise<void>;
const field = (
  name: string,
  label: string,
  value = "",
  options: {
    type?: string;
    required?: boolean;
    min?: string;
    max?: string;
    step?: string;
  } = {},
) => (
  <label>
    {label}
    <input name={name} defaultValue={value} {...options} />
  </label>
);
const area = (name: string, label: string, value = "", required = true) => (
  <label className="cw">
    {label}
    <textarea
      name={name}
      defaultValue={value}
      required={required}
      rows={3}
      maxLength={3000}
    />
  </label>
);
const pick = (
  name: string,
  label: string,
  options: [string, string][],
  value = "",
) => (
  <label>
    {label}
    <select name={name} defaultValue={value} required>
      {options.map(([id, text]) => (
        <option key={id} value={id}>
          {text}
        </option>
      ))}
    </select>
  </label>
);
function download(text: string) {
  const url = URL.createObjectURL(
    new Blob(["\uFEFF", text], { type: "text/csv;charset=utf-8" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = "indicadores-eba.csv";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function PortfolioForm({
  modal,
  data,
  close,
  save,
}: {
  modal: Modal;
  data: Portfolio;
  close: () => void;
  save: Save;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [csv, setCsv] = useState<ReturnType<typeof previewCsv>>([]);
  const [replacement, setReplacement] = useState(false);
  const [niche, setNiche] = useState<Niche>(() =>
    "account" in modal
      ? profileFor(data, modal.account.company)?.niche || "outros"
      : "outros",
  );
  const [metric, setMetric] = useState(() =>
    "account" in modal
      ? (profileFor(data, modal.account.company)?.metric ?? 2)
      : 2,
  );
  const [action, setAction] = useState<(typeof actions)[number]>("Testar");
  const [outcome, setOutcome] = useState<(typeof outcomes)[number]>("Encerrar");
  const day = today(),
    week = monday(day);
  const [period, setPeriod] = useState("week" in modal && modal.week ? modal.week : offsetDay(week, -7));
  const [editingCorrection, setEditingCorrection] = useState(false);
  const { kind } = modal;
  const account = "account" in modal ? modal.account : undefined;
  const profile = account ? profileFor(data, account.company) : undefined;
  const current = account
    ? measureFor(data, account.company, period)
    : undefined;
  const owner = profile?.owner || account?.contracts[0]?.lead || data.me;
  const members: [string, string][] = data.members.map((m) => [m.id, m.name]);
  const live = kind === "close" ? agenda(data, week, day) : [];
  const [metricFields, setMetricFields] = useState(
    () =>
      current?.counts.map((x) => (x === null ? "" : String(x))) || [
        "",
        "",
        "",
        "",
      ],
  );
  const [source, setSource] = useState(current?.source || "");
  const canImport =
    csv.length > 0 &&
    !csv.some((r) => r.error) &&
    (!csv.some((r) => r.replace) || replacement);
  useEffect(() => {
    const node = dialog.current;
    node?.showModal();
    return () => node?.close();
  }, []);
  function changePeriod(value: string) {
    if (!account) return;
    const latest = measureFor(data, account.company, value);
    setPeriod(value);
    setSource(latest?.source || "");
    setMetricFields(
      latest?.counts.map((x) => (x === null ? "" : String(x))) || [
        "",
        "",
        "",
        "",
      ],
    );
    setEditingCorrection(false);
  }
  let content: ReactNode = null;
  if (kind === "profile" && account) {
    const locked = data.measurements.some((m) => m.company === account.company);
    content = (
      <>
        <p className="cw form-help">
          Vincule a operação ao que foi vendido e defina como a equipe vai medir
          o avanço.
        </p>
        <label>
          Modelo do funil
          <select
            value={niche}
            disabled={locked}
            onChange={(e) => setNiche(e.target.value as Niche)}
          >
            {niches.map((n) => (
              <option key={n} value={n}>
                {templates[n].name}
              </option>
            ))}
          </select>
          {locked && <small>Modelo fixado pela primeira medição.</small>}
        </label>
        {pick("owner", "Responsável", members, owner)}
        <label>
          Indicador principal
          <select
            value={metric}
            onChange={(e) => setMetric(Number(e.target.value))}
          >
            {[0, 1, 2, 3].map((i) => (
              <option key={i} value={i}>
                {metricLabel(niche, i)}
              </option>
            ))}
          </select>
        </label>
        {field("target", "Meta (%)", String(profile?.target ?? ""), {
          type: "number",
          required: true,
          min: "0",
          max: "100",
          step: "0.1",
        })}
        {pick(
          "stage",
          "Etapa em foco",
          pico.map((p) => [p, p]),
          profile?.stage || "Posicionar",
        )}
        {pico.map((stage) => (
          <div key={stage} className="cw">
            {area(
              stage,
              "Diagnóstico · " + stage,
              profile?.diagnosis[stage],
              false,
            )}
          </div>
        ))}
      </>
    );
  } else if (kind === "measure" && profile) {
    content = (
      <>
        <p className="form-help cw">
          Indicador principal: <strong>{metricLabel(profile.niche, profile.metric)}</strong>. Use a mesma definição de contagem entre semanas. Campo vazio
          representa dado ausente. Digite 0 para registrar um zero observado.
        </p>
        <label>
          Segunda-feira da semana
          <input
            name="week"
            type="date"
            required
            max={offsetDay(week, -7)}
            value={period}
            onChange={(e) => changePeriod(e.target.value)}
          />
        </label>
        <label>
          Fonte dos dados
          <input
            value={source}
            required
            maxLength={240}
            onChange={(e) => setSource(e.target.value)}
            placeholder="Ex. CRM do cliente"
          />
        </label>
        {templates[profile.niche].steps.map((label, i) => (
          <label key={label}>
            {label}
            <input
              type="number"
              min="0"
              max="1000000000"
              step="1"
              value={metricFields[i]}
              onChange={(e) =>
                setMetricFields(
                  metricFields.map((old, index) =>
                    i === index ? e.target.value : old,
                  ),
                )
              }
            />
          </label>
        ))}
        {current && (
          <label className="cw portfolio-check">
            <input
              type="checkbox"
              checked={editingCorrection}
              onChange={(e) => setEditingCorrection(e.target.checked)}
            />{" "}
            Confirmo a correção desta medição. A versão anterior ficará no
            histórico.
          </label>
        )}
      </>
    );
  } else if (kind === "decision" && profile && account) {
    const prior = modal.measurement || measureFor(data, account.company, offsetDay(week, -7));
    const evidence = prior
      ? weekLabel(prior.week) +
        ": " +
        metricLabel(profile.niche, profile.metric) +
        " — " +
        rateText(reading(prior, profile.metric)) +
        ". Fonte: " +
        prior.source
      : "";
    const recommended = suggestions(data, profile);
    const radar = data.signals.filter(
      (s) =>
        s.id === modal.radarId ||
        profile.radarIds.includes(s.id) ||
        recommended.some((item) => item.id === s.id),
    );
    content = (
      <>
        <label>
          Decisão
          <select
            value={action}
            onChange={(e) => setAction(e.target.value as typeof action)}
          >
            {actions.map((a) => (
              <option key={a}>{a}</option>
            ))}
          </select>
        </label>
        {pick(
          "stage",
          "Etapa PICO",
          pico.map((p) => [p, p]),
          profile.stage,
        )}
        {area(
          "reason",
          action === "Arquivar" ? "Motivo do arquivamento" : "Justificativa",
        )}
        {modal.measurement && <p className="form-help cw">Medição vinculada de {weekLabel(modal.measurement.week)} · versão {modal.measurement.version}</p>}
        {area("evidence", "Evidência", evidence)}
        <label className="cw">
          Análise do Radar
          <select name="radarId" defaultValue={modal.radarId || ""}>
            <option value="">Escolha uma análise, se aplicável</option>
            {radar.map((s) => (
              <option value={s.id} key={s.id}>
                {s.title}
              </option>
            ))}
          </select>
        </label>
        {action !== "Arquivar" && (
          <>
            {area("step", "Próximo passo")}
            {pick("owner", "Responsável", members, owner)}
            {field("due", "Data de revisão", "", {
              type: "date",
              required: true,
            })}
          </>
        )}
      </>
    );
  } else if (kind === "review") {
    const { decision } = modal;
    content = (
      <>
        <p className="cw form-help">{decision.step}</p>
        <label>
          Resultado da revisão
          <select
            value={outcome}
            onChange={(e) => setOutcome(e.target.value as typeof outcome)}
          >
            {outcomes.map((o) => (
              <option key={o}>{o}</option>
            ))}
          </select>
        </label>
        {area("note", "Resultado observado")}
        {outcome !== "Encerrar" && (
          <>
            {area("step", "Próximo passo", decision.step)}
            {pick("owner", "Responsável", members, decision.owner)}
            {field("due", "Nova data de revisão", decision.due, {
              type: "date",
              required: true,
            })}
          </>
        )}
      </>
    );
  } else if (kind === "include") {
    content = pick(
      "company",
      "Conta",
      data.accounts.map((a) => [a.company, a.name]),
      data.accounts[0]?.company,
    );
  } else if (kind === "close") {
    content = (
      <>
        <p className="cw form-help">
          {weekLabel(week)}. Para marcar uma conta como discutida, registre uma
          decisão ou revisão nesta semana.
        </p>
        <fieldset className="cw portfolio-attendance">
          <legend>Participantes</legend>
          {data.members.map((m) => (
            <label className="portfolio-check" key={m.id}>
              <input
                name="participant"
                type="checkbox"
                value={m.id}
                defaultChecked={data.me === m.id}
              />
              {m.name}
            </label>
          ))}
        </fieldset>
        <section className="cw portfolio-close-list">
          {live.map((item) => {
            const discussed = item.decisions.some((d) => d.meeting === week);
            return (
              <label key={item.company}>
                {item.name}
                <select
                  name={"disposition:" + item.company}
                  defaultValue={discussed ? "Discutido" : "Adiado"}
                >
                  <option disabled={!discussed}>Discutido</option>
                  <option>Adiado</option>
                </select>
              </label>
            );
          })}
        </section>
      </>
    );
  } else if (kind === "import") {
    content = (
      <>
        <div className="cw upload-zone">
          <Upload size={21} />
          <div>
            <strong>Selecione o CSV de indicadores</strong>
            <p>
              Até 50 linhas por arquivo. Use o identificador exibido na ficha de
              cada conta.
            </p>
          </div>
          <input
            aria-label="Arquivo de indicadores"
            type="file"
            accept=".csv,text/csv"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              setCsv([]);
              setError("");
              setReplacement(false);
              if (!file) return;
              try {
                setCsv(previewCsv(await file.text(), data));
              } catch (e) {
                setError(
                  e instanceof Error
                    ? e.message
                    : "Não foi possível ler o CSV.",
                );
              }
            }}
          />
          <button
            className="link-action"
            type="button"
            onClick={() => download(csvTemplate)}
          >
            Baixar planilha-modelo
          </button>
        </div>
        {csv.length > 0 && (
          <>
            <div className="cw csv-review">
              <strong>Prévia · {csv.length} linhas</strong>
              <ul>
                {csv.map((r) => (
                  <li key={r.line}>
                    <b>Linha {r.line}</b> ·{" "}
                    {data.accounts.find((a) => a.company === r.row.company)
                      ?.name || r.row.company}{" "}
                    · {r.row.week}{" "}
                    <span className={r.error ? "late" : ""}>
                      {r.error ||
                        (r.replace ? "Substituir medição" : "Nova medição")}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            {csv.some((r) => r.replace) && (
              <label className="cw portfolio-check">
                <input
                  type="checkbox"
                  checked={replacement}
                  onChange={(e) => setReplacement(e.target.checked)}
                />{" "}
                Confirmo a substituição das medições indicadas.
              </label>
            )}
          </>
        )}
      </>
    );
  }
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    const fields = new FormData(e.currentTarget);
    const get = (k: string) => String(fields.get(k) || "").trim();
    let change: Record<string, unknown> = { kind };
    if (kind === "profile" && account)
      change = {
        kind,
        company: account.company,
        niche,
        metric,
        target: Number(get("target")),
        owner: get("owner"),
        stage: get("stage"),
        diagnosis: Object.fromEntries(pico.map((p) => [p, get(p)])),
      };
    if (kind === "measure" && account) {
      const row: MeasureInput = {
        company: account.company,
        week: period,
        source: source.trim(),
        counts: metricFields.map((v) =>
          v === "" ? null : Number(v),
        ) as MeasureInput["counts"],
      };
      const issue = measureIssue(row, data);
      if (issue) {
        setError(issue);
        return;
      }
      if (current && !editingCorrection) {
        setError("Confirme a correção desta medição.");
        return;
      }
      change = { kind, rows: [row] };
    }
    if (kind === "import") {
      if (!canImport) return;
      change = { kind: "measure", rows: csv.map((r) => r.row) };
    }
    if (kind === "decision" && account)
      change = {
        kind,
        company: account.company,
        action,
        ...(modal.measurement ? { measurement: { week: modal.measurement.week, version: modal.measurement.version } } : {}),
        ...Object.fromEntries(
          [
            "reason",
            "evidence",
            "stage",
            "step",
            "owner",
            "due",
            "radarId",
          ].map((k) => [k, get(k)]),
        ),
      };
    if (kind === "review")
      change = {
        kind,
        id: modal.decision.id,
        outcome,
        ...Object.fromEntries(
          ["note", "step", "owner", "due"].map((k) => [k, get(k)]),
        ),
      };
    if (kind === "include") change = { kind, company: get("company"), week };
    if (kind === "close")
      change = {
        kind,
        week,
        participants: fields.getAll("participant"),
        items: live.map((i) => ({
          company: i.company,
          disposition: get("disposition:" + i.company),
        })),
      };
    setBusy(true);
    setError("");
    try {
      await save(change);
      close();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível salvar.");
    } finally {
      setBusy(false);
    }
  }
  const submitLabel =
    kind === "close"
      ? "Fechar e guardar ata"
      : kind === "import"
        ? "Confirmar importação"
        : "Salvar";
  return (
    <dialog
      ref={dialog}
      className="crm-modal portfolio-modal"
      aria-labelledby="portfolio-form"
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) close();
      }}
    >
      <header>
        <span className="eyebrow">{account?.name || "Carteira EBA"}</span>
        <button
          className="icon-action"
          onClick={close}
          disabled={busy}
          aria-label="Fechar formulário"
        >
          <X size={19} />
        </button>
        <h2 id="portfolio-form">{labels[kind]}</h2>
      </header>
      <form onSubmit={submit}>
        <div className="crm-fields">{content}</div>
        <footer>
          {error && (
            <p role="alert" className="crm-error">
              {error}
            </p>
          )}
          <div>
            <button
              type="button"
              className="crm-secondary"
              disabled={busy}
              onClick={close}
            >
              Cancelar
            </button>
            <button
              className="crm-primary"
              disabled={busy || (kind === "import" && !canImport)}
            >
              {busy ? "Salvando…" : submitLabel}
              <ArrowRight size={15} />
            </button>
          </div>
        </footer>
      </form>
    </dialog>
  );
}
