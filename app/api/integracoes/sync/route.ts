import { env } from "cloudflare:workers";
import { fail, reply } from "../../../conteudo/server";
import { daily } from "../../../integracoes/server";

export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(
    new URL(request.url).hostname,
  );
  if (
    !local ||
    !env.EBA_INTEGRATION_SCHEDULER ||
    request.headers.get("Authorization") !==
      "Bearer " + env.EBA_INTEGRATION_SCHEDULER
  )
    return fail("Rota disponível para a rotina local.", 403);
  if (!env.DB) return fail("Banco indisponível.", 503);
  try {
    await daily(env.DB);
    return reply({ ok: true });
  } catch {
    return fail("A rotina tentará novamente.", 503);
  }
}
