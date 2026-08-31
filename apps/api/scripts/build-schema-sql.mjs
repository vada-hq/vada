// 표를 만드는 SQL을 **모듈로** 낸다.
//
// 파일로 두고 읽으면 읽는 쪽마다 경로 규칙이 다르다 — Node는 되는데 Vite 아래서는
// import.meta.url이 다른 곳을 가리켜 못 읽었다. 모듈이면 어디서 부르든 같다.
//
// ## 옮김 파일에서 낸다 (2026-08-31)
//
// 오랫동안 여기서 drizzle-kit을 **새로 돌려** 통째 SQL을 만들었다. 검사에는 맞았지만
// 실서비스와 길이 달랐다 — 저쪽은 옮김 파일을 차례로 적용해 표를 만들고 이쪽은
// 스키마에서 한 번에 만들었으므로, **두 길이 갈리면 검사가 실제와 다른 표에 대고
// 돈다.** 이제 둘 다 `migrations/`를 읽는다.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const migrations = join(here, "..", "migrations");

// 차례가 뜻을 갖는다. 이름 앞의 번호가 그 차례다.
const files = readdirSync(migrations)
  .filter((name) => name.endsWith(".sql"))
  .sort();

if (files.length === 0) {
  throw new Error("옮김 파일이 하나도 없습니다. `npm run db:generate`를 먼저 돌리세요.");
}

const sql = files
  .map((name) => readFileSync(join(migrations, name), "utf-8"))
  .join(String.fromCharCode(10))
  .replaceAll("--> statement-breakpoint", "");

const module = [
  "// **만들어진 파일이다.** `npm run db:schema`가 낸다 — 손으로 고치면 다음 생성에서",
  "// 지워진다. 원본은 `migrations/`이고 그것은 `src/db/schema.ts`에서 나온다.",
  "//",
  "// 파일이 아니라 모듈인 까닭: 읽는 쪽마다 경로 규칙이 다르다. Node에서는 되는데",
  "// Vite 아래서는 import.meta.url이 다른 곳을 가리켜 못 읽었다.",
  "export const SCHEMA_SQL = " + JSON.stringify(sql),
  ""
].join(String.fromCharCode(10));
writeFileSync(join(here, "..", "src", "db", "schema-sql.ts"), module, "utf-8");
console.log(
  "옮김 " + files.length + "개에서 표 " + (sql.match(/CREATE TABLE/g) ?? []).length + "개를 모듈로 냈습니다."
);
