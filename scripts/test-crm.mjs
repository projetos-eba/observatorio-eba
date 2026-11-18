// Run against an isolated local Worker. Only the disposable test database receives writes.
import assert from "node:assert/strict";
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
  const writes = await Promise.all(
    ["Reunião", "Ligação"].map((kind) =>
      write("atendimento", "return", first, 2, {
        kind,
        note: "Confirmar proposta",
      }),
    ),
  );
  assert.deepEqual(writes.map((x) => x.status).sort(), [200, 409]);
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
      (await write("atendimento", "won", first, 3, handoff, receipt)).status,
      200,
    );
  const current = await read("comercial"),
    contact = current.deals[0].contact;
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
  assert.equal(
    final.activities.filter((x) => x.deal === first && x.kind === "Venda ganha")
      .length,
    1,
  );
  assert.equal(final.deals[0].monthly, 250000);
  console.log(
    "CRM validado: autoria, transferência, conflito simultâneo, repetição de ganho e reutilização de conta.",
  );
} finally {
  if (worker && worker.exitCode === null && worker.signalCode === null) {
    const stopped = once(worker, "exit");
    worker.kill("SIGTERM");
    await stopped;
  }
  rmSync(scratch, { recursive: true, force: true });
}
