import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  createNodeDraftStore,
  extractLabelFromDirectParent,
  findInputElement,
  getElementTypeOptions,
  getSchemaConstantValue,
  getSchemaEnumValues,
  getSchemaPropertyEditorKind,
  getSchemaTextPropertyKeys,
  getSchemaPropertyKeysForElementType,
  getSchemaPropertyKeys,
  getSelectedNodeInfo,
  parseLabelRequirement
} from "../apps/figma-plugin/src/plugin-model.mjs";

const schemaUrl = new URL(
  "../packages/contracts/schemas/input.schema.json",
  import.meta.url
);

test("input 스키마의 properties key를 선언 순서대로 반환한다", async () => {
  const schema = JSON.parse(await readFile(schemaUrl, "utf8"));

  assert.deepEqual(getSchemaPropertyKeys(schema), [
    "type",
    "fieldKey",
    "label",
    "placeholder",
    "initialValue",
    "inputType",
    "valueType",
    "required",
    "validation"
  ]);
});

test("선택한 노드 또는 조상에서 Text Input 요소를 찾는다", () => {
  const input = { name: "Text Input", parent: null };
  const child = { name: "입력값", parent: input };

  assert.equal(findInputElement(input), input);
  assert.equal(findInputElement(child), input);
  assert.equal(findInputElement({ name: "Button", parent: null }), null);
});

test("선택한 Figma 노드에서 표시할 식별 정보만 반환한다", () => {
  const node = {
    id: "7:29",
    name: "Text Input",
    type: "FRAME",
    parent: null
  };

  assert.deepEqual(getSelectedNodeInfo(node), {
    nodeId: "7:29",
    name: "Text Input",
    type: "FRAME"
  });
  assert.equal(getSelectedNodeInfo(null), null);
});

test("현재 지원하는 요소 유형은 입력, 버튼, 선택이다", () => {
  assert.deepEqual(getElementTypeOptions(), [
    { value: "input", label: "입력" },
    { value: "button", label: "버튼" },
    { value: "select", label: "선택" }
  ]);
});

test("입력 유형을 선택하면 input 스키마 key를 반환한다", async () => {
  const inputSchema = JSON.parse(await readFile(schemaUrl, "utf8"));
  const schemaByType = { input: inputSchema };

  assert.deepEqual(
    getSchemaPropertyKeysForElementType("input", schemaByType),
    [
      "type",
      "fieldKey",
      "label",
      "placeholder",
      "initialValue",
      "inputType",
      "valueType",
      "required",
      "validation"
    ]
  );
  assert.deepEqual(
    getSchemaPropertyKeysForElementType("button", schemaByType),
    []
  );
});

test("const가 선언된 type의 고정값만 반환한다", async () => {
  const schema = JSON.parse(await readFile(schemaUrl, "utf8"));

  assert.equal(getSchemaConstantValue(schema, "type"), "input");
  assert.equal(getSchemaConstantValue(schema, "fieldKey"), undefined);
});

test("스키마 속성 유형에 맞는 편집기를 선택한다", async () => {
  const schema = JSON.parse(await readFile(schemaUrl, "utf8"));

  assert.equal(getSchemaPropertyEditorKind(schema, "type"), "readonly");
  assert.equal(getSchemaPropertyEditorKind(schema, "fieldKey"), "text");
  assert.equal(getSchemaPropertyEditorKind(schema, "required"), "boolean");
  assert.equal(getSchemaPropertyEditorKind(schema, "inputType"), "enum");
  assert.equal(getSchemaPropertyEditorKind(schema, "valueType"), "enum");
  assert.equal(
    getSchemaPropertyEditorKind(schema, "validation"),
    "empty-array"
  );
});

test("enum 속성의 선택지를 스키마 선언 순서대로 반환한다", async () => {
  const schema = JSON.parse(await readFile(schemaUrl, "utf8"));

  assert.deepEqual(getSchemaEnumValues(schema, "inputType"), [
    "text",
    "email",
    "password",
    "number",
    "tel",
    "url",
    "search",
    "date",
    "time",
    "datetime-local"
  ]);
  assert.deepEqual(getSchemaEnumValues(schema, "valueType"), [
    "string",
    "integer",
    "number",
    "boolean"
  ]);
  assert.deepEqual(getSchemaEnumValues(schema, "fieldKey"), []);
});

test("문자열 또는 nullable 문자열 속성을 텍스트 입력 대상으로 반환한다", async () => {
  const schema = JSON.parse(await readFile(schemaUrl, "utf8"));

  assert.deepEqual(getSchemaTextPropertyKeys(schema), [
    "fieldKey",
    "label",
    "placeholder",
    "initialValue"
  ]);
});

test("선택 요소의 직접 부모 안에 있는 유일한 위쪽 TEXT를 라벨로 추출한다", () => {
  const label = {
    type: "TEXT",
    characters: "이름",
    visible: true,
    absoluteBoundingBox: { x: 100, y: 100, width: 40, height: 16 }
  };
  const value = {
    type: "TEXT",
    characters: "김바다",
    visible: true,
    absoluteBoundingBox: { x: 110, y: 130, width: 60, height: 16 }
  };
  const input = {
    type: "FRAME",
    visible: true,
    absoluteBoundingBox: { x: 100, y: 120, width: 200, height: 40 },
    children: [value]
  };
  const field = {
    type: "FRAME",
    children: [label, input]
  };
  label.parent = field;
  input.parent = field;
  value.parent = input;

  assert.equal(extractLabelFromDirectParent(input), "이름");
});

test("라벨 끝의 별표만 필수 표시로 분리한다", () => {
  assert.deepEqual(parseLabelRequirement("이름*"), {
    label: "이름",
    required: true
  });
  assert.deepEqual(parseLabelRequirement("이름 * "), {
    label: "이름",
    required: true
  });
  assert.deepEqual(parseLabelRequirement("수*식"), {
    label: "수*식",
    required: false
  });
  assert.deepEqual(parseLabelRequirement("이름"), {
    label: "이름",
    required: false
  });
});

test("선택 노드 정보에 정리된 라벨과 필수 여부를 함께 넣는다", () => {
  const label = {
    type: "TEXT",
    characters: "이름*",
    visible: true,
    absoluteBoundingBox: { x: 100, y: 100, width: 40, height: 16 }
  };
  const input = {
    id: "7:29",
    name: "Text Input",
    type: "FRAME",
    visible: true,
    absoluteBoundingBox: { x: 100, y: 120, width: 200, height: 40 },
    children: []
  };
  const field = { type: "FRAME", children: [label, input] };
  label.parent = field;
  input.parent = field;

  assert.deepEqual(getSelectedNodeInfo(input), {
    nodeId: "7:29",
    name: "Text Input",
    type: "FRAME",
    suggestedLabel: "이름",
    suggestedRequired: true
  });
});

test("상위 필드 구조의 가까운 TEXT를 라벨로 찾고 선택 요소 내부 TEXT는 제외한다", () => {
  const label = {
    type: "TEXT",
    characters: "단과대학*",
    visible: true,
    absoluteBoundingBox: { x: 100, y: 100, width: 80, height: 16 }
  };
  const value = {
    type: "TEXT",
    characters: "학교를 먼저 선택하세요",
    visible: true,
    absoluteBoundingBox: { x: 110, y: 130, width: 60, height: 16 }
  };
  const input = {
    type: "FRAME",
    visible: true,
    absoluteBoundingBox: { x: 100, y: 120, width: 200, height: 40 },
    children: [value]
  };
  const inputShell = { type: "FRAME", children: [input] };
  const field = { type: "FRAME", children: [label, inputShell] };
  const screen = { type: "FRAME", children: [field] };
  const page = { type: "PAGE", children: [screen] };
  label.parent = field;
  inputShell.parent = field;
  field.parent = screen;
  screen.parent = page;
  input.parent = inputShell;
  value.parent = input;

  assert.equal(extractLabelFromDirectParent(input), "단과대학*");
});

test("같은 조상 단계에 위쪽 TEXT가 여러 개면 수직으로 가장 가까운 것을 고른다", () => {
  const first = {
    type: "TEXT",
    characters: "이름",
    visible: true,
    absoluteBoundingBox: { x: 100, y: 80, width: 40, height: 16 }
  };
  const second = {
    type: "TEXT",
    characters: "필수 항목",
    visible: true,
    absoluteBoundingBox: { x: 100, y: 100, width: 60, height: 16 }
  };
  const input = {
    type: "FRAME",
    visible: true,
    absoluteBoundingBox: { x: 100, y: 120, width: 200, height: 40 },
    children: []
  };
  const field = { type: "FRAME", children: [first, second, input] };
  first.parent = field;
  second.parent = field;
  input.parent = field;

  assert.equal(extractLabelFromDirectParent(input), "필수 항목");
});

test("현재 화면 FRAME을 넘어선 TEXT는 라벨 후보로 찾지 않는다", () => {
  const pageTitle = {
    type: "TEXT",
    characters: "온보딩",
    visible: true,
    absoluteBoundingBox: { x: 100, y: 100, width: 80, height: 16 }
  };
  const input = {
    type: "FRAME",
    visible: true,
    absoluteBoundingBox: { x: 100, y: 120, width: 200, height: 40 },
    children: []
  };
  const field = { type: "FRAME", children: [input] };
  const screen = { type: "FRAME", children: [field] };
  const page = { type: "PAGE", children: [pageTitle, screen] };
  pageTitle.parent = page;
  screen.parent = page;
  field.parent = screen;
  input.parent = field;

  assert.equal(extractLabelFromDirectParent(input), undefined);
});

test("선택 입력 내부의 불투명한 TEXT는 초기값으로 제안한다", () => {
  const value = {
    type: "TEXT",
    characters: "김바다",
    visible: true,
    opacity: 1,
    fills: [{ type: "SOLID", opacity: 1 }]
  };
  const input = {
    id: "7:29",
    name: "Text Input",
    type: "FRAME",
    children: [value]
  };
  value.parent = input;

  assert.deepEqual(getSelectedNodeInfo(input), {
    nodeId: "7:29",
    name: "Text Input",
    type: "FRAME",
    suggestedInitialValue: "김바다"
  });
});

test("선택 입력 내부의 자체 투명도가 낮은 TEXT는 플레이스홀더로 제안한다", () => {
  const value = {
    type: "TEXT",
    characters: "이름을 입력하세요",
    visible: true,
    opacity: 1,
    fills: [{ type: "SOLID", opacity: 0.5 }]
  };
  const input = {
    id: "7:29",
    name: "Text Input",
    type: "FRAME",
    children: [value]
  };
  value.parent = input;

  assert.deepEqual(getSelectedNodeInfo(input), {
    nodeId: "7:29",
    name: "Text Input",
    type: "FRAME",
    suggestedPlaceholder: "이름을 입력하세요"
  });
});

test("부모의 낮은 opacity는 내부 TEXT의 플레이스홀더 판정에 사용하지 않는다", () => {
  const value = {
    type: "TEXT",
    characters: "김바다",
    visible: true,
    opacity: 1,
    fills: [{ type: "SOLID", opacity: 1 }]
  };
  const input = {
    id: "7:29",
    name: "Text Input",
    type: "FRAME",
    opacity: 0.3,
    children: [value]
  };
  value.parent = input;

  assert.equal(getSelectedNodeInfo(input).suggestedInitialValue, "김바다");
  assert.equal(getSelectedNodeInfo(input).suggestedPlaceholder, undefined);
});

test("nodeId별 요소 초안을 독립적으로 보존하고 복사본으로 복원한다", () => {
  const store = createNodeDraftStore();

  store.save("7:29", {
    elementType: "input",
    values: {
      fieldKey: "name",
      label: "이름",
      required: "true"
    }
  });
  store.save("7:34", {
    elementType: "input",
    values: {
      fieldKey: "studentNumber",
      label: "학번"
    }
  });

  assert.deepEqual(store.load("7:29"), {
    elementType: "input",
    values: {
      fieldKey: "name",
      label: "이름",
      required: "true"
    }
  });
  assert.deepEqual(store.load("7:34"), {
    elementType: "input",
    values: {
      fieldKey: "studentNumber",
      label: "학번"
    }
  });

  const restored = store.load("7:29");
  restored.values.label = "변경";

  assert.equal(store.load("7:29").values.label, "이름");
});

test("등록 취소는 선택한 nodeId의 초안만 삭제한다", () => {
  const store = createNodeDraftStore();
  const firstDraft = {
    elementType: "input",
    values: { label: "이름" }
  };
  const secondDraft = {
    elementType: "button",
    values: { label: "다음" }
  };

  store.save("7:29", firstDraft);
  store.save("7:34", secondDraft);

  assert.equal(store.remove("7:29"), true);
  assert.equal(store.load("7:29"), undefined);
  assert.deepEqual(store.load("7:34"), secondDraft);
  assert.equal(store.remove("missing"), false);
});

test("화면 저장용 초안 목록을 복사본으로 반환하고 초기화한다", () => {
  const store = createNodeDraftStore();
  store.save("7:29", {
    elementType: "input",
    values: { fieldKey: "name" }
  });

  const entries = store.entries();
  entries[0].values.fieldKey = "changed";

  assert.deepEqual(store.entries(), [
    {
      nodeId: "7:29",
      elementType: "input",
      values: { fieldKey: "name" }
    }
  ]);

  store.clear();
  assert.deepEqual(store.entries(), []);
});
