/**
 * 화면 주소와 API 경로가 겹치므로 접두사로 가른다. 그 접두사가 **세 곳**에 적혀 있다.
 *
 *   1. 웹이 부르는 곳            apps/web/src/shared/api/base.ts
 *   2. 로컬에서 벗기는 곳        apps/web/vite.config.ts
 *   3. 배포에서 벗기는 곳        infra/cloudfront/api-prefix.js
 *
 * 세 곳이 어긋나면 로컬은 멀쩡한데 배포된 화면의 모든 요청이 404가 된다. 그것도
 * 조용히 — CloudFront가 접두사를 못 벗기면 API Gateway가 없는 경로를 받고,
 * 화면은 그냥 데이터가 안 나온다.
 *
 * 접두사는 계약이 아니라 배포 라우팅 사실이라 어느 계약도 이것을 소유하지 않는다.
 * 소유자가 없으니 검사가 소유한다.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const REPOSITORY_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function read(...parts) {
  return readFileSync(join(REPOSITORY_ROOT, ...parts), "utf8");
}

function matched(source, pattern, where) {
  const found = source.match(pattern);
  if (!found) {
    throw new Error(`${where}에서 API 접두사를 찾지 못했습니다. 형태가 바뀌었다면 이 검사도 같이 고치십시오.`);
  }
  return found[1];
}

/** 세 곳이 각각 무엇이라고 말하는지. 판단하지 않고 읽기만 한다. */
export function apiPrefixes() {
  return {
    web: matched(
      read("apps", "web", "src", "shared", "api", "base.ts"),
      /API_BASE_PATH\s*=\s*"([^"]+)"/,
      "apps/web/src/shared/api/base.ts",
    ),
    viteProxy: matched(
      read("apps", "web", "vite.config.ts"),
      /proxy:\s*\{\s*(?:\/\/[^\n]*\n\s*)*"([^"]+)"/,
      "apps/web/vite.config.ts",
    ),
    cloudFront: matched(
      read("infra", "cloudfront", "api-prefix.js"),
      /var PREFIX = "([^"]+)"/,
      "infra/cloudfront/api-prefix.js",
    ),
  };
}

function main() {
  const prefixes = apiPrefixes();
  const distinct = new Set(Object.values(prefixes));
  for (const [where, prefix] of Object.entries(prefixes)) {
    process.stdout.write(`${where.padEnd(11)} ${prefix}\n`);
  }
  if (distinct.size !== 1) {
    process.stderr.write("\nAPI 접두사가 어긋났습니다. 배포된 화면의 모든 요청이 404가 됩니다.\n");
    process.exit(1);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
