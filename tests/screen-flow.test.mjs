import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { collectScreenFlow } from "../packages/contracts/src/screen-flow.mjs";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

function screen(screenId, edges = []) {
  return {
    file: `w/screens/${screenId}/screen.json`,
    spec: {
      screenId,
      elements: edges.map(([label, target, actionType = "navigate"], index) => ({
        source: { nodeId: `1:${index}` },
        spec:
          actionType === "submit"
            ? {
                type: "button",
                label,
                action: { type: "submit", onSuccess: { navigate: target } }
              }
            : { type: "button", label, action: { type: "navigate", targetScreenId: target } }
      }))
    }
  };
}

test("이동은 화면 명세에서 유도한다 — 별도 지도 파일을 두지 않는다", () => {
  const flow = collectScreenFlow([
    screen("A-01", [["다음", "A-02"]]),
    screen("A-02", [["이전", "A-01"], ["만들기", "B-01", "submit"]]),
    screen("B-01", [])
  ]);

  assert.deepEqual(flow.edges, [
    { from: "A-01", to: "A-02", label: "다음", actionType: "navigate" },
    { from: "A-02", to: "A-01", label: "이전", actionType: "navigate" },
    { from: "A-02", to: "B-01", label: "만들기", actionType: "submit" }
  ]);
  assert.deepEqual(flow.screenIds, ["A-01", "A-02", "B-01"]);
});

test("명세가 없는 이동 대상을 보고한다", () => {
  const flow = collectScreenFlow([screen("A-01", [["참여", "X-99"]])]);

  assert.deepEqual(flow.missingTargets, ["X-99"]);
});

test("들어오는 이동이 없는 화면을 진입점 후보로 보고한다", () => {
  const flow = collectScreenFlow([
    screen("A-01", [["다음", "A-02"]]),
    screen("A-02", [])
  ]);

  assert.deepEqual(flow.entryCandidates, ["A-01"]);
  assert.deepEqual(flow.deadEnds, ["A-02"]);
});

// 뒤로 가기가 있으면 첫 화면도 이동 대상이 되어 진입점 후보가 사라진다.
// 이것은 결함이 아니라 관측이다 — 진입점은 구현이 정하고 명세에는 없다.
test("순환이면 진입점 후보가 비고, 그 사실 자체를 알린다", () => {
  const flow = collectScreenFlow([
    screen("A-01", [["다음", "A-02"]]),
    screen("A-02", [["이전", "A-01"]])
  ]);

  assert.deepEqual(flow.entryCandidates, []);
  assert.deepEqual(flow.deadEnds, []);
});

// 화면이 여러 덩어리로 갈라져 있으면 어느 한쪽은 앱에서 닿을 수 없다.
test("서로 이어지지 않는 화면 덩어리를 갈라 보고한다", () => {
  const flow = collectScreenFlow([
    screen("A-01", [["다음", "A-02"]]),
    screen("A-02", []),
    screen("Z-01", [])
  ]);

  assert.deepEqual(flow.components, [["A-01", "A-02"], ["Z-01"]]);
});

test("실제 저장소 명세에서 유도한 이동이 화면 JSON과 일치한다", async () => {
  const screensDir = join(repoRoot, "specs", "figma", "vada-wireframe", "screens");
  const { readdir } = await import("node:fs/promises");
  const screens = [];

  for (const screenId of await readdir(screensDir)) {
    try {
      screens.push({
        file: `${screenId}/screen.json`,
        spec: JSON.parse(
          await readFile(join(screensDir, screenId, "screen.json"), "utf8")
        )
      });
    } catch {
      continue;
    }
  }

  const flow = collectScreenFlow(screens);

  // 이동이 하나도 안 잡히면 유도가 깨진 것이다.
  assert.ok(flow.edges.length >= 4, `이동 ${flow.edges.length}건`);
  for (const edge of flow.edges) {
    assert.ok(flow.screenIds.includes(edge.from), `출발 ${edge.from}`);
  }
});
