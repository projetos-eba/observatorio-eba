import { randomBytes } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Plugin } from "vite";

function localKey() {
  const directory = join(process.cwd(), ".sites-runtime");
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const path = join(directory, "integracoes.key");
  try {
    writeFileSync(path, randomBytes(32).toString("hex") + "\n", {
      flag: "wx",
      mode: 0o600,
    });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
  }
  const key = readFileSync(path, "utf8").trim();
  if (!/^[a-f0-9]{64}$/i.test(key))
    throw Error("Chave local de Integrações inválida.");
  return key;
}
export function integrationRuntime() {
  const secret = randomBytes(32).toString("hex");
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    hourCycle: "h23",
  });
  const plugin: Plugin = {
    name: "eba-integration-schedule",
    configureServer(server) {
      const http = server.httpServer;
      if (!http) return;
      let running = false,
        timer: ReturnType<typeof setInterval> | undefined;
      async function tick() {
        const addr = http?.address();
        if (
          running ||
          !addr ||
          typeof addr === "string" ||
          Number(formatter.format(new Date())) < 8
        )
          return;
        running = true;
        try {
          const host = addr.address.includes(":") ? "[::1]" : "127.0.0.1";
          await fetch(
            "http://" + host + ":" + addr.port + "/api/integracoes/sync",
            {
              method: "POST",
              headers: { Authorization: "Bearer " + secret },
              signal: AbortSignal.timeout(230_000),
            },
          );
        } catch {
          /* The next tick can recover from a server restart. */
        } finally {
          running = false;
        }
      }
      http.once("listening", () => {
        void tick();
        timer = setInterval(() => void tick(), 15 * 60_000);
        timer.unref();
      });
      http.once("close", () => clearInterval(timer));
    },
  };
  return {
    plugin,
    vars: {
      EBA_INTEGRATION_KEY: localKey(),
      EBA_DEV_ADMIN: "local_seedy",
      EBA_INTEGRATION_SCHEDULER: secret,
    },
  };
}
