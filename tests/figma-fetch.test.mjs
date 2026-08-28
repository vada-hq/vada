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

  // **원본을 본다. 명세가 아니다.** 이 물음은 명세가 없어도 답할 수 있고,
  // 그래야 **받자마자** 잡힌다. 회의 프레임 16개를 미리 받아 두면서 명세 없는
  // 폴더가 처음 생겼고, 그때 이 검사가 screen.json을 찾다 터졌다 — 검사가
  // 묻던 것보다 좁은 것에 매여 있었다.
  const drifted = [];
  for (const entry of await readdir(screensDir)) {
    const design = JSON.parse(
      await readFile(join(screensDir, entry, "figma.design.json"), "utf8")
    );
    const fromName = screenIdFromFrameName(design.root?.name);
    if (fromName !== null && fromName !== entry) {
      drifted.push(`${entry} ← design은 ${fromName}`);
    }
  }

  assert.deepEqual(
    drifted,
    ["TASK-01 ← design은 OPS-TASK-01"],
    "폴더 이름과 design의 screenId가 갈린 화면이 늘거나 줄었습니다. 늘었으면 고치고, 줄였으면 이 기대값을 고치세요."
  );
});

test("tests 폴더의 검사 파일은 손 목록이 아니라 글로브로 돌린다", async () => {
  // 한동안 목록이 손으로 적혀 있었고, 새 파일을 넣지 않으면 **검사가 있는데
  // 아무도 안 돌았다**(figma-fetch.test.mjs가 실제로 그랬다). 그때는 목록이
  // 빠짐없는지를 이 검사가 지켰다.
  //
  // 지금은 글로브라 **빠질 수가 없다.** 구조로 못 하게 만드는 것이 검사로 막는
  // 것보다 낫다 - 검사는 잊을 수 있지만 구조는 잊을 수 없다. 그래서 이 검사에
  // 남은 일은 하나다: **손 목록으로 되돌아가지 못하게 한다.**
  const { readdir, readFile } = await import("node:fs/promises");
  const { join, dirname } = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

  const script = JSON.parse(
    await readFile(join(repoRoot, "apps/spec-service/package.json"), "utf8")
  ).scripts.test;

  assert.ok(
    script.includes("*.test.mjs"),
    `검사를 손 목록으로 돌리고 있습니다: ${script}`
  );

  // 글로브가 실제로 이 폴더를 가리키는지. 다른 폴더를 가리키면 하나도 안 돈다.
  const files = (await readdir(join(repoRoot, "tests"))).filter((name) =>
    name.endsWith(".test.mjs")
  );
  assert.ok(files.length > 0, "tests 폴더에 검사 파일이 없습니다");
  assert.ok(
    script.includes("tests/"),
    `글로브가 tests 폴더를 가리키지 않습니다: ${script}`
  );
});
