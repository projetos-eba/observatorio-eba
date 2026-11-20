// Run against an isolated local Worker. Only the disposable test database receives writes.
import assert from "node:assert/strict";
import { checkHub } from "./check-hub.mjs";
import { execFileSync, spawn } from "node:child_process";
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { once } from "node:events";
import { setTimeout as delay } from "node:timers/promises";

const scratch = mkdtempSync(join(tmpdir(), "eba-crm-test-"));
const wrangler = [
  "--import",
  "./scripts/sites-env.mjs",
  "./node_modules/wrangler/bin/wrangler.js",
];
const local = [
  "--local",
  "--config",
  "dist/server/wrangler.json",
  "--persist-to",
  scratch,
];
const host = "127.0.0.1";
const socket = createServer();
socket.listen(0, host);
await once(socket, "listening");
const port = socket.address().port;
await new Promise((resolve) => socket.close(resolve));
const base = "http://" + host + ":" + port;
const identity = (name) => ({
  "oai-authenticated-user-id": name,
  "oai-authenticated-user-email": name + "@example.test",
});
let worker;
try {
  for (const file of readdirSync("drizzle")
    .filter((f) => f.endsWith(".sql"))
    .sort()) {
    execFileSync(
      process.execPath,
      [
        ...wrangler,
        "d1",
        "execute",
        "DB",
        ...local,
        "--file",
        join("drizzle", file),
      ],
      { stdio: "pipe" },
    );
  }
  execFileSync(process.execPath, [...wrangler, "d1", "execute", "DB", ...local, "--command",
    "INSERT INTO crm_members(id,name) VALUES ('comercial','comercial'),('ana','ana'),('atendimento','atendimento'); " +
    "INSERT INTO workspace_permissions(member,scope,target,grantedBy,grantedAt) VALUES " +
    "('comercial','admin','','comercial',CURRENT_TIMESTAMP),('ana','admin','','comercial',CURRENT_TIMESTAMP)," +
    "('atendimento','brand','eba','comercial',CURRENT_TIMESTAMP);"], { stdio: "pipe" });
  worker = spawn(
    process.execPath,
    [
      ...wrangler,
      "dev",
      ...local,
      "--ip",
      host,
      "--port",
      String(port),
      "--inspector-port",
      "0",
    ],
    { stdio: "ignore" },
  );
  let ready = false;
  for (let i = 0; i < 100; i++) {
    if ((await fetch(base + "/api/crm").catch(() => null))?.status === 401) {
      ready = true;
      break;
    }
    if (worker.exitCode !== null) break;
    await delay(200);
  }
  assert(ready, "O Worker local não iniciou com o build atual.");
  const read = async (name) => {
    const r = await fetch(base + "/api/crm", { headers: identity(name) });
    assert.equal(r.status, 200);
    return r.json();
  };
  const write = (
    name,
    action,
    deal,
    revision,
    values,
    requestId = crypto.randomUUID(),
  ) =>
    fetch(base + "/api/crm", {
      method: "POST",
      headers: {
        ...identity(name),
        origin: base,
        "content-type": "application/json",
      },
      body: JSON.stringify({ action, deal, revision, values, requestId }),
    });
  await read("atendimento");
  const first = crypto.randomUUID(),
    second = crypto.randomUUID();
  assert.equal(
    (
      await write("comercial", "create", first, 0, {
        company: "Empresa piloto",
        name: "Contato piloto",
        email: "piloto@example.test",
        phone: "(34) 90000-0000",
        source: "Ex-cliente",
      })
    ).status,
    201,
  );
  assert.equal(
    (
      await write("comercial", "edit", first, 1, {
        owner: "atendimento",
        stage: "Proposta",
      })
    ).status,
    200,
  );
  const openProposal = (await read("atendimento")).deals.find((d) => d.id === first && d.stage === "Proposta");
  assert(openProposal?.stageSince, "A etapa Proposta precisa ter uma entrada registrada.");
  const writes = await Promise.all(
    ["Reunião", "Ligação"].map((kind) =>
      write("atendimento", "return", first, 2, {
        kind,
        note: "Confirmar proposta",
      }),
    ),
  );
  assert.deepEqual(writes.map((x) => x.status).sort(), [200, 409]);
  const due = new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo", dateStyle: "short" }).format(new Date());
  const scheduledReceipt = crypto.randomUUID();
  assert.equal((await write("vizitante", "schedule", first, 3, { next: "Retomar proposta", due })).status, 404);
  assert.equal((await write("atendimento", "schedule", first, 3, { next: "Retomar proposta" })).status, 400);
  for (let i = 0; i < 2; i++)
    assert.equal((await write("atendimento", "schedule", first, 3, { next: "Retomar proposta", due }, scheduledReceipt)).status, 200);
  const afterSchedule = (await read("atendimento")).deals.find((d) => d.id === first);
  assert.equal(afterSchedule.stageSince, openProposal.stageSince);
  assert.equal(afterSchedule.next, "Retomar proposta");
  assert.equal(afterSchedule.due, due);
  const handoff = {
    scope: "Gestão de mídia",
    goal: "Visitas à loja",
    monthly: 250000,
    once: 95000,
    terms: "Mensal",
    lead: "atendimento",
    first: "Reunião inicial",
    date: "2027-01-15",
  };
  const receipt = crypto.randomUUID();
  for (let i = 0; i < 2; i++)
    assert.equal(
      (await write("atendimento", "won", first, 4, { ...handoff, company: "Empresa duplicada", proposalUrl: "https://example.test/proposta" }, receipt)).status,
      200,
    );
  assert.equal((await write("atendimento", "won", first, 4, { ...handoff, goal: "Outro objetivo" }, receipt)).status, 409);
  assert.equal((await read("vizitante")).deals.length, 0);
  assert.equal((await fetch(base + "/api/crm?historico=" + first, { headers: identity("vizitante") })).status, 404);
  assert.equal((await write("vizitante", "create", crypto.randomUUID(), 0, { company: "Empresa piloto" })).status, 404);
  const current = await read("comercial"),
    contact = current.deals[0].contact;
  const original = current.contacts.find((item) => item.id === contact);
  assert.equal(original.phone, "+5534900000000");
  const patch = (phone) => fetch(base + "/api/crm", {
    method: "PATCH",
    headers: { ...identity("comercial"), Origin: base, "Content-Type": "application/json" },
    body: JSON.stringify({
      id: contact, previous: { name: original.name, email: original.email, phone: original.phone },
      values: { name: original.name, email: original.email, phone },
    }),
  });
  assert.equal((await patch("+44 12")).status, 400);
  assert.equal((await patch("0044 20 7946 0958")).status, 200);
  assert.equal((await read("comercial")).contacts.find((item) => item.id === contact).phone, "+442079460958");
  const duplicate = await write("comercial", "create", crypto.randomUUID(), 0, {
    name: "Contato repetido", phone: "+44 20 7946 0958",
  });
  assert.equal(duplicate.status, 422);
  assert.equal((await duplicate.json()).contactId, contact);
  assert.equal(
    (
      await write("comercial", "create", second, 0, {
        company: "Empresa piloto",
        contact,
      })
    ).status,
    201,
  );
  assert.equal(
    (await write("comercial", "won", second, 1, handoff)).status,
    200,
  );
  const final = await read("atendimento");
  assert.equal(final.accounts.length, 1);
  assert.equal(final.handoffs.length, 2);
  assert(!final.companies.some((c) => c.name === "Empresa duplicada"));
  assert.equal(final.deals.find((d) => d.id === first).proposalUrl, "https://example.test/proposta");
  const proof = await fetch(base + "/api/crm?" + new URLSearchParams({ historico: first, evento: scheduledReceipt }),
    { headers: identity("atendimento") });
  assert.deepEqual((await proof.json()).entries.map((x) => [x.id, x.scheduledFor]), [[scheduledReceipt, due]]);
  assert.equal(
    final.activities.filter((x) => x.deal === first && x.kind === "Venda ganha")
      .length,
    1,
  );
  assert.equal(final.deals[0].monthly, 250000);
  const overview = async (person, week = "") => {
    const response = await fetch(base + "/api/visao-geral" + week, { headers: identity(person) });
    assert.equal(response.status, 200, await response.clone().text());
    return response.json();
  };
  const pulse = await overview("comercial");
  assert.equal(pulse.clients, 1);
  assert.equal(pulse.monthly, 500000);
  assert.equal(pulse.returns, 1);
  const report = async (person, category = "", week = pulse.week) => {
    const response = await fetch(base + "/api/crm?" + new URLSearchParams({ reativacao: week, categoria: category }),
      { headers: identity(person) });
    assert.equal(response.status, 200, await response.clone().text());
    return response.json();
  };
  const categories = ["retornos", "conversas", "propostas", "contratos"];
  const activity = await report("atendimento");
  assert.deepEqual(Object.values(activity.totals), [1, 1, 1, 1]);
  for (const category of categories) {
    const detail = await report("atendimento", category);
    assert.equal(detail.entries.length, detail.totals[category]);
    assert.equal(detail.entries[0].deal, first);
  }
  assert.deepEqual(Object.values((await report("vizitante")).totals), [0, 0, 0, 0]);
  assert.deepEqual(Object.values((await report("atendimento", "", "2025-01-06")).totals), [0, 0, 0, 0]);
  const scheduled = crypto.randomUUID();
  assert.equal((await write("comercial", "create", scheduled, 0, {
    company: "Empresa piloto", contact, next: "Confirmar reunião", due: pulse.today, source: "Ex-cliente",
  })).status, 201);
  const withAgenda = await overview("comercial");
  assert(withAgenda.commitments.some((item) => item.id === scheduled && item.href.includes("acao=retorno")));
  assert(withAgenda.priorities.some((item) => item.id === scheduled));
  const scoped = await overview("vizitante");
  assert.deepEqual([scoped.clients, scoped.monthly, scoped.returns, scoped.commitments.length], [0, 0, 0, 0]);
  const past = await overview("comercial", "?semana=2025-01-06");
  assert.equal(past.clients, pulse.clients);
  assert.equal(past.monthly, pulse.monthly);
  assert.equal(past.returns, 0);
  assert(!past.commitments.some((item) => item.id === scheduled));
  await checkPortfolio(base, read, write);
  await checkHub(base);

  console.log(
    "CRM e Visão geral validados: Proposta, retorno, reativação com evidência, ganho e agenda semanal por escopo.",
  );
} finally {
  if (worker && worker.exitCode === null && worker.signalCode === null) {
    const stopped = once(worker, "exit");
    worker.kill("SIGTERM");
    await stopped;
  }
  rmSync(scratch, { recursive: true, force: true });
}

async function checkPortfolio(base, read, write) {
  const accounts = {
    "empresa piloto": "revendas",
    "clinica piloto": "saude",
    "escritorio piloto": "advocacia",
  };
  const date = new Date(
    new Intl.DateTimeFormat("sv-SE", {
      timeZone: "America/Sao_Paulo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format() + "T12:00:00Z",
  );
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  const week = date.toISOString().slice(0, 10);
  date.setUTCDate(date.getUTCDate() - 7);
  const prior = date.toISOString().slice(0, 10);
  assert.equal((await fetch(base + "/api/carteira")).status, 401);
  for (const company of ["Clínica piloto", "Escritório piloto"]) {
    const deal = crypto.randomUUID();
    const { deals } = await read("comercial");
    assert.equal(
      (
        await write("comercial", "create", deal, 0, {
          company,
          contact: deals[0].contact,
        })
      ).status,
      201,
    );
    assert.equal(
      (
        await write("comercial", "won", deal, 1, {
          goal: "Aumentar conversão",
          scope: "Mídia",
          terms: "Mensal",
          once: 12000,
          lead: "atendimento",
          first: "Onboarding",
          date: week,
        })
      ).status,
      200,
    );
  }
  const state = async () => {
    const r = await fetch(base + "/api/carteira", {
      headers: identity("atendimento"),
    });
    assert.equal(r.status, 200, await r.clone().text());
    return r.json();
  };
  const send = (
    version,
    change,
    user = "comercial",
    id = crypto.randomUUID(),
  ) =>
    fetch(base + "/api/carteira", {
      method: "POST",
      headers: {
        ...identity(user),
        origin: base,
        "content-type": "application/json",
      },
      body: JSON.stringify({ id, version, change }),
    });
  const apply = async (change, user) => {
    const r = await send((await state()).version, change, user);
    assert.equal(r.status, 200, await r.clone().text());
  };
  for (const [company, niche] of Object.entries(accounts)) {
    await apply({
      kind: "profile",
      company,
      owner: "atendimento",
      niche,
      metric: 2,
      target: 65,
      stage: "Converter",
      diagnosis: {
        Posicionar: "",
        Impulsionar: "",
        Converter: "Rever atendimento",
        Otimizar: "",
      },
    });
  }
  const data = await state();
  assert.equal(
    data.accounts.find((a) => a.company === "empresa piloto").contracts.length,
    2,
  );
  const row = {
    company: "empresa piloto",
    week: prior,
    counts: [70, 40, 16, 6],
    source: "CRM",
  };
  assert.equal(
    (
      await send(data.version, {
        kind: "measure",
        rows: [row, { ...row, company: "conta-inexistente" }],
      })
    ).status,
    400,
  );
  assert.equal(
    (await send(data.version, { kind: "measure", rows: [row, row] })).status,
    400,
  );
  assert.equal((await state()).measurements.length, 0);
  const race = await Promise.all(
    ["comercial", "atendimento"].map((user) =>
      send(
        data.version,
        {
          kind: "measure",
          rows: [
            row,
            { ...row, company: "clinica piloto", counts: [80, 12, 0, 0] },
          ],
        },
        user,
      ),
    ),
  );
  assert.deepEqual(race.map((r) => r.status).sort(), [200, 409]);
  assert.equal((await state()).measurements.length, 2);
  const measurement = (await state()).measurements.find((m) => m.company === row.company);
  const decisionFields = {
    kind: "decision",
    company: row.company,
    stage: "Converter",
    action: "Testar",
    evidence: "6 visitas de 16 agendamentos",
    reason: "Validar confirmação",
    step: "Testar lembrete",
    owner: "atendimento",
    due: week,
    radarId: "",
    measurement: { week: measurement.week, version: measurement.version },
  };
  assert.equal((await send((await state()).version, {
    ...decisionFields, company: "escritorio piloto",
  })).status, 400);
  await apply(decisionFields);
  const decision = (await state()).decisions[0];
  const agenda = await fetch(base + "/api/visao-geral?semana=" + week, { headers: identity("atendimento") });
  assert((await agenda.json()).commitments.some((item) => item.href.endsWith("#decisao-" + decision.id)));
  const close = {
    kind: "close",
    week,
    participants: ["comercial", "atendimento"],
    items: Object.keys(accounts).map((company) => ({
      company,
      disposition: company === row.company ? "Discutido" : "Adiado",
    })),
  };
  const closingState = await state(),
    key = crypto.randomUUID();
  const closed = await send(closingState.version, close, "comercial", key);
  assert.equal(closed.status, 200, await closed.clone().text());
  assert.equal(
    (await send(closingState.version, close, "comercial", key)).status,
    200,
  );
  const before = (await state()).minutes[0];
  await apply({ kind: "measure", rows: [{ ...row, counts: [70, 40, 16, 9] }] });
  await apply(
    {
      kind: "review",
      id: (await state()).decisions[0].id,
      outcome: "Encerrar",
      note: "A confirmação subiu de seis para nove visitas.",
      step: "",
      owner: "",
      due: "",
    },
    "atendimento",
  );
  const after = await state();
  assert.deepEqual(before, after.minutes[0]);
  assert.deepEqual(
    after.measurements.filter((m) => m.company === row.company).map((m) => m.counts[3]),
    [9],
  );
  const revisions = await fetch(base + "/api/carteira?" + new URLSearchParams({
    historico: "medicao", filtro: row.company,
  }), { headers: identity("atendimento") });
  assert.deepEqual((await revisions.json()).entries.map((m) => m.counts[3]), [6]);
  assert.equal(after.decisions[0].status, "Encerrada");
  assert.equal(after.decisions[0].author, "atendimento");
  assert.deepEqual(after.decisions[0].measurement, decisionFields.measurement);
  const getOrigin = (params, user = "atendimento") => fetch(base + "/api/carteira?" + new URLSearchParams(params),
    { headers: identity(user) });
  const account = after.accounts.find((a) => a.company === row.company);
  assert(account.contracts.some((item) => item.proposalUrl === "https://example.test/proposta"));
  const history = await getOrigin({ linha: row.company });
  assert.equal(history.status, 200, await history.clone().text());
  const { entries } = await history.json();
  assert(entries.some((entry) => entry.kind === "decisao" && entry.title === "Decisão PICO revisada"));
  assert(entries.some((entry) => entry.kind === "crm" && entry.title.includes("passagem para atendimento")));
  const originalMeasurement = { registro: "medicao", conta: row.company, chave: prior, versao: measurement.version };
  assert.equal((await getOrigin(originalMeasurement, "vizitante")).status, 404);
  assert.equal((await getOrigin({ linha: row.company }, "vizitante")).status, 404);
  assert.deepEqual((await (await getOrigin(originalMeasurement)).json()).counts, row.counts);
  const originalDecision = await getOrigin({ registro: "decisao", conta: row.company, chave: decision.id, versao: decision.version });
  assert.equal((await originalDecision.json()).status, "Aberta");
  console.log(
    "Carteira validada: proposta aceita, medição versionada, decisão, agenda, revisão e fontes do histórico.",
  );
}
