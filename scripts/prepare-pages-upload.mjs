import { cp, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const dist = new URL("../dist/", import.meta.url);
const upload = new URL("pages-upload/", dist);

await rm(upload, { recursive: true, force: true });
await cp(new URL("pages/", dist), upload, {
  recursive: true,
  filter: (path) => !path.endsWith("/_worker.js"),
});
await build({
  entryPoints: [fileURLToPath(new URL("pages/_worker.js/index.js", dist))],
  outfile: fileURLToPath(new URL("_worker.js", upload)),
  bundle: true,
  format: "esm",
  platform: "neutral",
  external: ["cloudflare:*", "node:*"],
  minify: true,
});
