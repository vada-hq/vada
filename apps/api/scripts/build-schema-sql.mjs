// 표를 만드는 SQL을 **모듈로** 낸다.
//
// 파일로 두고 읽으면 읽는 쪽마다 경로 규칙이 다르다 — Node는 되는데 Vite 아래서는
// import.meta.url이 다른 곳을 가리켜 못 읽었다. 모듈이면 어디서 부르든 같다.
//
// 원본은 src/db/schema.ts 하나다. drizzle-kit이 그것을 SQL로 옮기고 이 스크립트가
// 모듈로 감싼다. 손으로 고치면 다음 생성에서 지워진다.
import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const out = mkdtempSync(join(tmpdir(), "vada-schema-"));
execFileSync("npx", ["drizzle-kit", "generate", "--name", "schema", "--out", out, "--schema", "./src/db/schema.ts", "--dialect", "postgresql"], {
  stdio: "inherit",
  shell: process.platform === "win32"
});
const file = readdirSync(out).find((name) => name.endsWith(".sql"));
const sql = readFileSync(join(out, file), "utf-8").replaceAll("--> statement-breakpoint", "");

const module = [
  "// **만들어진 파일이다.** `npm run db:schema`가 낸다 — 손으로 고치면 다음 생성에서",
  "// 지워진다. 원본은 `src/db/schema.ts`다.",
  "//",
  "// 파일이 아니라 모듈인 까닭: 읽는 쪽마다 경로 규칙이 다르다. Node에서는 되는데",
  "// Vite 아래서는 import.meta.url이 다른 곳을 가리켜 못 읽었다.",
  "export const SCHEMA_SQL = " + JSON.stringify(sql),
  ""
].join(String.fromCharCode(10));
writeFileSync("src/db/schema-sql.ts", module, "utf-8");
console.log("표 " + (sql.match(/CREATE TABLE/g) ?? []).length + "개를 모듈로 냈습니다.");
