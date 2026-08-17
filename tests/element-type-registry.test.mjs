import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { getElementTypeOptions } from "../apps/figma-plugin/src/plugin-model.mjs";

// 요소 유형 목록은 여러 곳에 손으로 이중화되어 있고, 그중 하나만 빠뜨려도
// "검증 없이 통과"나 "저장 시 요소 소실" 같은 조용한 결함이 된다.
// screen.schema.json의 spec.type enum을 유일한 원본으로 두고 나머지를 대조한다.
const schemasUrl = new URL("../packages/contracts/schemas/", import.meta.url);
const uiSourceUrl = new URL("../apps/figma-plugin/src/ui.mjs", import.meta.url);

async function readSchema(fileName) {
  return JSON.parse(await readFile(new URL(fileName, schemasUrl), "utf8"));
}

async function readElementTypes() {
  const screenSchema = await readSchema("screen.schema.json");

  return screenSchema.properties.elements.items.properties.spec.properties.type
    .enum;
}

test("모든 요소 유형에 같은 이름의 스키마 파일이 있다", async () => {
  for (const elementType of await readElementTypes()) {
    const schema = await readSchema(`${elementType}.schema.json`);

    assert.equal(
      schema.properties?.type?.const,
      elementType,
      `${elementType}.schema.json의 type.const가 유형 이름과 달라 검증 대상이 어긋납니다.`
    );
  }
});

test("플러그인 등록 유형 목록이 스키마 enum과 일치한다", async () => {
  const elementTypes = await readElementTypes();
  const optionValues = getElementTypeOptions().map((option) => option.value);

  assert.deepEqual(
    [...optionValues].sort(),
    [...elementTypes].sort(),
    "ELEMENT_TYPE_OPTIONS와 screen.schema.json의 spec.type enum이 어긋났습니다."
  );
});

test("플러그인 UI의 schemaByType이 모든 요소 유형을 담는다", async () => {
  const elementTypes = await readElementTypes();
  const source = await readFile(uiSourceUrl, "utf8");
  const declaration = source.match(
    /const schemaByType = \{(?<body>[^}]*)\}/u
  )?.groups?.body;

  assert.ok(declaration, "ui.mjs에서 schemaByType 선언을 찾지 못했습니다.");

  for (const elementType of elementTypes) {
    assert.match(
      declaration,
      new RegExp(`\\b${elementType}\\s*:`, "u"),
      `ui.mjs의 schemaByType에 '${elementType}'이 없습니다. 저장·불러오기에서 이 유형이 조용히 사라집니다.`
    );
  }
});
