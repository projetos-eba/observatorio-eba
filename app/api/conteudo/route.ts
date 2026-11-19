import { env } from "cloudflare:workers";
import { z } from "zod";
import { canAccessBrand, getCrmMember } from "../../crm/session";
import { validDate } from "../../carteira/csv";
import {
  activeGuides,
  assetIssue,
  assetKinds,
  channels,
  directiveKinds,
  editionFor,
  formats,
  generateLink,
  guideEligible,
  latest,
  normalizeCode,
  outcomes,
  pico,
  resultKey,
  suggestion,
  today,
  type Asset,
  type Directive,
  type Edition,
  type Piece,
  type Publication,
} from "../../conteudo/model";
import { resultIssue } from "../../conteudo/results-csv";
import {
  fail,
  fileRef,
  fingerprint,
  loadHub,
  brandsFor,
  long,
  pointer,
  reply,
  required,
  sameOrigin,
  secureUrl,
  stageKey,
  text,
  uuid,
} from "../../conteudo/server";

export const dynamic = "force-dynamic";
const url = z
  .string()
  .trim()
  .max(3000)
  .refine((v) => !v || secureUrl(v));
const date = z.string().refine(validDate);
const optionalDate = z.union([date, z.literal("")]);
const optionalId = z.union([uuid, z.literal("")]);
const proof = z.string().trim().min(1).max(3000);
const guide = z.object({
  id: optionalId,
  kind: z.enum(directiveKinds),
  title: required,
  text: long.min(1),
  source: z.string().trim().max(3000),
  owner: required,
  review: date,
  goal: z.union([z.enum(outcomes), z.literal("")]),
  stage: z.union([z.enum(pico), z.literal("")]),
  channel: z.union([z.enum(channels), z.literal("")]),
});
const asset = z.object({
  id: optionalId,
  title: required,
  kind: z.enum(assetKinds),
  owner: required,
  rights: long.min(1),
  channels: z.array(z.enum(channels)).min(1).max(channels.length),
  expires: optionalDate,
  url,
  file: fileRef.nullable(),
});
const edition = z.object({
  id: optionalId,
  title: required,
  brief: long.min(1),
  channel: z.enum(channels),
  format: z.enum(formats),
  goal: z.enum(outcomes),
  stage: z.enum(pico),
  owner: required,
  due: date,
  decision: text,
  radar: text,
  assets: z.array(pointer).max(20),
  reuse: optionalId,
  plan: long.min(1),
});
const result = z.object({
  goal: z.enum(outcomes),
  externalId: z.string().trim().min(1).max(120),
  date,
  source: required,
  code: z.string().trim().max(80),
  value: z.number().int().nonnegative().max(999999999999).nullable(),
});
const changes = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("activate") }),
  z.object({ kind: z.literal("guide"), guide }),
  z.object({ kind: z.literal("asset"), asset }),
  z.object({ kind: z.literal("assetApprove"), asset: pointer, proof }),
  z.object({ kind: z.literal("guideApprove"), guide: pointer, proof }),
  z.object({ kind: z.literal("edition"), edition }),
  z.object({
    kind: z.literal("workflow"),
    piece: uuid,
    action: z.enum([
      "Produzir",
      "Enviar para revisão",
      "Solicitar ajustes",
      "Aprovar",
      "Avaliar",
      "Comentar",
    ]),
    note: long,
    proof: z.string().trim().max(3000),
  }),
  z.object({
    kind: z.literal("prepare"),
    piece: uuid,
    destination: z.enum(["Site", "WhatsApp"]),
    target: z.string().trim().min(1).max(3000),
    message: z.string().trim().max(1000),
  }),
  z.object({
    kind: z.literal("publish"),
    publication: uuid,
    date,
    reference: proof,
  }),
  z.object({
    kind: z.literal("results"),
    rows: z.array(result).min(1).max(50),
    correct: optionalId,
  }),
]);
const payload = z.object({
  brand: z.string().trim().min(1).max(246),
  id: uuid,
  version: z.number().int().nonnegative(),
  change: changes,
});

export async function GET(request: Request) {
  try {
    const session = await getCrmMember();
    if (!session) return fail("Entre para acessar o Hub.", 401);
    const query = new URL(request.url).searchParams;
    const brand = query.get("marca") || (await brandsFor(session))[0]?.id;
    if (!brand) return fail("Nenhuma marca disponível para sua conta.", 403);
    if (query.has("historico")) {
      if (!(await canAccessBrand(session, brand))) return fail("Marca indisponível.", 404);
      const kind = z.enum(["asset", "guide", "edition", "result"]).safeParse(query.get("historico"));
      const id = uuid.safeParse(query.get("id"));
      const anchor = Number(query.get("versao") || 0);
      let page = Number(query.get("pagina") || 1);
      if (!kind.success || !id.success || !Number.isSafeInteger(anchor) || anchor < 0 ||
          !Number.isSafeInteger(page) || page < 1)
        return fail("Filtro de histórico inválido.");
      const size = 10, args = [brand, kind.data, id.data];
      const where = " FROM hub_entries WHERE brand=? AND kind=? AND id=?";
      if (anchor) {
        const count = await session.db.prepare("SELECT COUNT(*) total" + where + " AND version>?")
          .bind(...args, anchor).first<{ total: number }>();
        page = 1 + Math.floor((count?.total || 0) / size);
      }
      const { results } = await session.db.prepare("SELECT id,version,data" + where + " ORDER BY version DESC LIMIT ? OFFSET ?")
        .bind(...args, size + 1, (page - 1) * size)
        .all<{ id: string; version: number; data: string }>();
      return reply({
        entries: results.slice(0, size).map((row) => ({ ...JSON.parse(row.data), id: row.id, version: row.version })),
        next: results.length > size,
        page,
      });
    }
    const state = await loadHub(session, brand);
    return state ? reply(state) : fail("Marca indisponível.", 404);
  } catch {
    return fail("Não foi possível carregar o Hub.", 503);
  }
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return fail("Origem inválida.", 403);
  if (
    request.headers.get("content-type")?.split(";")[0].trim() !==
    "application/json"
  )
    return fail("Formato inválido.", 415);
  if (Number(request.headers.get("content-length")) > 100_000)
    return fail("Pedido muito longo.", 413);
  let input: unknown;
  try {
    const raw = await request.text();
    if (raw.length > 100_000) return fail("Pedido muito longo.", 413);
    input = JSON.parse(raw);
  } catch {
    return fail("Pedido inválido.");
  }
  const parsed = payload.safeParse(input);
  if (!parsed.success)
    return fail("Revise os campos obrigatórios, datas e valores.");
  try {
    const { brand, id, version, change } = parsed.data,
      session = await getCrmMember();
    if (!session) return fail("Entre para salvar no Hub.", 401);
    if (!(await canAccessBrand(session, brand))) return fail("Marca indisponível.", 404);
    const { db, id: author } = session;
    const hash = await fingerprint(JSON.stringify(parsed.data));
    const receipt = async () => {
      const found = await db
        .prepare(
          "SELECT version,author,fingerprint FROM hub_commands WHERE id=?",
        )
        .bind(id)
        .first<{ version: number; author: string; fingerprint: string }>();
      if (!found) return null;
      return found.author === author && found.fingerprint === hash
        ? reply({ version: found.version, id })
        : fail("Identificador já usado.", 409);
    };
    const existing = await receipt();
    if (existing) return existing;
    const state = await loadHub(session, brand);
    if (!state) return fail("Marca indisponível.", 404);
    if (state.version !== version)
      return (
        (await receipt()) ||
        fail("O Hub mudou. Reabra o formulário para usar a revisão atual.", 409)
      );
    if (!state.brand.active && change.kind !== "activate")
      return fail("Ative o espaço editorial desta marca.");
    const seq = version + 1,
      at = new Date().toISOString(),
      day = today();
    const statements: D1PreparedStatement[] = [];
    const save = (kind: string, record: string, data: unknown) =>
      statements.push(
        db
          .prepare(
            "INSERT INTO hub_entries(brand,kind,id,version,data) VALUES(?,?,?,?,?)",
          )
          .bind(brand, kind, record, seq, JSON.stringify(data)),
      );
    const stamp = { author, at };
    const hasMember = (person: string) =>
      state.members.some((m) => m.id === person);
    const currentPiece = (piece: string) =>
      state.pieces.find((p) => p.id === piece);
    const effectiveAssets = (e: Edition, referenceDay = day) =>
      e.assets
        .map((p) => assetIssue(state, p, e.channel, referenceDay))
        .find(Boolean);
    switch (change.kind) {
      case "activate":
        if (state.brand.active)
          return fail("O espaço editorial já está ativo.", 409);
        save("brand", brand, stamp);
        break;
      case "guide": {
        const input = change.guide;
        if (
          !hasMember(input.owner) ||
          (input.kind === "Prova" && !input.source)
        )
          return fail("Informe responsável e a fonte da prova.");
        if (input.id && !state.directives.some((g) => g.id === input.id))
          return fail("Diretriz indisponível.", 404);
        save("guide", input.id || id, {
          ...input,
          ...stamp,
          approved: false,
          proof: "",
        });
        break;
      }
      case "guideApprove": {
        const guide = state.directives.find((g) => g.id === change.guide.id);
        if (
          !guide ||
          guide.version !== change.guide.version ||
          guide.approved ||
          guide.review < day
        )
          return fail("Confira a versão e a data de revisão da diretriz.");
        save("guide", guide.id, {
          ...guide,
          ...stamp,
          approved: true,
          proof: change.proof,
        });
        break;
      }
      case "asset": {
        const input = change.asset,
          old = state.assets.find((a) => a.id === input.id);
        if (input.id && !old) return fail("Ativo indisponível.", 404);
        if (!hasMember(input.owner) || !!input.url === !!input.file)
          return fail(
            "Escolha um responsável e informe um arquivo ou um link.",
          );
        let fileOwner = "";
        if (input.file) {
          const retained =
            old?.file &&
            JSON.stringify(old.file) === JSON.stringify(input.file);
          fileOwner = retained ? old.fileOwner : author;
          const object = await env.BUCKET?.head(
            stageKey(brand, fileOwner, input.file.key),
          );
          if (
            !object ||
            object.size !== input.file.size ||
            object.customMetadata?.name !== input.file.name ||
            object.httpMetadata?.contentType !== input.file.type
          )
            return fail("O arquivo precisa ser enviado novamente.");
        }
        save("asset", input.id || id, {
          ...input,
          ...stamp,
          fileOwner,
          approved: false,
          proof: "",
        });
        break;
      }
      case "assetApprove": {
        const asset = state.assets.find((a) => a.id === change.asset.id);
        if (
          !asset ||
          asset.version !== change.asset.version ||
          asset.approved ||
          (asset.expires && asset.expires < day)
        )
          return fail("Confira a versão e a validade do ativo.");
        save("asset", asset.id, {
          ...asset,
          ...stamp,
          approved: true,
          proof: change.proof,
        });
        break;
      }
      case "edition": {
        const { id: pieceId, reuse, ...input } = change.edition,
          old = pieceId ? currentPiece(pieceId) : undefined;
        if (pieceId && !old) return fail("Peça indisponível.", 404);
        if (!hasMember(input.owner)) return fail("Escolha um responsável.");
        if (
          input.decision &&
          !state.references.some(
            (r) => r.kind === "PICO" && r.id === input.decision,
          )
        )
          return fail("Escolha uma decisão PICO desta conta.");
        if (
          input.radar &&
          !state.references.some(
            (r) => r.kind + ":" + r.id === input.radar && r.kind !== "PICO",
          )
        )
          return fail("Referência editorial indisponível.");
        if (new Set(input.assets.map((a) => a.id)).size !== input.assets.length)
          return fail("Escolha só uma versão de cada ativo.");
        const issue = input.assets
          .map((p) => assetIssue(state, p, input.channel))
          .find(Boolean);
        if (issue) return fail(issue);
        const prior = old && editionFor(state, old);
        let basis = prior?.basis || "",
          parent = prior?.parent || "",
          originPublication = prior?.originPublication || "";
        if (reuse) {
          if (old)
            return fail("O reaproveitamento precisa abrir uma nova peça.");
          const origin = latest(state.publications).find((p) => p.id === reuse),
            idea = origin && suggestion(state, origin);
          if (!idea)
            return fail(
              "O reaproveitamento precisa de uma publicação desta marca com resultado confirmado.",
            );
          parent = idea.edition.id;
          originPublication = idea.publication.id;
          basis =
            idea.publication.code +
            " · " +
            idea.count +
            " " +
            idea.edition.goal +
            " · primeiros 30 dias";
        }
        const key = pieceId || id;
        const guides = activeGuides(state)
          .filter((g) => guideEligible(g, input))
          .map(({ id, version }) => ({ id, version }));
        save("edition", key, {
          ...input,
          ...stamp,
          parent,
          basis,
          originPublication,
          guides,
        });
        save("piece", key, {
          ...stamp,
          edition: seq,
          status: old ? "Produção" : "Pauta",
        });
        break;
      }
      case "workflow": {
        const piece = currentPiece(change.piece),
          e = piece && editionFor(state, piece);
        if (!piece || !e) return fail("Peça indisponível.", 404);
        const { action, note, proof } = change;
        if (action === "Comentar") {
          if (!note) return fail("Escreva um comentário.");
          save("feedback", id, {
            ...stamp,
            piece: piece.id,
            edition: e.version,
            kind: "Comentário",
            note,
            proof: "",
          });
          break;
        }
        const legal = {
          Produzir: { from: "Pauta", to: "Produção" },
          "Enviar para revisão": { from: "Produção", to: "Revisão" },
          "Solicitar ajustes": { from: "Revisão", to: "Produção" },
          Aprovar: { from: "Revisão", to: "Aprovada" },
          Avaliar: { from: "Publicada", to: "Avaliada" },
        } as const;
        const transition = legal[action];
        if (piece.status !== transition.from)
          return fail("A etapa da peça mudou. Confira o fluxo atual.");
        if (action === "Aprovar" && !proof)
          return fail("Registre o comprovante de aprovação.");
        if ((action === "Solicitar ajustes" || action === "Avaliar") && !note)
          return fail("Registre os ajustes ou a avaliação.");
        if (action === "Enviar para revisão" || action === "Aprovar") {
          const issue = effectiveAssets(e);
          if (issue) return fail(issue);
        }
        const kind =
          action === "Aprovar"
            ? "Aprovação"
            : action === "Avaliar"
              ? "Avaliação"
              : action === "Solicitar ajustes"
                ? "Ajustes"
                : null;
        if (kind)
          save("feedback", id, {
            ...stamp,
            piece: piece.id,
            edition: e.version,
            kind,
            note,
            proof,
          });
        save("piece", piece.id, {
          ...stamp,
          edition: e.version,
          status: transition.to,
        });
        break;
      }
      case "prepare": {
        const piece = currentPiece(change.piece),
          e = piece && editionFor(state, piece);
        if (
          !piece ||
          !e ||
          !["Aprovada", "Publicada", "Avaliada"].includes(piece.status)
        )
          return fail("A versão precisa estar aprovada.");
        const issue = effectiveAssets(e);
        if (issue) return fail(issue);
        const code = "EBA-" + id.replace(/-/g, "").toUpperCase();
        let link: string;
        try {
          link = generateLink(
            change.destination,
            change.target,
            change.message,
            e.channel,
            brand,
            code,
          );
        } catch (error) {
          return fail(
            error instanceof Error ? error.message : "Destino inválido.",
          );
        }
        save("publication", id, {
          ...stamp,
          piece: piece.id,
          edition: e.version,
          code,
          destination: change.destination,
          target: change.target,
          link,
          published: "",
          reference: "",
        });
        break;
      }
      case "publish": {
        const p = state.publications.find((p) => p.id === change.publication),
          piece = p && currentPiece(p.piece),
          e = p && editionFor(state, p);
        if (!p || !piece || !e || p.published)
          return fail("Publicação indisponível ou já confirmada.", 409);
        if (
          e.version !== piece.edition ||
          !["Aprovada", "Publicada", "Avaliada"].includes(piece.status)
        )
          return fail("Prepare uma publicação para a versão aprovada atual.");
        if (change.date > day || change.date < todayFromTimestamp(p.at))
          return fail(
            "Use a data em que esta publicação foi ao ar, após a preparação do link.",
          );
        const issue = effectiveAssets(e);
        if (issue) return fail(issue);
        save("publication", p.id, {
          ...p,
          ...stamp,
          published: change.date,
          reference: change.reference,
        });
        if (piece.status === "Aprovada")
          save("piece", piece.id, {
            ...stamp,
            edition: e.version,
            status: "Publicada",
          });
        break;
      }
      case "results": {
        const rows = change.rows,
          correction = change.correct
            ? state.results.find((r) => r.id === change.correct)
            : undefined;
        if (
          change.correct &&
          (!correction ||
            rows.length !== 1 ||
            resultKey(rows[0]) !== resultKey(correction))
        )
          return fail("A correção deve manter o tipo e o ID de origem.");
        const known = new Set(latest(state.results).map(resultKey)),
          seen = new Set<string>();
        for (const row of rows) {
          const issue = resultIssue(row),
            key = resultKey(row);
          if (issue) return fail(issue);
          if (seen.has(key) || (known.has(key) && !correction))
            return fail(
              "Já existe um evento com este tipo e ID. Abra o evento para corrigir.",
              409,
            );
          seen.add(key);
        }
        for (const row of rows)
          save(
            "result",
            correction?.id || (rows.length === 1 ? id : crypto.randomUUID()),
            { ...row, ...stamp, code: normalizeCode(row.code) },
          );
        break;
      }
    }
    try {
      await db.batch([
        db
          .prepare(
            "INSERT INTO hub_commands(version,id,author,fingerprint) VALUES(?,?,?,?)",
          )
          .bind(seq, id, author, hash),
        ...statements,
      ]);
    } catch (error) {
      const replay = await receipt();
      if (replay) return replay;
      if (/constraint|unique/i.test(String(error)))
        return fail("O Hub mudou em outra sessão.", 409);
      throw error;
    }
    return reply({ version: seq, id });
  } catch {
    return fail("Não foi possível confirmar a gravação. Tente novamente.", 503);
  }
}
function todayFromTimestamp(timestamp: string) {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(timestamp));
}
