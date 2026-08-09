import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { fileURLToPath } from "node:url";

const forceAllPaths = new Set([
  ".github/workflows/ci.yml",
  // 배포 워크플로는 API를 꾸리고 Terraform을 돌린다. 그 파일만 고쳐도 둘 다
  // 영향을 받는데, 전에는 두 검사가 다 건너뛰어졌다.
  ".github/workflows/deploy.yml",
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
  if (changed.some((path) => forceAllPaths.has(path))) {
    return { api: true, web: true, infra: true };
  }
  const api = changed.some((path) => startsWithAny(path, ["apps/api/"]));
  const web = changed.some(
    (path) =>
      startsWithAny(path, ["apps/web/", "packages/", "prototypes/wireframe/", "contracts/"]) ||
      path === "package.json" ||
      path === "pnpm-lock.yaml" ||
      path.startsWith("scripts/validate-purchase-request-openapi-client") ||
      // 그 검증기에서 나눠 나온 것들. 이름이 달라졌다고 빠지면 계약 → OpenAPI
      // 변환을 고쳐도 웹 검사가 안 돈다.
      path.startsWith("scripts/contract-openapi/"),
  );
  const infra = changed.some((path) => startsWithAny(path, ["infra/"]));
  return { api, web, infra };
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
  const scopes =
    paths === null ? { api: true, web: true, infra: true } : detectCiScopes(paths);
  process.stdout.write(`api=${scopes.api}\nweb=${scopes.web}\ninfra=${scopes.infra}\n`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
