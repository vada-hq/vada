import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  getSchemaConstantValue,
  getSchemaEnumValues,
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
    "emphasis",
    "initiallyDisabled",
    "action"
  ];
  const requiredKeys = ["type", "label", "initiallyDisabled", "action"];

  assert.deepEqual(getSchemaPropertyKeys(schema), propertyKeys);
  assert.deepEqual(schema.required, requiredKeys);
  assert.equal(schema.additionalProperties, false);
  assert.equal(getSchemaConstantValue(schema, "type"), "button");
});

test("button action은 일반 navigate 대상 화면을 표현한다", async () => {
  const schema = JSON.parse(await readFile(schemaUrl, "utf8"));
  const actionSchema = schema.properties.action;

  assert.deepEqual(getSchemaPropertyKeys(actionSchema), [
    "type",
    "targetScreenId",
    "mutationKey",
    "onSuccess",
    "note",
    "executeWhen",
    "onExecutionBlocked"
  ]);
  // type만 공통 필수다. navigate·submit이 각각 요구하는 필드는 allOf가 강제한다.
  assert.deepEqual(actionSchema.required, ["type"]);
  assert.deepEqual(
    actionSchema.allOf.map((branch) => [
      branch.if.properties.type.const,
      branch.then.required
    ]),
    [
      ["navigate", ["targetScreenId"]],
      ["submit", ["mutationKey", "onSuccess"]],
      // pending은 '아직 정해지지 않았다'를 명시한다. 대상 화면 id를 지어내는
      // 것보다 낫다 — 실제 화면이 등록될 때 전부 틀린 것으로 드러난다.
      ["pending", ["note"]]
    ]
  );
  assert.deepEqual(actionSchema.dependentRequired, {
    executeWhen: ["onExecutionBlocked"],
    onExecutionBlocked: ["executeWhen"]
  });
  assert.equal(actionSchema.additionalProperties, false);
  assert.deepEqual(getSchemaEnumValues(actionSchema, "type"), [
    "navigate",
    "submit",
    "pending"
  ]);
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

// 강조도는 시각 형태가 아니라 역할이다. 구현이 형태로 옮기며, 값은 디자인의
// 채움·테두리에서 유도한다(색은 보지 않는다 — 제품 디자인 시스템이므로).
test("button 강조도는 역할 세 단계를 선택 사항으로 선언한다", async () => {
  const schema = JSON.parse(await readFile(schemaUrl, "utf8"));

  assert.deepEqual(getSchemaEnumValues(schema, "emphasis"), [
    "primary",
    "secondary",
    "quiet"
  ]);
  assert.ok(!schema.required.includes("emphasis"));
});
