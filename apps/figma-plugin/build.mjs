import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { build } from "esbuild";

const projectDir = dirname(fileURLToPath(import.meta.url));
const distDir = resolve(projectDir, "dist");

await mkdir(distDir, { recursive: true });

await build({
  entryPoints: [resolve(projectDir, "src/code.mjs")],
  bundle: true,
  outfile: resolve(distDir, "code.js"),
  format: "iife",
  platform: "browser",
  target: "es2017"
});

const uiBuild = await build({
  entryPoints: [resolve(projectDir, "src/ui.mjs")],
  bundle: true,
  write: false,
  format: "iife",
  platform: "browser",
  target: "es2017",
  loader: {
    ".json": "json"
  }
});

const uiTemplate = await readFile(resolve(projectDir, "src/ui.html"), "utf8");
const uiScript = uiBuild.outputFiles[0].text.replaceAll("</script>", "<\\/script>");
const uiHtml = uiTemplate.replace(
  "<!-- UI_SCRIPT -->",
  `<script>${uiScript}</script>`
);

await writeFile(resolve(distDir, "ui.html"), uiHtml, "utf8");
