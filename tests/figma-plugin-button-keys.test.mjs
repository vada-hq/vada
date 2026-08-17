import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  getSchemaConstantValue,
  getSchemaPropertyEditorKind,
  getSchemaPropertyKeys,
  getSchemaPropertyKeysForElementType
} from "../apps/figma-plugin/src/plugin-model.mjs";

const schemaUrl = new URL(
  "../packages/contracts/schemas/button.schema.json",
  import.meta.url
);
const uiSourceUrl = new URL(
  "../apps/figma-plugin/src/ui.mjs",
  import.meta.url
);
const onb01Url = new URL(
  "../specs/figma/vada-wireframe/screens/ONB-01/screen.json",
  import.meta.url
);

test("button 스키마는 승인된 v1 필드만 선언한다", async () => {
  const schema = JSON.parse(await readFile(schemaUrl, "utf8"));
  const propertyKeys = [
    "type",
    "label",
    "description",
    "badge",
    "initiallyDisabled",
    "action"
  ];
  const requiredKeys = ["type", "label", "initiallyDisabled", "action"];

  assert.deepEqual(getSchemaPropertyKeys(schema), propertyKeys);
  assert.deepEqual(schema.required, requiredKeys);
  assert.equal(schema.additionalProperties, false);
  assert.equal(getSchemaConstantValue(schema, "type"), "button");
  assert.equal(getSchemaPropertyEditorKind(schema, "description"), "text");
  assert.equal(getSchemaPropertyEditorKind(schema, "badge"), "text");
});

test("button action은 일반 navigate 대상 화면을 표현한다", async () => {
  const schema = JSON.parse(await readFile(schemaUrl, "utf8"));
  const actionSchema = schema.properties.action;

  assert.equal(getSchemaPropertyEditorKind(schema, "action"), "object");
  assert.deepEqual(getSchemaPropertyKeys(actionSchema), [
    "type",
    "targetScreenId",
    "executeWhen",
    "onExecutionBlocked"
  ]);
  assert.deepEqual(actionSchema.required, ["type", "targetScreenId"]);
  assert.deepEqual(actionSchema.dependentRequired, {
    executeWhen: ["onExecutionBlocked"],
    onExecutionBlocked: ["executeWhen"]
  });
  assert.equal(actionSchema.additionalProperties, false);
  assert.equal(getSchemaConstantValue(actionSchema, "type"), "navigate");
  assert.equal(
    getSchemaPropertyEditorKind(actionSchema, "targetScreenId"),
    "text"
  );
  assert.equal(
    getSchemaPropertyEditorKind(actionSchema, "executeWhen"),
    "object"
  );
  assert.equal(
    getSchemaConstantValue(
      actionSchema.properties.executeWhen,
      "type"
    ),
    "allRequiredFieldsHaveValue"
  );
  assert.deepEqual(
    getSchemaPropertyKeys(actionSchema.properties.executeWhen),
    ["type", "scope"]
  );
  assert.deepEqual(
    actionSchema.properties.executeWhen.required,
    ["type", "scope"]
  );
  assert.equal(
    getSchemaConstantValue(
      actionSchema.properties.executeWhen,
      "scope"
    ),
    "screen"
  );
  assert.deepEqual(
    getSchemaPropertyKeys(actionSchema.properties.onExecutionBlocked),
    ["type", "focus"]
  );
  assert.deepEqual(
    actionSchema.properties.onExecutionBlocked.required,
    ["type", "focus"]
  );
  assert.equal(
    getSchemaConstantValue(
      actionSchema.properties.onExecutionBlocked,
      "type"
    ),
    "showMissingRequiredFields"
  );
  assert.equal(
    getSchemaConstantValue(
      actionSchema.properties.onExecutionBlocked,
      "focus"
    ),
    "firstMissingField"
  );
});

test("버튼 유형을 고르면 button 스키마 key를 반환한다", async () => {
  const buttonSchema = JSON.parse(await readFile(schemaUrl, "utf8"));

  assert.deepEqual(
    getSchemaPropertyKeysForElementType("button", { button: buttonSchema }),
    getSchemaPropertyKeys(buttonSchema)
  );
});

test("플러그인은 버튼 실행 조건을 현재 화면 필수 필드 기준으로 풀어서 보여 준다", async () => {
  const uiSource = await readFile(uiSourceUrl, "utf8");

  assert.match(uiSource, /getRequiredFieldCandidates/);
  assert.match(uiSource, /판정 후보/);
  assert.match(uiSource, /enabledWhen을 만족한 후보만 판정/);
  assert.match(uiSource, /첫 누락 필드로 이동/);
  assert.match(uiSource, /실행 조건 없이 항상 실행/);
});

test("ONB-01 다음 버튼은 실행 범위와 차단 동작을 명시한다", async () => {
  const screenSpec = JSON.parse(await readFile(onb01Url, "utf8"));
  const button = screenSpec.elements.find(
    ({ spec }) => spec.type === "button"
  );

  assert.deepEqual(button.spec.action.executeWhen, {
    type: "allRequiredFieldsHaveValue",
    scope: "screen"
  });
  assert.deepEqual(button.spec.action.onExecutionBlocked, {
    type: "showMissingRequiredFields",
    focus: "firstMissingField"
  });
});
