import assert from "node:assert/strict";
import test from "node:test";

import {
  conflictsWithScreenFolder,
  knownNodeIdOf,
  screenFolderConflictMessage
} from "../packages/contracts/src/screen-folder-identity.mjs";
import {
  frameNameIsScreen,
  screenIdFromFrameName
} from "../packages/contracts/src/screen-naming.mjs";

test("화면 이름이 말하는 screenId를 읽는다", () => {
  assert.equal(
    screenIdFromFrameName("운영 — 행사 · EVT-00A · 행사 목록 — 일반 구성원"),
    "EVT-00A"
  );
  assert.equal(
    screenIdFromFrameName("운영 — 회의 · 확인 상태 · OPS-MEET-D01 · 회의 시작 확인"),
    "OPS-MEET-D01"
  );
  // 식별자 칸이 없는 이름은 화면이 아니다(구역·컴포넌트 프레임).
  assert.equal(screenIdFromFrameName("VADA Components · Phase 3 Domain & Patterns"), null);
  assert.equal(screenIdFromFrameName("Sidebar"), null);
  assert.equal(screenIdFromFrameName(undefined), null);
});

test("비슷한 이름을 집지 않는다", () => {
  // 'EVT-00'이 'EVT-00A'를 집으면 다른 화면의 원본을 그 폴더에 쏟는다.
  const name = "운영 — 행사 · EVT-00A · 행사 목록 — 일반 구성원";
  assert.equal(frameNameIsScreen(name, "EVT-00A"), true);
  assert.equal(frameNameIsScreen(name, "EVT-00"), false);
  assert.equal(frameNameIsScreen(name, "EVT-00A2"), false);
});

test("폴더 신원 계약: 다른 노드의 산출물을 덮어쓰지 않는다", () => {
  // 원본이 먼저다. 원본이 없으면 명세를 본다.
  assert.equal(knownNodeIdOf({ raw: { document: { id: "20:4058" } }, screen: null }), "20:4058");
  assert.equal(knownNodeIdOf({ raw: null, screen: { source: { nodeId: "18:331" } } }), "18:331");
  assert.equal(knownNodeIdOf({ raw: null, screen: null }), null);

  assert.equal(conflictsWithScreenFolder("20:4058", "18:331"), true);
  // 같은 노드의 재저장(디자인을 고친 뒤 다시 받기)은 정상이다.
  assert.equal(conflictsWithScreenFolder("20:4058", "20:4058"), false);
  // 빈 폴더는 아무 노드나 받는다.
  assert.equal(conflictsWithScreenFolder(null, "20:4058"), false);
  // 받을 노드를 모르면 판정할 것이 없다.
  assert.equal(conflictsWithScreenFolder("20:4058", ""), false);

  const message = screenFolderConflictMessage({
    screenId: "EVT-00A",
    knownNodeId: "20:4058",
    incomingNodeId: "18:331"
  });
  assert.match(message, /20:4058/);
  assert.match(message, /18:331/);
});

test("저장된 화면의 폴더 이름과 design의 이름이 말하는 screenId를 견준다", async () => {
  // 둘이 갈리면 이름으로 화면을 찾는 길이 막히고, 사람도 헷갈린다.
  // 지금 하나가 어긋나 있다(TASK-01 폴더에 든 18:2의 이름은 OPS-TASK-01이다).
  // 고치려면 폴더·라우터·테스트·e2e·주소가 함께 바뀌므로 BACKLOG에 트리거로 뒀다.
  const { readdir, readFile } = await import("node:fs/promises");
  const { join, dirname } = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const screensDir = join(
    dirname(fileURLToPath(import.meta.url)),
    "..",
    "specs",
    "figma",
    "vada-wireframe",
    "screens"
  );

  const drifted = [];
  for (const entry of await readdir(screensDir)) {
    const spec = JSON.parse(
      await readFile(join(screensDir, entry, "screen.json"), "utf8")
    );
    const fromName = screenIdFromFrameName(spec.source?.name);
    if (fromName !== null && fromName !== spec.screenId) {
      drifted.push(`${spec.screenId} ← design은 ${fromName}`);
    }
  }

  assert.deepEqual(
    drifted,
    ["TASK-01 ← design은 OPS-TASK-01"],
    "폴더 이름과 design의 screenId가 갈린 화면이 늘거나 줄었습니다. 늘었으면 고치고, 줄였으면 이 기대값을 고치세요."
  );
});

test("tests 폴더의 검사 파일은 정확히 한 앱이 돌린다", async () => {
  // 두 앱이 같은 폴더를 나눠 돌린다. 목록이 손으로 적혀 있어, 새 파일을 어느 쪽에도
  // 넣지 않으면 **검사가 있는데 아무도 안 돌린다**(figma-fetch.test.mjs가 실제로
  // 그랬다). 준수 검사가 세 화면만 보고 있던 것과 같은 함정이다.
  const { readdir, readFile } = await import("node:fs/promises");
  const { join, dirname } = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

  const files = (await readdir(join(repoRoot, "tests"))).filter((name) =>
    name.endsWith(".test.mjs")
  );
  const scripts = await Promise.all(
    ["apps/figma-plugin", "apps/spec-service"].map(async (app) =>
      JSON.parse(await readFile(join(repoRoot, app, "package.json"), "utf8")).scripts.test
    )
  );

  const unclaimed = files.filter((name) => !scripts.some((script) => script.includes(name)));
  assert.deepEqual(unclaimed, [], "어느 앱도 돌리지 않는 검사 파일이 있습니다");

  const twice = files.filter(
    (name) => scripts.filter((script) => script.includes(name)).length > 1
  );
  assert.deepEqual(twice, [], "두 앱이 같은 검사 파일을 겹쳐 돌립니다");

  // 목록에만 있고 파일이 없는 것도 잡는다 — node --test는 조용히 넘어간다.
  for (const script of scripts) {
    for (const token of script.split(/\s+/).filter((part) => part.endsWith(".test.mjs"))) {
      const name = token.replace(/^.*\//, "");
      assert.ok(files.includes(name), `검사 목록에 없는 파일이 적혀 있습니다: ${name}`);
    }
  }
});
