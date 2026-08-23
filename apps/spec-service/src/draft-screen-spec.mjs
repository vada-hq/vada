// figma.design.json에서 화면 동작 명세 초안을 뽑고, 사람이 답해야 할 것을 보고한다.
//
//   node apps/spec-service/src/draft-screen-spec.mjs <wireframeKey> <screenId>
//   node apps/spec-service/src/draft-screen-spec.mjs <wireframeKey> <screenId> --scope <키>
//   node apps/spec-service/src/draft-screen-spec.mjs <wireframeKey> <screenId> --verify
//
// --verify는 이미 등록된 screen.json과 대조해 추출 정확도를 표로 보여준다.
// --scope는 이 화면이 쓸 stateScopeKey다. 같은 스코프에 등록된 다른 화면의
// 필드를 선례로 삼아 fieldKey와 데이터 계약을 확정한다.
import { readdir, readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  compareWithSpec,
  draftScreenElements
} from "../../../packages/contracts/src/screen-draft.mjs";
import { collectFieldPrecedents } from "../../../packages/contracts/src/spec-precedent.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

// 선례는 **다른** 화면에서만 모은다. 대상 화면 자신을 넣으면 스스로를
// 근거로 삼아 질문이 사라지는 착시가 생긴다.
async function loadPrecedentScreens(screensDir, exceptScreenId) {
  const dirents = await readdir(screensDir, { withFileTypes: true });
  const screens = [];
  for (const dirent of dirents) {
    if (!dirent.isDirectory() || dirent.name === exceptScreenId) {
      continue;
    }
    try {
      screens.push(await readJson(join(screensDir, dirent.name, "screen.json")));
    } catch {
      continue; // 아직 등록되지 않은 화면
    }
  }
  return screens;
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

  const screensDir = join(repoRoot, "specs", "figma", wireframeKey, "screens");
  const screenDir = join(screensDir, screenId);
  const design = await readJson(join(screenDir, "figma.design.json"));

  const flagIndex = flags.indexOf("--scope");
  const stateScopeKey =
    (flagIndex >= 0 ? flags[flagIndex + 1] : undefined) ??
    // 이미 등록된 화면이면(--verify 등) 그 화면이 선언한 스코프를 쓴다.
    (await readJson(join(screenDir, "screen.json"))
      .then((spec) => spec.stateScopeKey)
      .catch(() => undefined));

  const precedents = collectFieldPrecedents(await loadPrecedentScreens(screensDir, screenId));
  // 셸은 화면의 요소가 아니다. 어느 노드가 셸인지는 wireframe이 안다.
  const excludeNodeNames = await readJson(join(screensDir, "..", "shell.json"))
    .then((shell) => shell.design?.excludeNodeNames)
    .catch(() => undefined);
  const { elements, questions } = draftScreenElements(design, {
    precedents,
    stateScopeKey,
    excludeNodeNames
  });

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
  process.stderr.write(
    stateScopeKey
      ? `\n선례 ${precedents.entries.length}건을 스코프 '${stateScopeKey}'로 대조했습니다.\n`
      : "\n스코프를 주지 않아 선례를 확정에 쓰지 않았습니다(--scope <키>)."
  );
  process.stderr.write(`사람이 답해야 할 것 ${questions.length}건:\n`);
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
