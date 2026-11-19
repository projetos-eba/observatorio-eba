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
  const admin = user.userId === env.EBA_DEV_ADMIN || !!(await db
    .prepare("SELECT 1 FROM workspace_permissions WHERE member=? AND scope='admin' AND target=''")
    .bind(user.userId)
    .first());
  return { db, id: user.userId, admin };
}

export type WorkspaceSession = NonNullable<Awaited<ReturnType<typeof getCrmMember>>>;

export function accountScope(session: WorkspaceSession, company: string) {
  return session.admin ? { sql: "1=1", args: [] } : {
    sql: `(EXISTS(SELECT 1 FROM workspace_permissions wp WHERE wp.member=? AND wp.scope='account' AND wp.target=${company})
      OR EXISTS(SELECT 1 FROM crm_deals own WHERE own.company=${company} AND own.owner=?)
      OR EXISTS(SELECT 1 FROM crm_handoffs lead WHERE lead.company=${company} AND lead.lead=?))`,
    args: [session.id, session.id, session.id],
  };
}

export function dealScope(session: WorkspaceSession, alias: string) {
  if (session.admin) return { sql: "1=1", args: [] };
  const account = accountScope(session, alias + ".company");
  return { sql: `(${alias}.owner=? OR ${account.sql})`, args: [session.id, ...account.args] };
}

export async function canAccessAccount(session: WorkspaceSession, company: string) {
  const scope = accountScope(session, "c.id");
  return !!(await session.db.prepare("SELECT 1 FROM crm_companies c WHERE c.id=? AND " + scope.sql)
    .bind(company, ...scope.args).first());
}

export async function canAccessBrand(session: WorkspaceSession, brand: string) {
  if (session.admin) return true;
  if (brand.startsWith("conta:") && await canAccessAccount(session, brand.slice(6))) return true;
  return !!(await session.db.prepare("SELECT 1 FROM workspace_permissions WHERE scope='brand' AND member=? AND target=?")
    .bind(session.id, brand).first());
}
