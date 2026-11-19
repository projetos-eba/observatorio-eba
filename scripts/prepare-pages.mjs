import { cp, mkdir, rm, writeFile } from "node:fs/promises";

const dist = new URL("../dist/", import.meta.url);
const pages = new URL("pages/", dist);
const server = new URL("server/", dist);
const worker = new URL("_worker.js/", pages);

await rm(pages, { recursive: true, force: true });
await cp(new URL("client/", dist), pages, {
  recursive: true,
  filter: (source) => ![".assetsignore", ".vite", "vinext-client-entry-manifest.json"].includes(source.split("/").at(-1)),
});
await mkdir(worker);
await cp(server, worker, {
  recursive: true,
  filter: (source) => !source.endsWith(".json"),
});
await cp(new URL("index.js", server), new URL("app.mjs", worker));
await cp(new URL("../worker/pages-access.mjs", import.meta.url), new URL("pages-access.mjs", worker));
await writeFile(new URL("index.js", worker), `import app from "./app.mjs";
import { protectPages } from "./pages-access.mjs";
export default { fetch: protectPages(app) };
`);
await writeFile(new URL("_routes.json", pages), JSON.stringify({ version: 1, include: ["/*"], exclude: [] }));
