import {
  getSchemaConstantValue,
  getSchemaPropertyEditorKind,
  getSchemaPropertyKeys
} from "./plugin-model.mjs";
import { normalizeStateScopeKey } from "./state-scopes.mjs";

export const SCREEN_SPEC_PLUGIN_DATA_KEY = "screen-spec";
export const SCREEN_SPEC_SHARED_PLUGIN_DATA_NAMESPACE = "figmaspecv2";
export const SCREEN_SPEC_SHARED_PLUGIN_DATA_KEY = "screen-spec";
export const SCREEN_SPEC_VERSION = 1;

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object, key);
}

function getPropertyPath(parentPath, propertyKey) {
  return parentPath
    ? `${parentPath}.${propertyKey}`
    : propertyKey;
}

function isNullableProperty(property) {
  return Array.isArray(property?.type) && property.type.includes("null");
}

function isRequiredProperty(schema, propertyKey) {
  return Array.isArray(schema?.required) && schema.required.includes(propertyKey);
}

function serializeBoolean(value) {
  if (value === true || value === "true") {
    return true;
  }

  if (value === false || value === "false") {
    return false;
  }

  return null;
}

function serializeSchemaObject(schema, values, parentPath = "") {
  const result = {};

  for (const propertyKey of getSchemaPropertyKeys(schema)) {
    const propertyPath = getPropertyPath(parentPath, propertyKey);
    const property = schema.properties[propertyKey];
    const editorKind = getSchemaPropertyEditorKind(schema, propertyKey);
    const constantValue = getSchemaConstantValue(schema, propertyKey);
    const isRequired = isRequiredProperty(schema, propertyKey);

    if (constantValue !== undefined) {
      result[propertyKey] = constantValue;
      continue;
    }

    if (editorKind === "object") {
      // 선택적 object는 빈 문자열 마커("")로 명시적 부재를 표현한다.
      // 마커가 없으면(신규 등록) 기존처럼 기본 구조를 기록한다.
      if (!isRequired && values[propertyPath] === "") {
        continue;
      }

      const objectValue = serializeSchemaObject(
        property,
        values,
        propertyPath
      );

      if (isRequired || Object.keys(objectValue).length > 0) {
        result[propertyKey] = objectValue;
      }
      continue;
    }

    if (editorKind === "boolean") {
      result[propertyKey] = serializeBoolean(values[propertyPath]);
      continue;
    }

    if (editorKind === "empty-array") {
      result[propertyKey] = [];
      continue;
    }

    const rawValue = hasOwn(values, propertyPath)
      ? values[propertyPath]
      : "";

    if (!isRequired && rawValue === "") {
      continue;
    }

    if (editorKind === "json-array") {
      let parsedValue;

      try {
        parsedValue = JSON.parse(rawValue);
      } catch {
        throw new TypeError(`${propertyPath}는 올바른 JSON 배열이어야 합니다.`);
      }

      if (!Array.isArray(parsedValue)) {
        throw new TypeError(`${propertyPath}는 JSON 배열이어야 합니다.`);
      }

      result[propertyKey] = parsedValue;
      continue;
    }

    if (editorKind === "json-object") {
      let parsedValue;

      try {
        parsedValue = JSON.parse(rawValue);
      } catch {
        throw new TypeError(`${propertyPath}는 올바른 JSON 객체여야 합니다.`);
      }

      if (
        parsedValue === null ||
        typeof parsedValue !== "object" ||
        Array.isArray(parsedValue)
      ) {
        throw new TypeError(`${propertyPath}는 JSON 객체여야 합니다.`);
      }

      result[propertyKey] = parsedValue;
      continue;
    }

    if (editorKind === "number") {
      if (rawValue === "") {
        // 여기에 도달했다면 필수 속성이다(선택 속성의 빈 값은 위에서 생략된다).
        if (isNullableProperty(property)) {
          result[propertyKey] = null;
          continue;
        }

        throw new TypeError(`${propertyPath}에 숫자를 입력하세요.`);
      }

      const parsedValue = Number(rawValue);
      const needsInteger =
        property.type === "integer" ||
        (Array.isArray(property.type) && property.type.includes("integer"));

      if (
        !Number.isFinite(parsedValue) ||
        (needsInteger && !Number.isInteger(parsedValue))
      ) {
        throw new TypeError(
          `${propertyPath}는 ${needsInteger ? "정수" : "숫자"}여야 합니다.`
        );
      }

      result[propertyKey] = parsedValue;
      continue;
    }

    if (
      editorKind === "text" &&
      rawValue === "" &&
      isNullableProperty(property)
    ) {
      result[propertyKey] = null;
      continue;
    }

    result[propertyKey] = rawValue;
  }

  return result;
}

function flattenSchemaObject(schema, spec, parentPath = "") {
  const values = {};

  for (const propertyKey of getSchemaPropertyKeys(schema)) {
    const propertyPath = getPropertyPath(parentPath, propertyKey);
    const editorKind = getSchemaPropertyEditorKind(schema, propertyKey);
    const value = spec?.[propertyKey];

    if (
      !isRequiredProperty(schema, propertyKey) &&
      value === undefined &&
      editorKind !== "object"
    ) {
      continue;
    }

    if (editorKind === "readonly") {
      continue;
    }

    if (editorKind === "object") {
      if (!isRequiredProperty(schema, propertyKey)) {
        values[propertyPath] = value === undefined ? "" : "present";

        if (value === undefined) {
          continue;
        }
      }

      Object.assign(
        values,
        flattenSchemaObject(
          schema.properties[propertyKey],
          value,
          propertyPath
        )
      );
      continue;
    }

    if (editorKind === "boolean") {
      values[propertyPath] =
        value === true ? "true" : value === false ? "false" : "";
      continue;
    }

    if (editorKind === "empty-array") {
      values[propertyPath] = JSON.stringify(
        Array.isArray(value) ? value : []
      );
      continue;
    }

    if (editorKind === "json-array") {
      values[propertyPath] = JSON.stringify(value);
      continue;
    }

    if (editorKind === "json-object") {
      values[propertyPath] = JSON.stringify(value);
      continue;
    }

    values[propertyPath] = value === null || value === undefined
      ? ""
      : String(value);
  }

  return values;
}

function findContainingPage(node) {
  let current = node;

  while (current && current.type !== "PAGE") {
    current = current.parent ?? null;
  }

  return current;
}

function createScreenSource(screenNode) {
  if (!screenNode || screenNode.type !== "FRAME") {
    throw new TypeError("화면 FRAME을 찾을 수 없습니다.");
  }

  const page = findContainingPage(screenNode);

  if (!page) {
    throw new TypeError("화면이 속한 Figma 페이지를 찾을 수 없습니다.");
  }

  return {
    pageName: page.name,
    nodeId: screenNode.id,
    name: screenNode.name,
    figmaType: screenNode.type
  };
}

function createElementSource(node) {
  return {
    nodeId: node.id,
    name: node.name,
    figmaType: node.type
  };
}

export function serializeElementSpec(schema, values = {}) {
  return serializeSchemaObject(schema, values);
}

export function flattenElementSpec(schema, spec) {
  return flattenSchemaObject(schema, spec);
}

export function createDraftsFromScreenSpec(screenSpec, schemaByType) {
  const drafts = [];

  for (const element of Array.isArray(screenSpec?.elements)
    ? screenSpec.elements
    : []) {
    const nodeId = element?.source?.nodeId;
    const elementType = element?.spec?.type;
    const schema = schemaByType?.[elementType];

    if (typeof nodeId !== "string" || !schema) {
      continue;
    }

    drafts.push({
      nodeId,
      elementType,
      values: flattenElementSpec(schema, element.spec)
    });
  }

  return drafts;
}

function isNodeInsideScreen(node, screenNode) {
  let current = node?.parent ?? null;

  while (current) {
    if (current.id === screenNode.id) {
      return true;
    }
    current = current.parent ?? null;
  }

  return false;
}

export async function prepareImportedScreenSpec({
  screenSpec,
  screenNode,
  screenId,
  schemaByType,
  getNodeByIdAsync
}) {
  if (!screenSpec || typeof screenSpec !== "object" || Array.isArray(screenSpec)) {
    throw new TypeError("로컬 화면 JSON은 객체여야 합니다.");
  }

  if (screenSpec.schemaVersion !== SCREEN_SPEC_VERSION) {
    throw new Error("지원하지 않는 화면 JSON schemaVersion입니다.");
  }

  if (screenSpec.screenId !== screenId) {
    throw new Error("screenId가 현재 작업 화면과 일치하지 않습니다.");
  }

  if (hasOwn(screenSpec, "stateScopeKey")) {
    normalizeStateScopeKey(screenSpec.stateScopeKey);
  }

  if (!screenNode || screenSpec.source?.nodeId !== screenNode.id) {
    throw new Error("화면 nodeId가 현재 작업 화면과 일치하지 않습니다.");
  }

  if (!Array.isArray(screenSpec.elements)) {
    throw new Error("화면 JSON의 elements는 배열이어야 합니다.");
  }

  if (typeof getNodeByIdAsync !== "function") {
    throw new TypeError("Figma 노드 조회 함수가 필요합니다.");
  }

  const seenNodeIds = new Set();

  for (const element of screenSpec.elements) {
    const elementNodeId = element?.source?.nodeId;
    const elementType = element?.spec?.type;

    if (typeof elementNodeId !== "string" || !elementNodeId) {
      throw new Error("등록 요소의 nodeId가 필요합니다.");
    }

    if (seenNodeIds.has(elementNodeId)) {
      throw new Error(`등록 요소 nodeId가 중복되었습니다: ${elementNodeId}`);
    }
    seenNodeIds.add(elementNodeId);

    if (!schemaByType?.[elementType]) {
      throw new Error(`지원하지 않는 요소 유형입니다: ${elementType}`);
    }

    const node = await getNodeByIdAsync(elementNodeId);

    if (!node) {
      throw new Error(`등록한 요소 ${elementNodeId}를 찾을 수 없습니다.`);
    }

    if (!isNodeInsideScreen(node, screenNode)) {
      throw new Error(
        `등록한 요소 ${elementNodeId}가 현재 작업 화면 내부에 있지 않습니다.`
      );
    }
  }

  return screenSpec;
}

export async function saveScreenSpec({
  screenNode,
  screenId,
  stateScopeKey,
  meta,
  drafts,
  schemaByType,
  getNodeByIdAsync
}) {
  if (!screenNode || typeof screenNode.setPluginData !== "function") {
    throw new TypeError("저장할 화면 FRAME을 찾을 수 없습니다.");
  }

  if (typeof screenNode.setSharedPluginData !== "function") {
    throw new TypeError("화면 JSON 공유 저장을 지원하지 않는 Figma 환경입니다.");
  }

  if (typeof getNodeByIdAsync !== "function") {
    throw new TypeError("Figma 노드 조회 함수가 필요합니다.");
  }

  const elements = [];

  for (const draft of Array.isArray(drafts) ? drafts : []) {
    const node = await getNodeByIdAsync(draft.nodeId);

    if (!node) {
      throw new Error(`등록한 요소 ${draft.nodeId}를 찾을 수 없습니다.`);
    }

    const schema = schemaByType?.[draft.elementType];

    if (!schema) {
      throw new Error(`지원하지 않는 요소 유형입니다: ${draft.elementType}`);
    }

    elements.push({
      source: createElementSource(node),
      spec: serializeElementSpec(schema, draft.values)
    });
  }

  const normalizedStateScopeKey =
    stateScopeKey === undefined
      ? null
      : normalizeStateScopeKey(stateScopeKey);
  // 화면 meta는 로컬 JSON(AI 왕복)에서 작성되며, 플러그인 저장은 이를 보존한다.
  const hasMeta =
    meta !== null &&
    typeof meta === "object" &&
    !Array.isArray(meta) &&
    Object.keys(meta).length > 0;
  const screenSpec = {
    schemaVersion: SCREEN_SPEC_VERSION,
    screenId,
    ...(normalizedStateScopeKey
      ? { stateScopeKey: normalizedStateScopeKey }
      : {}),
    ...(hasMeta ? { meta } : {}),
    source: createScreenSource(screenNode),
    elements
  };

  const serializedScreenSpec = JSON.stringify(screenSpec);

  screenNode.setPluginData(
    SCREEN_SPEC_PLUGIN_DATA_KEY,
    serializedScreenSpec
  );
  screenNode.setSharedPluginData(
    SCREEN_SPEC_SHARED_PLUGIN_DATA_NAMESPACE,
    SCREEN_SPEC_SHARED_PLUGIN_DATA_KEY,
    serializedScreenSpec
  );

  return screenSpec;
}

function parseScreenSpec(value) {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value);

    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed
      : null;
  } catch {
    return null;
  }
}

export function restoreScreenSpec(screenNode) {
  if (!screenNode || typeof screenNode.getPluginData !== "function") {
    return null;
  }

  let sharedValue = "";

  if (typeof screenNode.getSharedPluginData === "function") {
    try {
      sharedValue = screenNode.getSharedPluginData(
        SCREEN_SPEC_SHARED_PLUGIN_DATA_NAMESPACE,
        SCREEN_SPEC_SHARED_PLUGIN_DATA_KEY
      );
    } catch {
      sharedValue = "";
    }
  }

  const sharedSpec = parseScreenSpec(sharedValue);

  if (sharedSpec) {
    const serializedSharedSpec = JSON.stringify(sharedSpec);

    if (
      typeof screenNode.setPluginData === "function" &&
      screenNode.getPluginData(SCREEN_SPEC_PLUGIN_DATA_KEY) !==
        serializedSharedSpec
    ) {
      try {
        screenNode.setPluginData(
          SCREEN_SPEC_PLUGIN_DATA_KEY,
          serializedSharedSpec
        );
      } catch {
        // 비공개 사본 동기화 실패가 공유 spec 복원을 막아서는 안 된다.
      }
    }

    return sharedSpec;
  }

  const privateSpec = parseScreenSpec(
    screenNode.getPluginData(SCREEN_SPEC_PLUGIN_DATA_KEY)
  );

  if (privateSpec && typeof screenNode.setSharedPluginData === "function") {
    try {
      screenNode.setSharedPluginData(
        SCREEN_SPEC_SHARED_PLUGIN_DATA_NAMESPACE,
        SCREEN_SPEC_SHARED_PLUGIN_DATA_KEY,
        JSON.stringify(privateSpec)
      );
    } catch {
      // 공유 이전 실패가 기존 비공개 spec 복원을 막아서는 안 된다.
    }
  }

  return privateSpec;
}

export function getScreenSpecFileName(screenSpec) {
  return `screens/${screenSpec.screenId}/screen.json`;
}

export function formatScreenSpecJson(screenSpec) {
  return `${JSON.stringify(screenSpec, null, 2)}\n`;
}
