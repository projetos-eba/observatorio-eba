import assert from "node:assert/strict";
export async function checkHub(base) {
  const today = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const before = new Date(today + "T12:00:00Z");
  before.setUTCDate(before.getUTCDate() - 1);
  const yesterday = before.toISOString().slice(0, 10);
  const headers = (name) => ({
    "oai-authenticated-user-id": name,
    "oai-authenticated-user-email": name + "@example.test",
  });
  const external = Date.now().toString(36),
    companyName = "Revenda de teste " + external,
    company = companyName.toLowerCase(),
    brand = "conta:" + company;
  async function post(path, body, name = "ana", expected = 200) {
    const r = await fetch(base + path, {
      method: "POST",
      headers: {
        ...headers(name),
        origin: base,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    });
    assert.equal(r.status, expected, await r.clone().text());
    return r.json();
  }
  async function get(path, name = "ana") {
    const r = await fetch(base + path, { headers: headers(name) });
    assert.equal(r.status, 200, await r.clone().text());
    return r.json();
  }
  const read = (id = brand) =>
    get("/api/conteudo?" + new URLSearchParams({ marca: id }));
  async function cmd(
    change,
    {
      id = crypto.randomUUID(),
      version,
      name = "ana",
      status = 200,
      market = brand,
    } = {},
  ) {
    return post(
      "/api/conteudo",
      {
        brand: market,
        id,
        version: version ?? (await read(market)).version,
        change,
      },
      name,
      status,
    );
  }
  assert.equal((await fetch(base + "/api/conteudo")).status, 401);
  await get("/api/crm", "beto");
  const crm = (action, deal, revision, values, expected = 200) =>
    post(
      "/api/crm",
      { action, deal, revision, values, requestId: crypto.randomUUID() },
      "ana",
      expected,
    );
  const deal = crypto.randomUUID();
  await crm(
    "create",
    deal,
    0,
    { company: companyName, name: "Pessoa piloto" },
    201,
  );
  await crm("won", deal, 1, {
    goal: "Visitas",
    scope: "Campanhas e conteúdo",
    terms: "Plano mensal",
    monthly: 320000,
    lead: "beto",
    first: "Onboarding",
    date: today,
  });
  const pace = async (change) =>
    post("/api/carteira", {
      id: crypto.randomUUID(),
      version: (await get("/api/carteira")).version,
      change,
    });
  await pace({
    kind: "profile",
    company,
    owner: "beto",
    niche: "revendas",
    metric: 2,
    target: 60,
    stage: "Converter",
    diagnosis: {
      Posicionar: "",
      Impulsionar: "",
      Converter: "Reforçar o comparecimento",
      Otimizar: "",
    },
  });
  await pace({
    kind: "decision",
    company,
    stage: "Converter",
    action: "Testar",
    reason: "Melhorar comparecimento",
    evidence: "6 visitas de 16 agendamentos",
    step: "Criar peça de confirmação",
    owner: "beto",
    due: today,
    radarId: "",
  });
  const decision = (await get("/api/carteira")).decisions.find(
    (d) => d.company === company,
  ).id;
  assert.equal((await read()).brand.active, false);
  await cmd({ kind: "activate" });
  const guidance = {
    title: "CTA de test-drive",
    kind: "CTA",
    text: "Convide a agendar uma visita.",
    source: "Manual de marca",
    owner: "ana",
    review: today,
    goal: "Agendamento",
    channel: "",
    stage: "Converter",
  };
  const guide = (await cmd({ kind: "guide", guide: { id: "", ...guidance } }))
    .id;
  await cmd(
    {
      kind: "guideApprove",
      guide: { id: guide, version: (await read()).directives[0].version },
      proof: "Ata de aprovação editorial",
    },
    { name: "beto" },
  );

  const token = crypto.randomUUID();
  const upload = async (body, key = token) =>
    fetch(
      base +
        "/api/conteudo/arquivo?" +
        new URLSearchParams({ marca: brand, envio: key, nome: "foto.png" }),
      { method: "PUT", headers: { ...headers("ana"), origin: base }, body },
    );
  assert.equal((await upload(Buffer.from("html"))).status, 415);
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAACklEQVR4nGNgAAAAAgABSK+kcQAAAABJRU5ErkJggg==",
    "base64",
  );
  const sent = await upload(png);
  assert.equal(sent.status, 200, await sent.clone().text());
  const file = await sent.json();
  assert.deepEqual(await (await upload(png)).json(), file);
  const assetFields = {
    title: "Imagem autorizada",
    kind: "Fotografia",
    owner: "ana",
    rights: "Uso interno e mídia social",
    channels: ["Instagram", "LinkedIn"],
    expires: today,
    url: "",
    file,
  };
  const asset = (
    await cmd({ kind: "asset", asset: { id: "", ...assetFields } })
  ).id;
  let assetVersion = (await read()).assets[0].version;
  await cmd(
    {
      kind: "assetApprove",
      asset: { id: asset, version: assetVersion },
      proof: "Direitos comprovados",
    },
    { name: "beto" },
  );
  assetVersion = (await read()).assets[0].version;
  const getFile =
    base +
    "/api/conteudo/arquivo?" +
    new URLSearchParams({
      marca: brand,
      ativo: asset,
      versao: String(assetVersion),
    });
  assert.equal((await fetch(getFile)).status, 401);
  const image = await fetch(getFile, { headers: headers("beto") });
  assert.equal(image.headers.get("content-type"), "image/png");
  assert.deepEqual(Buffer.from(await image.arrayBuffer()), png);
  const expired = (
    await cmd({
      kind: "asset",
      asset: {
        ...assetFields,
        id: "",
        title: "Direitos encerrados",
        expires: yesterday,
        url: "https://example.test/foto",
        file: null,
      },
    })
  ).id;
  await cmd(
    {
      kind: "assetApprove",
      asset: { id: expired, version: (await read()).assets[0].version },
      proof: "Arquivo antigo",
    },
    { status: 400 },
  );
  const fields = {
    title: "Test-drive com lembrete",
    brief: "Demonstrar como marcar uma visita.",
    channel: "Instagram",
    format: "Vídeo",
    goal: "Agendamento",
    stage: "Converter",
    owner: "ana",
    due: today,
    decision,
    radar: "",
    assets: [{ id: asset, version: assetVersion }],
    reuse: "",
    plan: "Registrar agendamentos por código.",
  };
  const piece = (await cmd({ kind: "edition", edition: { id: "", ...fields } }))
    .id;
  const flow = (piece, action, more = {}, name = "ana") =>
    cmd(
      { kind: "workflow", piece, action, note: "", proof: "", ...more },
      { name },
    );
  await flow(piece, "Produzir");
  await flow(piece, "Enviar para revisão");
  await flow(
    piece,
    "Solicitar ajustes",
    { note: "Incluir a condição da oferta" },
    "beto",
  );
  await cmd({
    kind: "edition",
    edition: { id: piece, ...fields, brief: "Incluir prazo para test-drive." },
  });
  await flow(piece, "Enviar para revisão");
  await flow(
    piece,
    "Aprovar",
    { proof: "Aprovação registrada no e-mail" },
    "beto",
  );
  const site = (
    await cmd({
      kind: "prepare",
      piece,
      destination: "Site",
      target: "https://example.test/revenda?x=1#agenda",
      message: "",
    })
  ).id;
  const whats = (
    await cmd({
      kind: "prepare",
      piece,
      destination: "WhatsApp",
      target: "5511999999999",
      message: "Quero marcar uma visita",
    })
  ).id;
  let state = await read(),
    p = state.publications.find((p) => p.id === site),
    w = state.publications.find((p) => p.id === whats);
  assert.equal(new URL(p.link).searchParams.get("eba_ref"), p.code);
  assert.equal(new URL(p.link).searchParams.get("utm_content"), p.code);
  assert.equal(new URL(p.link).hash, "#agenda");
  assert.equal(new URL(p.link).searchParams.get("x"), "1");
  assert(new URL(w.link).searchParams.get("text").includes(w.code));
  await cmd({
    kind: "publish",
    publication: site,
    date: today,
    reference: "https://example.test/post-publicado",
  });
  await cmd({
    kind: "publish",
    publication: whats,
    date: today,
    reference: "Peça aprovada no atendimento",
  });
  const row = {
    goal: "Agendamento",
    externalId: "AG-01",
    date: today,
    source: "Agenda do cliente",
    value: null,
    code: p.code,
  };
  await cmd(
    { kind: "results", rows: [row, row], correct: "" },
    { status: 409 },
  );
  assert.equal((await read()).results.length, 0);
  const mutation = crypto.randomUUID(),
    v = (await read()).version;
  await cmd(
    { kind: "results", rows: [row], correct: "" },
    { id: mutation, version: v },
  );
  await cmd(
    { kind: "results", rows: [row], correct: "" },
    { id: mutation, version: v },
  );
  await cmd({ kind: "results", rows: [row], correct: "" }, { status: 409 });
  const sale = {
    goal: "Venda",
    externalId: "PV-01",
    date: today,
    source: "Venda do cliente",
    value: 210000,
    code: "",
  };
  const saleId = (await cmd({ kind: "results", rows: [sale], correct: "" })).id;
  await cmd(
    { kind: "results", rows: [{ ...sale, code: p.code }], correct: saleId },
    { name: "beto" },
  );
  await cmd({
    kind: "results",
    rows: [{ ...row, externalId: "AG-ANTES", date: yesterday }],
    correct: "",
  });
  await cmd(
    {
      kind: "results",
      rows: [{ ...row, externalId: "FORA-MARCA" }],
      correct: "",
    },
    { market: "eba" },
  );
  assert.equal((await read("eba")).publications.length, 0);
  await flow(
    piece,
    "Avaliar",
    { note: "Há um agendamento confirmado." },
    "beto",
  );
  const derived = (
    await cmd({
      kind: "edition",
      edition: {
        ...fields,
        decision: "",
        id: "",
        title: "Carrossel do test-drive",
        format: "Carrossel",
        reuse: site,
      },
    })
  ).id;
  assert.equal(
    (await read()).editions.find((e) => e.id === derived).parent,
    piece,
  );
  assert.equal(
    (await read()).editions.find((e) => e.id === derived).guides[0].id,
    guide,
  );
  await flow(derived, "Produzir");
  await flow(derived, "Enviar para revisão");
  await flow(derived, "Aprovar", { proof: "Comprovante da derivação" }, "beto");
  const other = (
    await cmd({
      kind: "prepare",
      piece: derived,
      destination: "Site",
      target: "https://example.test/nova-peca",
      message: "",
    })
  ).id;
  state = await read();
  const child = state.publications.find((p) => p.id === other);
  assert.notEqual(child.code, p.code);
  await cmd({
    kind: "publish",
    publication: other,
    date: today,
    reference: "https://example.test/carrossel",
  });
  await cmd({
    kind: "results",
    rows: [{ ...row, externalId: "AG-02", code: child.code }],
    correct: "",
  });
  await cmd(
    {
      kind: "asset",
      asset: {
        ...assetFields,
        id: asset,
        title: "Nova foto autorizada",
        url: "https://example.test/nova-foto",
        file: null,
      },
    },
    { name: "beto" },
  );
  await cmd(
    {
      kind: "assetApprove",
      asset: { id: asset, version: (await read()).assets[0].version },
      proof: "Nova autorização",
    },
    { name: "beto" },
  );
  await cmd(
    {
      kind: "prepare",
      piece: derived,
      destination: "Site",
      target: "https://example.test/agendamento",
      message: "",
    },
    { status: 400 },
  );
  state = await read();
  assert.equal(state.results.filter((r) => r.id === saleId).length, 2);
  assert.equal(
    state.publications.find((p) => p.id === site).edition,
    p.edition,
  );
  assert.equal(
    state.editions.find((e) => e.id === piece && e.version === p.edition)
      .assets[0].version,
    assetVersion,
  );
  const competing = (await read()).version;
  const collision = await Promise.allSettled(
    ["ana", "beto"].map((name) =>
      cmd(
        {
          kind: "guide",
          guide: { id: "", ...guidance, title: "Diretriz " + name },
        },
        { name, version: competing },
      ),
    ),
  );
  assert.equal(collision.filter((r) => r.status === "fulfilled").length, 1);
  const batch = [
    { ...row, externalId: "CSV-01" },
    { ...row, externalId: "CSV-02", code: "" },
  ];
  await cmd({ kind: "results", rows: batch, correct: "" });
  assert.equal(
    (await read()).results.filter((r) => r.externalId.startsWith("CSV-"))
      .length,
    2,
  );
  console.log(
    "Hub validado: versões, direitos de uso, upload, atribuição, correções e reaproveitamento entre publicações.",
  );
}
