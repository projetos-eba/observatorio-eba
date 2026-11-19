import { daily } from "../app/integracoes/sync-engine";

const worker = {
  async scheduled(_event: ScheduledController, env: Cloudflare.Env) {
    if (!env.DB) throw new Error("Configure o binding DB do Worker.");
    if (!/^[a-f0-9]{64}$/i.test(env.EBA_INTEGRATION_KEY || ""))
      throw new Error("Configure a chave do cofre no Worker.");
    await daily(env.DB);
  },
};

export default worker;
