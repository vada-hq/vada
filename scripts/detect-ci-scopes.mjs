import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { fileURLToPath } from "node:url";

const forceAllPaths = new Set([
  ".github/workflows/ci.yml",
  "justfile",
  "scripts/detect-ci-scopes.mjs",
  "scripts/detect-ci-scopes.test.mjs",
]);

function normalized(path) {
  return path.replaceAll("\\", "/").replace(/^\.\//, "");
}

function startsWithAny(path, prefixes) {
  return prefixes.some((prefix) => path.startsWith(prefix));
}

export function detectCiScopes(paths) {
  const changed = paths.map(normalized).filter(Boolean);
  if (changed.some((path) => forceAllPaths.has(path))) return { api: true, web: true };
  const api = changed.some((path) => startsWithAny(path, ["apps/api/"]));
  const web = changed.some(
    (path) =>
      startsWithAny(path, ["apps/web/", "packages/", "prototypes/wireframe/", "contracts/"]) ||
      path === "package.json" ||
      path === "pnpm-lock.yaml" ||
      path.startsWith("scripts/validate-purchase-request-openapi-client"),
  );
  return { api, web };
}

function changedPaths(base, head) {
  if (!base || /^0+$/.test(base)) return null;
  return execFileSync("git", ["diff", "--name-only", base, head], { encoding: "utf8" })
    .split(/\r?\n/)
    .filter(Boolean);
}

function main() {
  const { values } = parseArgs({
    options: {
      base: { type: "string" },
      head: { type: "string", default: "HEAD" },
    },
  });
  const paths = changedPaths(values.base, values.head);
  const scopes = paths === null ? { api: true, web: true } : detectCiScopes(paths);
  process.stdout.write(`api=${scopes.api}\nweb=${scopes.web}\n`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
