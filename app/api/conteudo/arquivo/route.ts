import { env } from "cloudflare:workers";
import { getCrmMember } from "../../../crm/session";
import {
  brandsFor,
  fail,
  fingerprint,
  maxFile,
  reply,
  sameOrigin,
  stageKey,
  uuid,
} from "../../../conteudo/server";
import type { Asset } from "../../../conteudo/model";

export const dynamic = "force-dynamic";

function fileType(bytes: Uint8Array) {
  const lead = (values: number[], offset = 0) =>
    values.every((v, i) => bytes[i + offset] === v);
  if (lead([255, 216, 255])) return "image/jpeg";
  if (lead([137, 80, 78, 71, 13, 10, 26, 10])) return "image/png";
  if (lead([82, 73, 70, 70]) && lead([87, 69, 66, 80], 8)) return "image/webp";
  if (lead([37, 80, 68, 70, 45])) return "application/pdf";
  return "";
}
export async function PUT(request: Request) {
  if (!sameOrigin(request)) return fail("Origem inválida.", 403);
  try {
    const session = await getCrmMember();
    if (!session) return fail("Entre para enviar arquivos.", 401);
    const bucket = env.BUCKET;
    if (!bucket) return fail("Armazenamento local indisponível.", 503);
    const url = new URL(request.url);
    const brand = url.searchParams.get("marca") || "",
      token = url.searchParams.get("envio") || "";
    const name = (url.searchParams.get("nome") || "").trim();
    if (!uuid.safeParse(token).success || !name || name.length > 240)
      return fail("Identificador ou nome inválido.");
    if (!(await brandsFor(session.db)).some((b) => b.id === brand && b.active))
      return fail("Marca indisponível.", 404);
    if (Number(request.headers.get("content-length")) > maxFile)
      return fail("O arquivo excede 15 MB.", 413);
    if (!request.body) return fail("Arquivo vazio.");
    const reader = request.body.getReader(),
      chunks: Uint8Array[] = [];
    let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > maxFile) {
        await reader.cancel();
        return fail("O arquivo excede 15 MB.", 413);
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let pos = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, pos);
      pos += chunk.length;
    }
    const type = fileType(bytes);
    if (!type) return fail("Use um arquivo JPG, PNG, WebP ou PDF válido.", 415);
    const key = stageKey(brand, session.id, token),
      hash = await fingerprint(bytes.buffer);
    const existing = await bucket.head(key);
    if (existing) {
      if (
        existing.customMetadata?.hash !== hash ||
        existing.customMetadata?.name !== name
      )
        return fail("Este envio está reservado para outro arquivo.", 409);
    } else {
      const stored = await bucket.put(key, bytes, {
        httpMetadata: { contentType: type },
        customMetadata: { hash, name },
        onlyIf: { etagDoesNotMatch: "*" },
      });
      if (!stored) {
        const winner = await bucket.head(key);
        if (
          winner?.customMetadata?.hash !== hash ||
          winner.customMetadata?.name !== name
        )
          return fail("Este envio foi usado em outra sessão.", 409);
      }
    }
    return reply({ key: token, name, type, size });
  } catch {
    return fail(
      "O arquivo não foi confirmado. Tente o mesmo envio novamente.",
      503,
    );
  }
}
export async function GET(request: Request) {
  try {
    const session = await getCrmMember();
    if (!session) return fail("Entre para acessar o arquivo.", 401);
    const url = new URL(request.url),
      brand = url.searchParams.get("marca") || "";
    const ref = await session.db
      .prepare(
        "SELECT data FROM hub_entries WHERE kind='asset' AND brand=? AND id=? AND version=?",
      )
      .bind(
        brand,
        url.searchParams.get("ativo"),
        Number(url.searchParams.get("versao")),
      )
      .first<{ data: string }>();
    const asset = ref ? (JSON.parse(ref.data) as Asset) : null;
    const file =
      asset?.file && env.BUCKET
        ? await env.BUCKET.get(stageKey(brand, asset.fileOwner, asset.file.key))
        : null;
    if (!asset?.file || !file) return fail("Arquivo indisponível.", 404);
    const headers = new Headers({
      "Content-Type": asset.file.type,
      "Content-Length": String(file.size),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "sandbox",
    });
    headers.set(
      "Content-Disposition",
      (asset.file.type === "application/pdf" ? "attachment" : "inline") +
        "; filename*=UTF-8''" +
        encodeURIComponent(asset.file.name).replace(
          /['()]/g,
          (c) => "%" + c.charCodeAt(0).toString(16),
        ),
    );
    return new Response(file.body, { headers });
  } catch {
    return fail("Não foi possível abrir o arquivo.", 503);
  }
}
