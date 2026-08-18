import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  getSchemaConstantValue,
  getSchemaEnumValues,
  getSchemaPropertyKeys,
  getSchemaPropertyKeysForElementType,
  getSelectedNodeInfo
} from "../apps/figma-plugin/src/plugin-model.mjs";

const schemaUrl = new URL(
  "../packages/contracts/schemas/select.schema.json",
  import.meta.url
);
const optionSourcesSchemaUrl = new URL(
  "../packages/contracts/schemas/option-sources.schema.json",
  import.meta.url
);

test("select 스키마는 승인된 v1 필드만 선언한다", async () => {
  const schema = JSON.parse(await readFile(schemaUrl, "utf8"));
  const propertyKeys = [
    "type",
    "fieldKey",
    "label",
    "placeholder",
    "disabledPlaceholder",
    "helperText",
    "presentation",
    "initialValue",
    "valueType",
    "required",
    "initiallyDisabled",
    "searchable",
    "optionsSource",
    "enabledWhen",
    "resetOnChangeOf"
  ];
  const optionalKeys = [
    // 라벨 없는 select(ORG-02의 조직 구성 방식 라디오 카드)를 허용한다.
    "label",
    "disabledPlaceholder",
    "helperText",
    "presentation",
    "enabledWhen",
    "resetOnChangeOf"
  ];
  const requiredKeys = propertyKeys.filter(
    (propertyKey) => !optionalKeys.includes(propertyKey)
  );

  assert.deepEqual(getSchemaPropertyKeys(schema), propertyKeys);
  assert.deepEqual(schema.required, requiredKeys);
  assert.equal(schema.additionalProperties, false);
  assert.equal(getSchemaConstantValue(schema, "type"), "select");
});

test("select 스키마 속성은 공통 편집기로 표시할 수 있다", async () => {
  const schema = JSON.parse(await readFile(schemaUrl, "utf8"));

  assert.deepEqual(
    getSchemaPropertyKeys(schema.properties.optionsSource),
    ["key", "params"]
  );
  assert.deepEqual(schema.properties.optionsSource.required, ["key"]);
  assert.deepEqual(getSchemaEnumValues(schema, "valueType"), [
    "string",
    "integer",
    "number",
    "boolean"
  ]);
  assert.deepEqual(
    getSchemaEnumValues(schema.properties.enabledWhen.items, "operator"),
    ["hasValue"]
  );
});

test("wireframe 옵션 출처 카탈로그 v2는 타입별 실행 계약을 선언한다", async () => {
  const schema = JSON.parse(await readFile(optionSourcesSchemaUrl, "utf8"));
  const sourceSchema = schema.properties.sources.items;

  assert.deepEqual(getSchemaPropertyKeys(schema), ["schemaVersion", "sources"]);
  assert.equal(schema.properties.schemaVersion.const, 2);
  assert.deepEqual(getSchemaPropertyKeys(sourceSchema), [
    "key",
    "type",
    "description",
    "params",
    "options",
    "request",
    "messages"
  ]);
  assert.deepEqual(getSchemaEnumValues(sourceSchema, "type"), [
    "static",
    "remote"
  ]);
  assert.equal(sourceSchema.additionalProperties, false);
  assert.match(JSON.stringify(sourceSchema.allOf), /"request"/);
  assert.match(JSON.stringify(sourceSchema.allOf), /"messages"/);
  assert.match(JSON.stringify(sourceSchema.allOf), /"options"/);
});

test("선택 유형을 고르면 select 스키마 key를 반환한다", async () => {
  const selectSchema = JSON.parse(await readFile(schemaUrl, "utf8"));

  assert.deepEqual(
    getSchemaPropertyKeysForElementType("select", { select: selectSchema }),
    getSchemaPropertyKeys(selectSchema)
  );
});

test("복합 선택 요소의 내부 Label과 Text Input에서 제안값을 찾는다", () => {
  const labelText = {
    type: "TEXT",
    characters: "학교*",
    visible: true
  };
  const label = {
    name: "Label",
    type: "FRAME",
    children: [labelText]
  };
  const placeholderText = {
    type: "TEXT",
    characters: "학교명을 검색하세요",
    visible: true,
    opacity: 1,
    fills: [{ type: "SOLID", opacity: 0.5 }]
  };
  const input = {
    name: "Text Input",
    type: "FRAME",
    children: [placeholderText]
  };
  const container = {
    name: "Container",
    type: "FRAME",
    children: [input]
  };
  const select = {
    id: "7:39",
    name: "ProfileSearchSelect",
    type: "FRAME",
    children: [label, container]
  };

  labelText.parent = label;
  label.parent = select;
  placeholderText.parent = input;
  input.parent = container;
  container.parent = select;

  assert.deepEqual(getSelectedNodeInfo(select), {
    nodeId: "7:39",
    name: "ProfileSearchSelect",
    type: "FRAME",
    suggestedLabel: "학교",
    suggestedRequired: true,
    suggestedPlaceholder: "학교명을 검색하세요"
  });
});
