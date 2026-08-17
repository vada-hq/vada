import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  SCREEN_SPEC_PLUGIN_DATA_KEY,
  SCREEN_SPEC_SHARED_PLUGIN_DATA_KEY,
  SCREEN_SPEC_SHARED_PLUGIN_DATA_NAMESPACE,
  createDraftsFromScreenSpec,
  flattenElementSpec,
  formatScreenSpecJson,
  getScreenSpecFileName,
  prepareImportedScreenSpec,
  restoreScreenSpec,
  saveScreenSpec,
  serializeElementSpec
} from "../apps/figma-plugin/src/screen-spec.mjs";

async function readSchema(fileName) {
  return JSON.parse(
    await readFile(
      new URL(`../packages/contracts/schemas/${fileName}`, import.meta.url),
      "utf8"
    )
  );
}

function createPluginNode({ id, name, type, parent = null }) {
  const pluginData = new Map();
  const sharedPluginData = new Map();

  function getSharedKey(namespace, key) {
    return `${namespace}:${key}`;
  }

  return {
    id,
    name,
    type,
    parent,
    getPluginData(key) {
      return pluginData.get(key) ?? "";
    },
    setPluginData(key, value) {
      pluginData.set(key, value);
    },
    getSharedPluginData(namespace, key) {
      return sharedPluginData.get(getSharedKey(namespace, key)) ?? "";
    },
    setSharedPluginData(namespace, key, value) {
      sharedPluginData.set(getSharedKey(namespace, key), value);
    }
  };
}

test("공유 화면 spec namespace는 Figma 호환 영숫자로 구성한다", () => {
  assert.match(
    SCREEN_SPEC_SHARED_PLUGIN_DATA_NAMESPACE,
    /^[A-Za-z0-9]{3,}$/
  );
});

test("로컬 화면 초안은 현재 화면 내부의 지원 요소만 받아들인다", async () => {
  const page = createPluginNode({ id: "0:1", name: "Wireframe", type: "PAGE" });
  const screenNode = createPluginNode({
    id: "10:2",
    name: "온보딩 · ONB-02 · 시작 방식 선택",
    type: "FRAME",
    parent: page
  });
  const buttonNode = createPluginNode({
    id: "14:111",
    name: "Button",
    type: "FRAME",
    parent: screenNode
  });
  const buttonSchema = await readSchema("button.schema.json");
  const screenSpec = {
    schemaVersion: 1,
    screenId: "ONB-02",
    stateScopeKey: "onboardingDraft",
    source: { nodeId: "10:2" },
    elements: [
      {
        source: { nodeId: "14:111" },
        spec: { type: "button", label: "새 학생회 만들기" }
      }
    ]
  };

  assert.deepEqual(
    await prepareImportedScreenSpec({
      getNodeByIdAsync: async (nodeId) =>
        nodeId === buttonNode.id ? buttonNode : null,
      schemaByType: { button: buttonSchema },
      screenId: "ONB-02",
      screenNode,
      screenSpec
    }),
    screenSpec
  );
});

test("화면 상태 스코프 key는 선택 사항이지만 지정하면 유효한 식별자여야 한다", async () => {
  const screenNode = createPluginNode({
    id: "10:2",
    name: "온보딩 · ONB-02 · 시작 방식 선택",
    type: "FRAME"
  });
  const baseSpec = {
    schemaVersion: 1,
    screenId: "ONB-02",
    source: { nodeId: "10:2" },
    elements: []
  };

  assert.deepEqual(
    await prepareImportedScreenSpec({
      getNodeByIdAsync: async () => null,
      schemaByType: {},
      screenId: "ONB-02",
      screenNode,
      screenSpec: {
        ...baseSpec,
        stateScopeKey: "onboardingDraft"
      }
    }),
    {
      ...baseSpec,
      stateScopeKey: "onboardingDraft"
    }
  );

  await assert.rejects(
    prepareImportedScreenSpec({
      getNodeByIdAsync: async () => null,
      schemaByType: {},
      screenId: "ONB-02",
      screenNode,
      screenSpec: { ...baseSpec, stateScopeKey: "" }
    }),
    /stateScopeKey/
  );
});

test("다른 화면이나 화면 밖 요소가 들어간 로컬 초안은 거부한다", async () => {
  const page = createPluginNode({ id: "0:1", name: "Wireframe", type: "PAGE" });
  const screenNode = createPluginNode({
    id: "10:2",
    name: "온보딩 · ONB-02 · 시작 방식 선택",
    type: "FRAME",
    parent: page
  });
  const outsideNode = createPluginNode({
    id: "99:1",
    name: "Outside",
    type: "FRAME",
    parent: page
  });
  const buttonSchema = await readSchema("button.schema.json");

  await assert.rejects(
    prepareImportedScreenSpec({
      getNodeByIdAsync: async () => outsideNode,
      schemaByType: { button: buttonSchema },
      screenId: "ONB-02",
      screenNode,
      screenSpec: {
        schemaVersion: 1,
        screenId: "ONB-02",
        source: { nodeId: "10:2" },
        elements: [
          {
            source: { nodeId: "99:1" },
            spec: { type: "button" }
          }
        ]
      }
    }),
    /현재 작업 화면 내부에 있지 않습니다/
  );

  await assert.rejects(
    prepareImportedScreenSpec({
      getNodeByIdAsync: async () => null,
      schemaByType: { button: buttonSchema },
      screenId: "ONB-02",
      screenNode,
      screenSpec: {
        schemaVersion: 1,
        screenId: "OTHER",
        source: { nodeId: "10:2" },
        elements: []
      }
    }),
    /screenId가 현재 작업 화면과 일치하지 않습니다/
  );
});

test("요소 초안을 스키마의 실제 JSON 타입과 중첩 구조로 변환한다", async () => {
  const inputSchema = await readSchema("input.schema.json");
  const buttonSchema = await readSchema("button.schema.json");

  assert.deepEqual(
    serializeElementSpec(inputSchema, {
      fieldKey: "name",
      label: "이름",
      placeholder: "",
      initialValue: "",
      inputType: "text",
      valueType: "string",
      required: "true",
      validation: "[]"
    }),
    {
      type: "input",
      fieldKey: "name",
      label: "이름",
      placeholder: null,
      initialValue: null,
      inputType: "text",
      valueType: "string",
      required: true,
      validation: []
    }
  );

  assert.deepEqual(
    serializeElementSpec(buttonSchema, {
      label: "다음: 시작 방식 선택",
      initiallyDisabled: "false",
      "action.targetScreenId": "ONB-02"
    }),
    {
      type: "button",
      label: "다음: 시작 방식 선택",
      initiallyDisabled: false,
      action: {
        type: "navigate",
        targetScreenId: "ONB-02",
        executeWhen: {
          type: "allRequiredFieldsHaveValue",
          scope: "screen"
        },
        onExecutionBlocked: {
          type: "showMissingRequiredFields",
          focus: "firstMissingField"
        }
      }
    }
  );
});

test("선택 요소의 옵션 출처와 활성화 조건 배열을 저장하고 복원한다", async () => {
  const selectSchema = await readSchema("select.schema.json");
  const values = {
    fieldKey: "college",
    label: "단과대학",
    placeholder: "학교를 먼저 선택하세요",
    initialValue: "",
    valueType: "string",
    required: "true",
    initiallyDisabled: "true",
    searchable: "true",
    "optionsSource.key": "education.colleges",
    "optionsSource.params": '{"schoolId":"school"}',
    enabledWhen: '[{"fieldKey":"school","operator":"hasValue"}]',
    resetOnChangeOf: '["school"]'
  };
  const spec = {
    type: "select",
    fieldKey: "college",
    label: "단과대학",
    placeholder: "학교를 먼저 선택하세요",
    initialValue: null,
    valueType: "string",
    required: true,
    initiallyDisabled: true,
    searchable: true,
    optionsSource: {
      key: "education.colleges",
      params: {
        schoolId: "school"
      }
    },
    enabledWhen: [
      {
        fieldKey: "school",
        operator: "hasValue"
      }
    ],
    resetOnChangeOf: ["school"]
  };

  assert.deepEqual(serializeElementSpec(selectSchema, values), spec);
  assert.deepEqual(flattenElementSpec(selectSchema, spec), values);
});

test("enabledWhen을 입력하지 않은 선택 요소는 조건 필드를 생략한다", async () => {
  const selectSchema = await readSchema("select.schema.json");

  assert.deepEqual(
    serializeElementSpec(selectSchema, {
      fieldKey: "school",
      label: "학교",
      placeholder: "학교명을 검색하세요",
      initialValue: "",
      valueType: "string",
      required: "true",
      initiallyDisabled: "false",
      searchable: "true",
      "optionsSource.key": "education.schools",
      "optionsSource.params": "",
      enabledWhen: "",
      resetOnChangeOf: ""
    }),
    {
      type: "select",
      fieldKey: "school",
      label: "학교",
      placeholder: "학교명을 검색하세요",
      initialValue: null,
      valueType: "string",
      required: true,
      initiallyDisabled: false,
      searchable: true,
      optionsSource: {
        key: "education.schools"
      }
    }
  );
});

test("화면별 pluginData에 source와 등록 요소를 하나의 화면 JSON으로 저장한다", async () => {
  const inputSchema = await readSchema("input.schema.json");
  const buttonSchema = await readSchema("button.schema.json");
  const page = { type: "PAGE", name: "Wireframe", parent: null };
  const screenNode = createPluginNode({
    id: "3:2",
    name: "온보딩 · ONB-01 · 본인 소속 입력",
    type: "FRAME",
    parent: page
  });
  const inputNode = createPluginNode({
    id: "7:29",
    name: "Text Input",
    type: "FRAME",
    parent: screenNode
  });
  const buttonNode = createPluginNode({
    id: "7:77",
    name: "Btn",
    type: "FRAME",
    parent: screenNode
  });
  const nodesById = new Map([
    [inputNode.id, inputNode],
    [buttonNode.id, buttonNode]
  ]);

  const screenSpec = await saveScreenSpec({
    screenNode,
    screenId: "ONB-01",
    stateScopeKey: "onboardingDraft",
    drafts: [
      {
        nodeId: inputNode.id,
        elementType: "input",
        values: {
          fieldKey: "name",
          label: "이름",
          placeholder: "김바다",
          initialValue: "",
          inputType: "text",
          valueType: "string",
          required: "true",
          validation: "[]"
        }
      },
      {
        nodeId: buttonNode.id,
        elementType: "button",
        values: {
          label: "다음: 시작 방식 선택",
          initiallyDisabled: "false",
          "action.targetScreenId": "ONB-02"
        }
      }
    ],
    schemaByType: {
      input: inputSchema,
      button: buttonSchema
    },
    getNodeByIdAsync: async (nodeId) => nodesById.get(nodeId) ?? null
  });

  assert.deepEqual(screenSpec, {
    schemaVersion: 1,
    screenId: "ONB-01",
    stateScopeKey: "onboardingDraft",
    source: {
      pageName: "Wireframe",
      nodeId: "3:2",
      name: "온보딩 · ONB-01 · 본인 소속 입력",
      figmaType: "FRAME"
    },
    elements: [
      {
        source: {
          nodeId: "7:29",
          name: "Text Input",
          figmaType: "FRAME"
        },
        spec: {
          type: "input",
          fieldKey: "name",
          label: "이름",
          placeholder: "김바다",
          initialValue: null,
          inputType: "text",
          valueType: "string",
          required: true,
          validation: []
        }
      },
      {
        source: {
          nodeId: "7:77",
          name: "Btn",
          figmaType: "FRAME"
        },
        spec: {
          type: "button",
          label: "다음: 시작 방식 선택",
          initiallyDisabled: false,
          action: {
            type: "navigate",
            targetScreenId: "ONB-02",
            executeWhen: {
              type: "allRequiredFieldsHaveValue",
              scope: "screen"
            },
            onExecutionBlocked: {
              type: "showMissingRequiredFields",
              focus: "firstMissingField"
            }
          }
        }
      }
    ]
  });
  assert.equal("wireframeKey" in screenSpec, false);
  assert.deepEqual(
    JSON.parse(screenNode.getPluginData(SCREEN_SPEC_PLUGIN_DATA_KEY)),
    screenSpec
  );
  assert.deepEqual(
    JSON.parse(
      screenNode.getSharedPluginData(
        SCREEN_SPEC_SHARED_PLUGIN_DATA_NAMESPACE,
        SCREEN_SPEC_SHARED_PLUGIN_DATA_KEY
      )
    ),
    screenSpec
  );
  assert.deepEqual(restoreScreenSpec(screenNode), screenSpec);

  const otherScreen = createPluginNode({
    id: "11:2",
    name: "학생회 생성 · ORG-01 · 새 학생회 생성",
    type: "FRAME",
    parent: page
  });
  assert.equal(restoreScreenSpec(otherScreen), null);
});

test("기존 비공개 화면 spec을 복원하면서 sharedPluginData로 이전한다", () => {
  const screenNode = createPluginNode({
    id: "3:2",
    name: "온보딩 · ONB-01 · 본인 소속 입력",
    type: "FRAME"
  });
  const legacySpec = {
    schemaVersion: 1,
    screenId: "ONB-01",
    source: { nodeId: "3:2" },
    elements: []
  };

  screenNode.setPluginData(
    SCREEN_SPEC_PLUGIN_DATA_KEY,
    JSON.stringify(legacySpec)
  );

  assert.deepEqual(restoreScreenSpec(screenNode), legacySpec);
  assert.deepEqual(
    JSON.parse(
      screenNode.getSharedPluginData(
        SCREEN_SPEC_SHARED_PLUGIN_DATA_NAMESPACE,
        SCREEN_SPEC_SHARED_PLUGIN_DATA_KEY
      )
    ),
    legacySpec
  );
});

test("공유 데이터 이전이 실패해도 기존 비공개 화면 spec 복원은 막지 않는다", () => {
  const screenNode = createPluginNode({
    id: "3:2",
    name: "온보딩 · ONB-01 · 본인 소속 입력",
    type: "FRAME"
  });
  const legacySpec = {
    schemaVersion: 1,
    screenId: "ONB-01",
    source: { nodeId: "3:2" },
    elements: []
  };

  screenNode.setPluginData(
    SCREEN_SPEC_PLUGIN_DATA_KEY,
    JSON.stringify(legacySpec)
  );
  screenNode.setSharedPluginData = () => {
    throw new Error("sharedPluginData write failed");
  };

  assert.doesNotThrow(() => restoreScreenSpec(screenNode));
  assert.deepEqual(restoreScreenSpec(screenNode), legacySpec);
});

test("공유 데이터 조회가 실패해도 기존 비공개 화면 spec을 복원한다", () => {
  const screenNode = createPluginNode({
    id: "3:2",
    name: "온보딩 · ONB-01 · 본인 소속 입력",
    type: "FRAME"
  });
  const legacySpec = {
    schemaVersion: 1,
    screenId: "ONB-01",
    source: { nodeId: "3:2" },
    elements: []
  };

  screenNode.setPluginData(
    SCREEN_SPEC_PLUGIN_DATA_KEY,
    JSON.stringify(legacySpec)
  );
  screenNode.getSharedPluginData = () => {
    throw new Error("sharedPluginData read failed");
  };

  assert.doesNotThrow(() => restoreScreenSpec(screenNode));
  assert.deepEqual(restoreScreenSpec(screenNode), legacySpec);
});

test("AI가 갱신한 sharedPluginData를 우선 복원하고 비공개 사본도 맞춘다", () => {
  const screenNode = createPluginNode({
    id: "10:2",
    name: "온보딩 · ONB-02 · 시작 방식 선택",
    type: "FRAME"
  });
  const previousSpec = {
    schemaVersion: 1,
    screenId: "ONB-02",
    source: { nodeId: "10:2" },
    elements: []
  };
  const sharedSpec = {
    ...previousSpec,
    elements: [
      {
        source: { nodeId: "14:111", name: "Button", figmaType: "FRAME" },
        spec: {
          type: "button",
          label: "새 학생회 만들기",
          initiallyDisabled: false,
          action: {
            type: "navigate",
            targetScreenId: "ORG-01",
            executeWhen: { type: "allRequiredFieldsHaveValue" }
          }
        }
      }
    ]
  };

  screenNode.setPluginData(
    SCREEN_SPEC_PLUGIN_DATA_KEY,
    JSON.stringify(previousSpec)
  );
  screenNode.setSharedPluginData(
    SCREEN_SPEC_SHARED_PLUGIN_DATA_NAMESPACE,
    SCREEN_SPEC_SHARED_PLUGIN_DATA_KEY,
    JSON.stringify(sharedSpec)
  );

  assert.deepEqual(restoreScreenSpec(screenNode), sharedSpec);
  assert.deepEqual(
    JSON.parse(screenNode.getPluginData(SCREEN_SPEC_PLUGIN_DATA_KEY)),
    sharedSpec
  );
});

test("저장된 요소 spec을 UI 초안 값으로 다시 펼친다", async () => {
  const buttonSchema = await readSchema("button.schema.json");

  assert.deepEqual(
    flattenElementSpec(buttonSchema, {
      type: "button",
      label: "다음: 시작 방식 선택",
      initiallyDisabled: false,
      action: {
        type: "navigate",
        targetScreenId: "ONB-02",
        executeWhen: {
          type: "allRequiredFieldsHaveValue"
        }
      }
    }),
    {
      label: "다음: 시작 방식 선택",
      initiallyDisabled: "false",
      "action.targetScreenId": "ONB-02",
      "action.executeWhen": "present",
      "action.onExecutionBlocked": ""
    }
  );
});

test("실행 조건 없는 버튼은 부재 마커로 왕복 보존한다", async () => {
  const buttonSchema = await readSchema("button.schema.json");
  const spec = {
    type: "button",
    label: "이전으로",
    initiallyDisabled: false,
    action: {
      type: "navigate",
      targetScreenId: "ONB-01"
    }
  };

  const values = flattenElementSpec(buttonSchema, spec);
  assert.equal(values["action.executeWhen"], "");
  assert.equal(values["action.onExecutionBlocked"], "");
  assert.deepEqual(serializeElementSpec(buttonSchema, values), spec);
});

test("저장된 화면 요소를 nodeId별 UI 초안 목록으로 복원한다", async () => {
  const buttonSchema = await readSchema("button.schema.json");
  const screenSpec = {
    schemaVersion: 1,
    screenId: "ONB-01",
    source: {},
    elements: [
      {
        source: { nodeId: "7:77", name: "Btn", figmaType: "FRAME" },
        spec: {
          type: "button",
          label: "다음: 시작 방식 선택",
          initiallyDisabled: false,
          action: {
            type: "navigate",
            targetScreenId: "ONB-02",
            executeWhen: {
              type: "allRequiredFieldsHaveValue"
            }
          }
        }
      }
    ]
  };

  assert.deepEqual(
    createDraftsFromScreenSpec(screenSpec, { button: buttonSchema }),
    [
      {
        nodeId: "7:77",
        elementType: "button",
        values: {
          label: "다음: 시작 방식 선택",
          initiallyDisabled: "false",
          "action.targetScreenId": "ONB-02",
          "action.executeWhen": "present",
          "action.onExecutionBlocked": ""
        }
      }
    ]
  );
});

test("화면 저장은 화면 meta를 보존하고 없으면 생략한다", async () => {
  const page = { type: "PAGE", name: "Wireframe", parent: null };
  const screenNode = createPluginNode({
    id: "3:2",
    name: "온보딩 · ONB-01 · 본인 소속 입력",
    type: "FRAME",
    parent: page
  });
  const meta = {
    title: "내 프로필에 표시될 학적 정보를 입력해 주세요",
    description: "학생회 활동에 사용할 내 프로필 정보입니다.",
    footerNote: null
  };

  const withMeta = await saveScreenSpec({
    screenNode,
    screenId: "ONB-01",
    stateScopeKey: "onboardingDraft",
    meta,
    drafts: [],
    schemaByType: {},
    getNodeByIdAsync: async () => null
  });
  assert.deepEqual(withMeta.meta, meta);
  assert.deepEqual(JSON.parse(screenNode.getPluginData("screen-spec")).meta, meta);

  const withoutMeta = await saveScreenSpec({
    screenNode,
    screenId: "ONB-01",
    drafts: [],
    schemaByType: {},
    getNodeByIdAsync: async () => null
  });
  assert.equal("meta" in withoutMeta, false);
});

test("meta는 UI와 code 경로로 저장까지 전달된다", async () => {
  const { readFile } = await import("node:fs/promises");
  const uiSource = await readFile(
    new URL("../apps/figma-plugin/src/ui.mjs", import.meta.url),
    "utf8"
  );
  const codeSource = await readFile(
    new URL("../apps/figma-plugin/src/code.mjs", import.meta.url),
    "utf8"
  );

  assert.match(uiSource, /currentScreenMeta/);
  assert.match(codeSource, /meta:\s*message\.meta/);
});

test("화면 JSON 다운로드 이름과 내용은 screenId를 기준으로 만든다", () => {
  const screenSpec = {
    schemaVersion: 1,
    screenId: "ONB-01",
    source: {},
    elements: []
  };

  assert.equal(getScreenSpecFileName(screenSpec), "screens/ONB-01/screen.json");
  assert.equal(formatScreenSpecJson(screenSpec).endsWith("\n"), true);
  assert.deepEqual(JSON.parse(formatScreenSpecJson(screenSpec)), screenSpec);
});
