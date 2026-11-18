"use client";
import { useEffect, useRef, useState } from "react";
import { X, ArrowRight, UsersRound } from "lucide-react";
import { digits, stages, kinds, type Deal, type State } from "./model";
export type FormKind =
  | "create"
  | "edit"
  | "return"
  | "contact"
  | "won"
  | "lost";
const titles = {
  create: "Nova oportunidade",
  edit: "Editar oportunidade",
  return: "Registrar retorno",
  contact: "Vincular contato",
  won: "Passar para atendimento",
  lost: "Registrar perda",
};
type Fields = Record<string, string>;
function formatCents(v: number | null | undefined) {
  return v == null ? "" : (v / 100).toFixed(2).replace(".", ",");
}
export function CrmForm({
  action,
  deal,
  state,
  close,
  saved,
  refresh,
}: {
  action: FormKind;
  deal?: Deal;
  state: State;
  close: () => void;
  saved: (id: string) => Promise<void>;
  refresh: () => Promise<void>;
}) {
  const panel = useRef<HTMLDialogElement>(null);
  const stable = useRef({
    requestId: crypto.randomUUID(),
    deal: deal?.id || crypto.randomUUID(),
    revision: deal?.revision || 0,
  });
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [conflict, setConflict] = useState(false);
  const [f, setF] = useState<Fields>(() => ({
    company: state.companies.find((x) => x.id === deal?.company)?.name || "",
    contact: action === "contact" ? "" : deal?.contact || "",
    name: "",
    email: "",
    phone: "",
    source: deal?.source || "",
    stage: deal?.stage || "Entrada",
    owner: deal?.owner || state.me,
    service: deal?.service || "",
    goal: deal?.goal || "",
    monthly: formatCents(deal?.monthly),
    once: formatCents(deal?.once),
    next: action === "return" ? "" : deal?.next || "",
    due: action === "return" ? "" : deal?.due || "",
    kind: "WhatsApp",
    note: "",
    lead: state.me,
    scope: deal?.service || "",
    terms: "",
    first: "",
    date: "",
    reason: "",
  }));
  useEffect(() => {
    const el = panel.current;
    el?.showModal();
    return () => {
      el?.close();
    };
  }, []);
  const change = (k: string, v: string) => {
    setF((p) => ({ ...p, [k]: v }));
    setError("");
  };
  const input = (
    k: string,
    label: string,
    opt: {
      type?: string;
      required?: boolean;
      wide?: boolean;
      multiline?: boolean;
      list?: string;
    } = {},
  ) => (
    <label className={opt.wide ? "cw" : ""}>
      {label}
      {opt.required ? " *" : ""}
      {opt.multiline ? (
        <textarea
          name={k}
          value={f[k]}
          onChange={(e) => change(k, e.target.value)}
          required={opt.required}
          rows={3}
          maxLength={4000}
        />
      ) : (
        <input
          name={k}
          type={opt.type || "text"}
          value={f[k]}
          onChange={(e) => change(k, e.target.value)}
          required={opt.required}
          list={opt.list}
          maxLength={["next", "first", "goal"].includes(k) ? 4000 : 240}
          inputMode={["monthly", "once"].includes(k) ? "decimal" : undefined}
        />
      )}
    </label>
  );
  const select = (
    k: string,
    label: string,
    options: { id: string; name: string }[],
    required = false,
  ) => (
    <label>
      {label}
      {required ? " *" : ""}
      <select
        name={k}
        value={f[k]}
        required={required}
        onChange={(e) => change(k, e.target.value)}
      >
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
    </label>
  );
  const contact = state.contacts.find((x) => x.id === f.contact);
  const matches = state.contacts.filter(
    (x) =>
      (f.email.trim() &&
        x.email.toLowerCase() === f.email.trim().toLowerCase()) ||
      (digits(f.phone) && x.phone === digits(f.phone)),
  );
  const people = (
    <>
      <label className="cw">
        Contato principal{action === "contact" ? " ou adicional" : ""}
        <select
          value={f.contact}
          onChange={(e) => change("contact", e.target.value)}
        >
          <option value="">Digitar novo contato</option>
          {state.contacts.map((x) => (
            <option key={x.id} value={x.id}>
              {x.name} · {x.email || x.phone || "sem canal"}
            </option>
          ))}
        </select>
      </label>
      {contact ? (
        <div className="cw contact-pill">
          <UsersRound size={16} />
          {contact.name} · {contact.phone || contact.email || "Canal a definir"}
        </div>
      ) : (
        <>
          {input("name", "Nome do contato", {
            required: action === "contact" || action === "won",
            wide: true,
          })}
          {input("phone", "Telefone", { type: "tel" })}
          {input("email", "E-mail", { type: "email" })}
          {matches.length > 0 && (
            <div className="cw match">
              Contato já cadastrado.{" "}
              {matches.map((x) => (
                <button
                  type="button"
                  key={x.id}
                  onClick={() => change("contact", x.id)}
                >
                  Usar {x.name}
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </>
  );
  const companies = (
    <>
      {input("company", "Empresa", {
        wide: true,
        list: "crm-companies",
        required: action === "won",
      })}
      <datalist id="crm-companies">
        {state.companies.map((x) => (
          <option key={x.id} value={x.name} />
        ))}
      </datalist>
    </>
  );
  const financial = (
    <>
      {input("monthly", "Mensalidade (R$)")}
      {input("once", "Valor pontual (R$)")}
    </>
  );
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || conflict) return;
    const keys = {
      create: [
        "company",
        "contact",
        "name",
        "phone",
        "email",
        "source",
        "next",
        "due",
      ],
      edit: [
        "company",
        "contact",
        "name",
        "phone",
        "email",
        "source",
        "stage",
        "owner",
        "goal",
        "service",
        "monthly",
        "once",
        "next",
        "due",
      ],
      contact: ["contact", "name", "phone", "email"],
      return: ["kind", "note", "next", "due"],
      won: [
        "company",
        "contact",
        "name",
        "phone",
        "email",
        "goal",
        "scope",
        "terms",
        "monthly",
        "once",
        "lead",
        "first",
        "date",
      ],
      lost: ["reason"],
    }[action];
    const values: Record<string, string | number | null> = {};
    for (const k of keys) {
      let v = f[k].trim();
      if (k === "once" || k === "monthly") {
        if (v && !/^(\d{1,3}(\.\d{3})+|\d+)(,\d{1,2})?$/.test(v)) {
          setError("Informe o valor em reais, por exemplo 1.250,00.");
          return;
        }
        values[k] = v
          ? Math.round(Number(v.replaceAll(".", "").replace(",", ".")) * 100)
          : null;
      } else values[k] = v;
    }
    if (
      action === "create" &&
      !f.company.trim() &&
      !f.name.trim() &&
      !f.contact
    ) {
      setError("Informe uma empresa ou um contato para começar.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/crm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...stable.current, action, values }),
      });
      const body = (await res.json()) as {
        id: string;
        error?: string;
        contactId?: string;
      };
      if (!res.ok) {
        if (res.status === 409) {
          setConflict(true);
          await refresh();
        } else if (body.contactId) {
          await refresh();
          change("contact", body.contactId);
        }
        throw Error(body.error || "Verifique os campos e tente novamente.");
      }
      await saved(body.id);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Não foi possível confirmar. Tente novamente.",
      );
      setBusy(false);
    }
  }
  return (
    <dialog
      className="crm-modal"
      ref={panel}
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) close();
      }}
      aria-labelledby="crm-form-title"
    >
      <header>
        <div className="eyebrow">CRM comercial</div>
        <button
          aria-label="Fechar formulário"
          className="icon-action"
          onClick={close}
          disabled={busy}
        >
          <X size={19} />
        </button>
        <h2 id="crm-form-title">{titles[action]}</h2>
      </header>
      <form onSubmit={submit}>
        <div className="crm-fields">
          {action === "create" && (
            <>
              <p className="field-guide cw">
                Comece pela empresa ou pelo nome da pessoa. Os demais dados
                podem ser completados depois.
              </p>
              {companies}
              {people}
              {input("source", "Origem", { list: "sources", wide: true })}
              <datalist id="sources">
                {["Indicação", "WhatsApp", "Prospecção", "Site", "Evento"].map(
                  (x) => (
                    <option key={x}>{x}</option>
                  ),
                )}
              </datalist>
              <details className="cw">
                <summary>Agendar primeiro contato</summary>
                <div className="crm-fields">
                  {input("next", "Próximo passo")}
                  {input("due", "Data do retorno", { type: "date" })}
                </div>
              </details>
            </>
          )}
          {action === "edit" && (
            <>
              {companies}
              {people}
              {input("source", "Origem")}
              {input("service", "Serviço")}
              {select(
                "stage",
                "Etapa",
                stages.map((x) => ({ id: x, name: x })),
              )}
              {select("owner", "Responsável", state.members)}
              {input("goal", "Objetivo comercial", {
                wide: true,
                multiline: true,
              })}
              {financial}
              {input("next", "Próximo passo")}
              {input("due", "Data do retorno", { type: "date" })}
            </>
          )}
          {action === "contact" && people}
          {action === "return" && (
            <>
              {select(
                "kind",
                "Tipo de interação",
                kinds.map((x) => ({ id: x, name: x })),
              )}
              {input("note", "Último combinado", {
                wide: true,
                multiline: true,
                required: true,
              })}
              {input("next", "Próximo passo")}
              {input("due", "Data do retorno", { type: "date" })}
            </>
          )}
          {action === "lost" &&
            input("reason", "Motivo da perda", {
              required: true,
              wide: true,
              multiline: true,
            })}
          {action === "won" && (
            <>
              {companies}
              {people}
              {input("scope", "Escopo vendido", {
                required: true,
                wide: true,
                multiline: true,
              })}
              {input("goal", "Objetivo contratado", {
                required: true,
                wide: true,
              })}
              {financial}
              {input("terms", "Condições comerciais", {
                required: true,
                wide: true,
              })}
              {select(
                "lead",
                "Responsável pelo atendimento",
                state.members,
                true,
              )}
              {input("date", "Data do compromisso", {
                required: true,
                type: "date",
              })}
              {input("first", "Primeiro compromisso", {
                wide: true,
                required: true,
              })}
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
              type="button"
              className="crm-secondary"
              onClick={close}
              disabled={busy}
            >
              {conflict ? "Voltar à ficha" : "Cancelar"}
            </button>
            <button className="crm-primary" disabled={busy || conflict}>
              {busy
                ? "Salvando…"
                : action === "create"
                  ? "Criar oportunidade"
                  : action === "won"
                    ? "Confirmar venda ganha"
                    : "Salvar"}
              <ArrowRight size={15} />
            </button>
          </div>
        </footer>
      </form>
    </dialog>
  );
}
