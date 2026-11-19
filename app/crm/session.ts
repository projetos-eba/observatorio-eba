import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../chatgpt-auth";

export async function getCrmMember() {
  const user = await getChatGPTUser();
  if (!user) return null;
  const db = env.DB;
  if (!db) throw new Error("Banco D1 indisponível.");
  await db
    .prepare(
      "INSERT INTO crm_members (id,name) VALUES (?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name WHERE name<>excluded.name",
    )
    .bind(user.userId, user.displayName)
    .run();
  return { db, id: user.userId };
}
