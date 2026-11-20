import { useState } from "react";
import { PhoneField } from "./phone-field";
import { type Person } from "./model";
export function Contact({
  person,
  primary,
  refresh,
}: {
  person: Person;
  primary: boolean;
  refresh: () => Promise<void>;
}) {
  const [before, setBefore] = useState<Person | null>(null),
    [busy, setBusy] = useState(false),
    [err, setErr] = useState("");
  if (!before)
    return (
      <div className="person-detail">
        <div>
          <b>{person.name}</b>
          {primary ? " · Principal" : ""}
          <p>
            {[person.phone, person.email].filter(Boolean).join(" · ") ||
              "Canal a definir"}
          </p>
        </div>
        <button
          onClick={() => {
            setBefore({ ...person });
            setErr("");
          }}
        >
          Editar contato
        </button>
      </div>
    );
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy || !before) return;
    setBusy(true);
    setErr("");
    const form = new FormData(e.currentTarget);
    const values = Object.fromEntries(form.entries());
    const { name, email, phone } = before;
    try {
      const r = await fetch("/api/crm", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: person.id,
          previous: { name, email, phone },
          values,
        }),
      });
      if (!r.ok) {
        const body = (await r.json()) as { error: string };
        if (r.status === 409) await refresh();
        throw Error(body.error);
      }
      await refresh();
      setBefore(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Falha ao salvar.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="person-form">
      <label>
        Nome do contato
        <input name="name" required defaultValue={before.name} />
      </label>
      <PhoneField initial={before.phone} />
      <label>
        E-mail
        <input name="email" type="email" defaultValue={before.email} />
      </label>
      {err && (
        <p role="alert" className="crm-error">
          {err}
        </p>
      )}
      <div>
        <button
          type="button"
          className="crm-secondary"
          disabled={busy}
          onClick={() => setBefore(null)}
        >
          Cancelar
        </button>
        <button className="crm-primary" disabled={busy}>
          Salvar contato
        </button>
      </div>
    </form>
  );
}
