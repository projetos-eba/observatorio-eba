import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import { readdir, readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { Miniflare, Response } from "miniflare";

const origin = "https://hub.ebaagencia.com";
const issuer = "https://eba-test.cloudflareaccess.com";
const audience = "eba-pages-test";
const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const jwk = { ...publicKey.export({ format: "jwk" }), alg: "RS256", kid: "test" };
const now = Math.floor(Date.now() / 1000);
const validClaims = { iss: issuer, aud: [audience], exp: now + 300, sub: "editor", email: "editor@example.com" };
const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
function signToken(claims = validClaims) {
  const payload = `${encode({ alg: "RS256", kid: jwk.kid })}.${encode(claims)}`;
  return `${payload}.${sign("RSA-SHA256", Buffer.from(payload), privateKey).toString("base64url")}`;
}

const dist = resolve(process.argv[2] ?? "dist/pages");
const worker = resolve(dist, "_worker.js");
const advancedDirectory = (await stat(worker)).isDirectory();
const moduleRoot = advancedDirectory ? worker : dist;
const modules = advancedDirectory
  ? ["index.js", ...(await readdir(moduleRoot, { recursive: true })).filter((path) => /\.(?:mjs|js)$/.test(path) && path !== "index.js")]
  : ["_worker.js"];
const runtime = new Miniflare({
  modulesRoot: moduleRoot,
  modules: modules.map((path) => ({ type: "ESModule", path: resolve(moduleRoot, path) })),
  compatibilityDate: "2026-05-15",
  compatibilityFlags: ["nodejs_compat"],
  bindings: { EBA_ACCESS_ISSUER: issuer, EBA_ACCESS_AUDIENCE: audience },
  d1Databases: ["DB"],
  r2Buckets: ["BUCKET"],
  outboundService(request) {
    assert.equal(request.url, `${issuer}/cdn-cgi/access/certs`);
    return Response.json({ keys: [jwk] });
  },
  serviceBindings: {
    async ASSETS(request) {
      const path = new URL(request.url).pathname;
      assert.equal(path, "/eba-theme.css");
      return new Response(await readFile(resolve(dist, path.slice(1)), "utf8"));
    },
  },
});

try {
  const db = await runtime.getD1Database("DB");
  const migrations = (await readdir("drizzle")).filter((name) => name.endsWith(".sql")).sort();
  for (const migration of migrations) {
    const sql = await readFile(resolve("drizzle", migration), "utf8");
    const statements = sql.split("--> statement-breakpoint").map((query) => query.trim()).filter(Boolean);
    await db.batch(statements.map((query) => db.prepare(query)));
  }
  await db.batch([
    db.prepare("INSERT INTO crm_members(id,name) VALUES ('cf-access:editor','editor@example.com')"),
    db.prepare("INSERT INTO workspace_permissions(member,scope,target,grantedBy,grantedAt) VALUES ('cf-access:editor','admin','','cf-access:editor',CURRENT_TIMESTAMP)"),
  ]);
  const call = (path, init) => runtime.dispatchFetch(`${origin}${path}`, init);
  const spoofed = { "oai-authenticated-user-id": "forjado", "oai-authenticated-user-email": "forjado@example.com" };
  const token = signToken();
  const [header, payload, signature] = token.split(".");
  const forged = `${header}.${payload}.${signature[0] === "A" ? "B" : "A"}${signature.slice(1)}`;

  assert.equal((await call("/api/store", { headers: spoofed })).status, 403);
  for (const invalid of [forged, signToken({ ...validClaims, exp: now - 1 }), signToken({ ...validClaims, aud: ["wrong"] })]) {
    assert.equal((await call("/api/crm", { headers: { "Cf-Access-Jwt-Assertion": invalid } })).status, 403);
  }

  const alias = await runtime.dispatchFetch("https://observatorio-eba.pages.dev/conteudo", { redirect: "manual" });
  assert.equal(alias.status, 302);
  assert.equal(alias.headers.get("location"), `${origin}/conteudo`);
  assert.equal((await runtime.dispatchFetch("https://observatorio-eba.pages.dev/api/store", { method: "PUT" })).status, 403);
  const headers = { ...spoofed, "Cf-Access-Jwt-Assertion": token };
  assert.equal((await call("/eba-theme.css", { headers })).status, 200);
  for (const path of ["/", "/crm", "/carteira", "/conteudo", "/integracoes", "/api/store", "/api/crm", "/api/carteira", "/api/conteudo", "/api/integracoes"]) {
    const response = await call(path, { headers });
    assert.equal(response.status, 200, path);
    assert.equal(response.headers.get("cache-control"), "private, no-store", path);
    await response.text();
  }
  assert.deepEqual(await db.prepare("SELECT id, name FROM crm_members WHERE id='cf-access:editor'").first(), {
    id: "cf-access:editor", name: "editor@example.com",
  });
  const store = (collection, id, data) => call("/api/store", {
    method: "PUT", headers: { ...headers, Origin: origin, "Content-Type": "application/json" },
    body: JSON.stringify({ collection, id, data, revision: 0 }),
  });
  assert.equal((await store("settings", "weekly-goal", { value: "8" })).status, 400);
  assert.equal((await store("records", "radar-invalido", { title: "Inválido" })).status, 400);
  assert.equal((await store("tests", "teste-invalido", { title: "Datas invertidas", status: "Concluído", startDate: "2026-11-10", endDate: "2026-11-09" })).status, 400);
  assert.equal((await store("insights", "insight-invalido", { title: "Insight", date: "2026-11-10", text: "Conteúdo", destination: "Outra coisa" })).status, 400);
  const saved = await store("records", "caso-radar", {
    title: "MENSURAÇÃO ÚNICA EBA", date: "2026-11-19", sourceDate: "2026-11-18",
    stage: "Converter", impact: "Alto", priority: "Alta", status: "Analisado", niches: ["Advocacia"],
  });
  assert.equal(saved.status, 201, await saved.clone().text());
  assert.equal((await saved.json()).data.history[0].author, "cf-access:editor");
  await db.batch(Array.from({ length: 21 }, (_, i) => db.prepare(
    "INSERT INTO store_entries(collection,id,data,revision) VALUES ('records',?,?,1)",
  ).bind("caso-" + i, JSON.stringify({ title: "Mensuração única EBA", date: "2026-11-19", sourceDate: "2026-11-18", status:"Analisado", impact: "Alto", niches:["Advocacia"] }))));
  const query = "/api/store?historico=1&q=mensuracao%20unica&impact=Alto&niche=Advocacia&from=2026-11-18&to=2026-11-18";
  const page = await call(query, { headers });
  assert.equal(page.status, 200, await page.clone().text());
  const found = await page.json();
  assert.equal(found.total, 22);
  assert.equal(found.entries.length, 20);
  assert(found.next);
  assert.equal((await (await call(query + "&pagina=2", { headers })).json()).entries.length, 2);
  const unscoped = { "Cf-Access-Jwt-Assertion": signToken({ ...validClaims, sub: "no-scope", email: "no-scope@example.com" }) };
  for (const path of ["/api/store", "/api/integracoes", "/api/conteudo"]) {
    assert.equal((await call(path, { headers: unscoped })).status, 403, path);
  }
  console.log("Pages: rotas, assets, migrações, permissões, validação por coleção, autoria e busca paginada verificadas.");
} finally {
  await runtime.dispose();
}
