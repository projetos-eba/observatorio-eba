import { z } from "zod";
import { getCrmMember } from "../../crm/session";
import { fail, reply, sameOrigin } from "../../conteudo/server";
import { graph, GraphError } from "../../integracoes/graph";
import { providers } from "../../integracoes/model";
import {
  current,
  disconnect,
  getState,
  install,
  linkPost,
  publicationPost,
  syncProvider,
} from "../../integracoes/server";
export const dynamic = "force-dynamic";

const provider = z.enum(providers);
const digits = z.string().regex(/^\d{1,32}$/);
const parent = z.union([digits, z.literal("")]);
const token = z
  .string()
  .trim()
  .min(12)
  .max(6000)
  .regex(/^[A-Za-z0-9._~+\/=-]+$/);
const secret = z
  .string()
  .trim()
  .max(160)
  .regex(/^[A-Za-z0-9]*$/);
const account = z.object({ provider, token, secret, parent });
const command = z.discriminatedUnion("action", [
  account.extend({ action: z.literal("test") }),
  account.extend({ action: z.literal("connect"), id: digits }),
  z.object({ action: z.enum(["sync", "verify", "disconnect"]), provider }),
  z.object({
    action: z.literal("link"),
    resource: digits,
    media: digits,
    publication: z.string().uuid(),
  }),
]);

export async function GET(request: Request) {
  try {
    const session = await getCrmMember();
    if (!session) return fail("Entre para abrir Integrações.", 401);
    const query = new URL(request.url).searchParams;
    const publication = z.string().uuid().safeParse(query.get("publicacao"));
    if (publication.success)
      return reply({
        entry: await publicationPost(session.db, publication.data),
      });
    const source = provider.safeParse(query.get("app")),
      resource = digits.safeParse(query.get("recurso"));
    const page = Number(query.get("pagina") || "1");
    return reply(
      await getState(
        session.db,
        session.id,
        source.success ? source.data : "instagram",
        resource.success ? resource.data : "",
        Number.isInteger(page) && page > 0 ? Math.min(page, 1000) : 1,
      ),
    );
  } catch {
    return fail("Não foi possível carregar as integrações.", 503);
  }
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return fail("Origem inválida.", 403);
  if (
    request.headers.get("content-type")?.split(";")[0].trim() !==
    "application/json"
  )
    return fail("Formato inválido.", 415);
  try {
    const session = await getCrmMember();
    if (!session) return fail("Entre para configurar os apps.", 401);
    const raw = await request.text();
    if (raw.length > 10000) return fail("Pedido muito longo.", 413);
    let input: unknown;
    try {
      input = JSON.parse(raw);
    } catch {
      return fail("Pedido inválido.");
    }
    const checked = command.safeParse(input);
    if (!checked.success)
      return fail("Confira o formato da credencial e dos identificadores.");
    const data = checked.data,
      { db, id: me } = session;
    if (data.action === "test" || data.action === "connect") {
      if (data.provider === "whatsapp" && !data.parent)
        return fail("Informe o ID da conta WhatsApp Business.");
      const auth = { token: data.token, secret: data.secret },
        client = graph(data.provider, auth);
      const previous =
        data.action === "connect" ? await current(db, data.provider) : null;
      const items = await client.discover(data.parent);
      if (!items.length)
        return fail(
          data.provider === "meta_ads"
            ? "Nenhuma conta encontrada. Confira as permissões ou tente informar o ID."
            : "Nenhum recurso encontrado nesta conta.",
        );
      if (data.action === "test") {
        // The preview confirms discovery. Saving also probes the read endpoint for the selected resource.
        return reply({ items });
      }
      const found = items.find((r) => r.id === data.id);
      if (!found) return fail("O recurso selecionado ficou indisponível.");
      const selection = await client.verify(found);
      if (!(await install(db, data.provider, selection, auth, previous)))
        return fail("A conexão mudou em outra sessão.", 409);
      return reply({ message: "Conexão confirmada." });
    }
    if (data.action === "link") {
      return (await linkPost(
        db,
        me,
        data.resource,
        data.media,
        data.publication,
      ))
        ? reply({ message: "Post vinculado à publicação." })
        : fail(
            "Escolha um post importado e uma publicação do Instagram da EBA.",
          );
    }
    if (data.action === "disconnect") {
      await disconnect(db, data.provider);
      return reply({ message: "Credencial removida." });
    }
    return reply(
      await syncProvider(
        db,
        data.provider,
        data.action === "verify" ? "test" : "manual",
      ),
    );
  } catch (error) {
    if (error instanceof GraphError)
      return fail(
        error.message,
        error.code === "throttle" ? 429 : error.code === "network" ? 503 : 400,
      );
    if (
      String(error).includes("integration_publication_unique") ||
      String(error).includes("UNIQUE constraint failed")
    )
      return fail("A publicação já está vinculada a outro post.", 409);
    if (error instanceof Error && error.message.startsWith("O cofre local"))
      return fail(error.message, 503);
    return fail("Não foi possível concluir a operação.", 503);
  }
}
