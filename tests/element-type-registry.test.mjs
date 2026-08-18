import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  getElementTypeOptions,
  getSchemaPropertyEditorKind,
  getSchemaPropertyKeys
} from "../apps/figma-plugin/src/plugin-model.mjs";

// 요소 유형 목록은 여러 곳에 손으로 이중화되어 있고, 그중 하나만 빠뜨려도
// "검증 없이 통과"나 "저장 시 요소 소실" 같은 조용한 결함이 된다.
// screen.schema.json의 spec.type enum을 유일한 원본으로 두고 나머지를 대조한다.
const schemasUrl = new URL("../packages/contracts/schemas/", import.meta.url);
const uiSourceUrl = new URL("../apps/figma-plugin/src/ui.mjs", import.meta.url);
// 요소 유형 레지스트리는 element-schemas.mjs 한 곳이다. 예전에는 UI(iframe)와
// code(Figma 샌드박스)가 각자 들고 있었고, ORG-02 작업에서 code 쪽 갱신이
// 누락돼 note·group·list가 있는 화면은 불러오기가 통째로 실패했다.
// 파일 목록을 손으로 적으면 같은 일이 반복되므로 소스를 훑어 찾는다.
const pluginSourceUrl = new URL("../apps/figma-plugin/src/", import.meta.url);

async function findRegistrySourceUrls() {
  const { readdir } = await import("node:fs/promises");
  const found = [];

  for (const fileName of await readdir(pluginSourceUrl)) {
    if (!fileName.endsWith(".mjs")) {
      continue;
    }

    const sourceUrl = new URL(fileName, pluginSourceUrl);

    if ((await readFile(sourceUrl, "utf8")).includes("const schemaByType = {")) {
      found.push(sourceUrl);
    }
  }

  return found;
}

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

test("모든 schemaByType 레지스트리가 모든 요소 유형을 담는다", async () => {
  const elementTypes = await readElementTypes();

  const registrySourceUrls = await findRegistrySourceUrls();

  // 레지스트리는 한 벌이어야 한다. 번들마다 따로 들고 있으면 한쪽 갱신이
  // 누락돼도 아무도 모른다(실제로 code.mjs가 note·group·list를 빠뜨렸다).
  assert.deepEqual(
    registrySourceUrls.map((sourceUrl) => sourceUrl.pathname.split("/").pop()),
    ["element-schemas.mjs"],
    "schemaByType은 element-schemas.mjs 한 곳에서만 선언하고 나머지는 import 하세요."
  );

  for (const sourceUrl of registrySourceUrls) {
    const fileName = sourceUrl.pathname.split("/").pop();
    const source = await readFile(sourceUrl, "utf8");
    const declaration = source.match(
      /const schemaByType = \{(?<body>[^}]*)\}/u
    )?.groups?.body;

    assert.ok(declaration, `${fileName}에서 schemaByType 선언을 찾지 못했습니다.`);

    for (const elementType of elementTypes) {
      assert.match(
        declaration,
        new RegExp(`\\b${elementType}\\s*:`, "u"),
        `${fileName}의 schemaByType에 '${elementType}'이 없습니다. 이 유형이 있는 화면은 저장·불러오기가 통째로 실패합니다.`
      );
    }
  }
});

// 편집 위젯이 없는 속성은 key 이름만 있는 죽은 줄로 그려진다. 값을 입력할 수도,
// 불러온 값을 되돌려줄 수도 없어서 `이 화면 저장` 한 번에 조용히 파괴된다
// (list.minItems/maxItems가 integer라 실제로 이 구멍에 빠졌다).
test("모든 요소 유형의 모든 속성에 편집 위젯이 있다", async () => {
  const pending = [];

  for (const elementType of await readElementTypes()) {
    const schema = await readSchema(`${elementType}.schema.json`);
    const walk = (objectSchema, parentPath) => {
      for (const propertyKey of getSchemaPropertyKeys(objectSchema)) {
        const propertyPath = parentPath
          ? `${parentPath}.${propertyKey}`
          : propertyKey;
        const editorKind = getSchemaPropertyEditorKind(
          objectSchema,
          propertyKey
        );

        if (editorKind === "pending") {
          pending.push(`${elementType}.${propertyPath}`);
        }

        if (editorKind === "object") {
          walk(objectSchema.properties[propertyKey], propertyPath);
        }
      }
    };

    walk(schema, "");
  }

  assert.deepEqual(
    pending,
    [],
    `편집 위젯이 없는 속성이 있습니다: ${pending.join(", ")}`
  );
});

// 선택 속성이면서 nullable이면 '부재'와 'null'이 같은 뜻이 된다. 플러그인의 초안
// 값은 빈 문자열 하나로 둘을 표현하므로 왕복에서 반드시 한쪽으로 뭉개진다
// (select.label·group.description·list.label이 실제로 이 조합이었다).
// 값이 없을 수 있으면 required+nullable, 개념 자체가 없을 수 있으면 optional로 간다.
test("선택 속성은 nullable일 수 없다", async () => {
  const traps = [];

  for (const elementType of await readElementTypes()) {
    const schema = await readSchema(`${elementType}.schema.json`);
    const walk = (objectSchema, parentPath) => {
      const required = Array.isArray(objectSchema.required)
        ? objectSchema.required
        : [];

      for (const [propertyKey, property] of Object.entries(
        objectSchema.properties ?? {}
      )) {
        const propertyPath = parentPath
          ? `${parentPath}.${propertyKey}`
          : propertyKey;

        if (
          Array.isArray(property.type) &&
          property.type.includes("null") &&
          !required.includes(propertyKey)
        ) {
          traps.push(`${elementType}.${propertyPath}`);
        }

        if (property.type === "object" && property.properties) {
          walk(property, propertyPath);
        }
      }
    };

    walk(schema, "");
  }

  assert.deepEqual(
    traps,
    [],
    `선택이면서 nullable인 속성이 있습니다: ${traps.join(", ")}`
  );
});

// 판정기가 새 편집 종류를 돌려줘도 렌더러에 분기가 없으면 여전히 죽은 줄이다.
// 판정기만 고치고 UI를 빠뜨리는 것이 이 결함의 실제 재발 경로다.
test("UI 렌더러가 모든 편집 종류를 그린다", async () => {
  const source = await readFile(uiSourceUrl, "utf8");
  const rendered = new Set(
    [...source.matchAll(/editorKind === "(?<kind>[a-z-]+)"/gu)].map(
      (match) => match.groups.kind
    )
  );
  const missing = new Set();

  for (const elementType of await readElementTypes()) {
    const schema = await readSchema(`${elementType}.schema.json`);
    const walk = (objectSchema) => {
      for (const propertyKey of getSchemaPropertyKeys(objectSchema)) {
        const editorKind = getSchemaPropertyEditorKind(
          objectSchema,
          propertyKey
        );

        // readonly는 const 값 표시가 따로 처리한다.
        if (editorKind !== "readonly" && !rendered.has(editorKind)) {
          missing.add(`${editorKind}(${elementType}.${propertyKey})`);
        }

        if (editorKind === "object") {
          walk(objectSchema.properties[propertyKey]);
        }
      }
    };

    walk(schema);
  }

  assert.deepEqual(
    [...missing],
    [],
    `ui.mjs에 렌더링 분기가 없는 편집 종류가 있습니다: ${[...missing].join(", ")}`
  );
});
