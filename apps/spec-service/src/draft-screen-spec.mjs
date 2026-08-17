// figma.design.json에서 화면 동작 명세 초안을 뽑고, 사람이 답해야 할 것을 보고한다.
//
//   node apps/spec-service/src/draft-screen-spec.mjs <wireframeKey> <screenId>
//   node apps/spec-service/src/draft-screen-spec.mjs <wireframeKey> <screenId> --verify
//
// --verify는 이미 등록된 screen.json과 대조해 추출 정확도를 표로 보여준다.
import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  compareWithSpec,
  draftScreenElements
} from "../../../packages/contracts/src/screen-draft.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function runCli() {
  const [wireframeKey, screenId, ...flags] = process.argv.slice(2);
  if (!wireframeKey || !screenId) {
    process.stderr.write(
      "사용법: draft-screen-spec.mjs <wireframeKey> <screenId> [--verify]\n"
    );
    process.exitCode = 1;
    return;
  }

  const screenDir = join(repoRoot, "specs", "figma", wireframeKey, "screens", screenId);
  const design = await readJson(join(screenDir, "figma.design.json"));
  const { elements, questions } = draftScreenElements(design);

  if (flags.includes("--verify")) {
    const spec = await readJson(join(screenDir, "screen.json"));
    const rows = compareWithSpec(elements, spec.elements);
    process.stdout.write(`## ${screenId} — 추출 초안 대 등록된 명세\n`);
    const hits = { matched: 0, typeMatch: 0, labelMatch: 0 };
    for (const row of rows) {
      const mark = (ok) => (ok ? "O" : "X");
      const ok = row.matched && row.typeMatch && row.labelMatch;
      process.stdout.write(
        `찾음 ${mark(row.matched)} 유형 ${mark(row.typeMatch)} 라벨 ${mark(row.labelMatch)}  ${
          ok ? row.actual : `등록: ${row.actual}\n${" ".repeat(28)}초안: ${row.draft}`
        }\n`
      );
      for (const key of ["matched", "typeMatch", "labelMatch"]) {
        hits[key] += row[key] ? 1 : 0;
      }
    }
    process.stdout.write(
      `합계 ${rows.length}개 — 찾음 ${hits.matched}/${rows.length}, 유형 ${hits.typeMatch}/${rows.length}, 라벨 ${hits.labelMatch}/${rows.length}\n`
    );
    return;
  }

  process.stdout.write(
    `${JSON.stringify(
      {
        schemaVersion: 1,
        screenId,
        source: {
          pageName: design.source?.pageName ?? "",
          nodeId: design.root?.id ?? "",
          name: design.root?.name ?? "",
          figmaType: "FRAME"
        },
        elements
      },
      null,
      2
    )}\n`
  );
  process.stderr.write(`\n사람이 답해야 할 것 ${questions.length}건:\n`);
  for (const question of questions) {
    process.stderr.write(`  - ${question}\n`);
  }
}

const entryUrl = process.argv[1]
  ? pathToFileURL(resolve(process.argv[1])).href
  : undefined;
if (entryUrl === import.meta.url) {
  runCli().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
