import assert from "node:assert/strict";
import test from "node:test";

import {
  createScreenSource,
  getScreenCandidate,
  getSelectionScope,
  registerActiveScreen,
  restoreScreenContext,
  suggestScreenId
} from "../apps/figma-plugin/src/screen-context.mjs";

function createPluginDataNode(properties) {
  const pluginData = new Map();

  return {
    ...properties,
    getPluginData(key) {
      return pluginData.get(key) ?? "";
    },
    setPluginData(key, value) {
      if (value === "") {
        pluginData.delete(key);
        return;
      }

      pluginData.set(key, value);
    }
  };
}

function createScreenTree() {
  const root = createPluginDataNode({
    id: "0:0",
    name: "와이어프레임",
    type: "DOCUMENT",
    parent: null
  });
  const page = {
    id: "0:1",
    name: "Wireframe",
    type: "PAGE",
    parent: root
  };
  const screen = createPluginDataNode({
    id: "3:2",
    name: "온보딩 · ONB-01 · 본인 소속 입력",
    type: "FRAME",
    parent: page
  });

  return { root, page, screen };
}

test("화면 노드 이름에서 screenId 후보를 제안한다", () => {
  assert.equal(
    suggestScreenId("온보딩 · ONB-01 · 본인 소속 입력"),
    "ONB-01"
  );
  assert.equal(suggestScreenId("학생회 생성 · ORG-01 · 새 학생회 생성"), "ORG-01");
  assert.equal(suggestScreenId("이름에 식별자가 없는 화면"), "");
});

test("선택한 화면에서 자동 수집할 source를 만든다", () => {
  const { screen } = createScreenTree();

  assert.deepEqual(createScreenSource(screen), {
    pageName: "Wireframe",
    nodeId: "3:2",
    nodeName: "온보딩 · ONB-01 · 본인 소속 입력",
    nodeType: "FRAME"
  });
});

test("선택 노드를 현재 화면 자체, 내부, 외부로 구분한다", () => {
  const { page, screen } = createScreenTree();
  const input = { id: "3:8", name: "Text Input", type: "FRAME", parent: screen };
  const inputText = { id: "3:9", name: "김바다", type: "TEXT", parent: input };
  const otherScreen = {
    id: "4:2",
    name: "다음 화면",
    type: "FRAME",
    parent: page
  };

  assert.equal(getSelectionScope(null, screen), "none");
  assert.equal(getSelectionScope(screen, screen), "screen");
  assert.equal(getSelectionScope(inputText, screen), "inside");
  assert.equal(getSelectionScope(otherScreen, screen), "outside");
  assert.equal(getSelectionScope(input, null), "no-active-screen");
});

test("현재 화면이 없거나 다른 FRAME을 선택했을 때만 화면 후보를 만든다", () => {
  const { page, screen } = createScreenTree();
  const input = { id: "3:8", name: "Text Input", type: "FRAME", parent: screen };
  const nextScreen = createPluginDataNode({
    id: "4:2",
    name: "학생회 생성 · ORG-01 · 새 학생회 생성",
    type: "FRAME",
    parent: page
  });

  assert.deepEqual(getScreenCandidate(screen, "no-active-screen"), {
    source: {
      pageName: "Wireframe",
      nodeId: "3:2",
      nodeName: "온보딩 · ONB-01 · 본인 소속 입력",
      nodeType: "FRAME"
    },
    suggestedScreenId: "ONB-01"
  });
  assert.equal(getScreenCandidate(screen, "screen"), null);
  assert.equal(getScreenCandidate(input, "inside"), null);
  assert.deepEqual(getScreenCandidate(nextScreen, "outside"), {
    source: {
      pageName: "Wireframe",
      nodeId: "4:2",
      nodeName: "학생회 생성 · ORG-01 · 새 학생회 생성",
      nodeType: "FRAME"
    },
    suggestedScreenId: "ORG-01"
  });
});

test("Figma 문서와 화면 pluginData에 저장한 현재 화면을 재실행 시 복원한다", async () => {
  const { root, screen } = createScreenTree();

  registerActiveScreen({
    root,
    screenNode: screen,
    wireframeKey: "vada-onboarding",
    screenId: "ONB-01"
  });

  const restored = await restoreScreenContext({
    root,
    getNodeByIdAsync: async (nodeId) => (nodeId === screen.id ? screen : null)
  });

  assert.equal(restored.wireframeKey, "vada-onboarding");
  assert.equal(restored.activeScreenNode, screen);
  assert.deepEqual(restored.activeScreen, {
    screenId: "ONB-01",
    source: {
      pageName: "Wireframe",
      nodeId: "3:2",
      nodeName: "온보딩 · ONB-01 · 본인 소속 입력",
      nodeType: "FRAME"
    }
  });
});
