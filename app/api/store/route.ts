import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../../../db";
import { collections, storeEntries } from "../../../db/schema";

export const dynamic = "force-dynamic";

const maxBytes = 128 * 1024;
const entrySchema = z.object({
  collection: z.enum(collections),
  id: z.string().min(1).max(128).regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/),
  data: z.record(z.unknown()),
  revision: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER - 1),
}).strict();

function reply(payload: unknown, status = 200) {
  return Response.json(payload, { status, headers: { "Cache-Control": "private, no-store" } });
}

export async function GET() {
  try {
    const entries = await getDb().select().from(storeEntries);
    return reply({ entries });
  } catch {
    return reply({ error: "Não foi possível carregar os registros." }, 503);
  }
}

export async function PUT(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin) {
    return reply({ error: "A origem da solicitação é inválida." }, 403);
  }
  if (request.headers.get("content-type")?.split(";")[0].trim() !== "application/json") {
    return reply({ error: "Envie os dados em JSON." }, 415);
  }
  if (Number(request.headers.get("content-length")) > maxBytes) {
    return reply({ error: "O registro excede o limite de 128 KB." }, 413);
  }

  let payload: unknown;
  try {
    const bytes = await request.arrayBuffer();
    if (bytes.byteLength > maxBytes) {
      return reply({ error: "O registro excede o limite de 128 KB." }, 413);
    }
    payload = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return reply({ error: "O corpo da solicitação contém JSON inválido." }, 400);
  }
  const parsed = entrySchema.safeParse(payload);
  if (!parsed.success) {
    return reply({ error: "Confira a coleção, o identificador, os dados e a revisão do registro." }, 400);
  }
  const { collection, id, data, revision } = parsed.data;
  const nextRevision = revision + 1;
  try {
    const db = getDb();
    const updated = revision === 0
      ? await db.insert(storeEntries).values({ collection, id, data, revision: nextRevision })
        .onConflictDoNothing().returning({ revision: storeEntries.revision })
      : await db.update(storeEntries).set({ data, revision: nextRevision })
        .where(and(eq(storeEntries.collection, collection), eq(storeEntries.id, id), eq(storeEntries.revision, revision)))
        .returning({ revision: storeEntries.revision });
    if (!updated.length) {
      return reply({ error: "Este registro mudou em outra sessão. Recarregue para ver a versão mais recente." }, 409);
    }
    return reply(updated[0], revision === 0 ? 201 : 200);
  } catch {
    return reply({ error: "Não foi possível salvar o registro." }, 503);
  }
}
