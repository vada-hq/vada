import { DRAFT_SIGNALS } from "./screen-draft.mjs";

// fieldKey를 갖고 값을 담는 요소. 중복 검사와 참조 해석의 대상이다.
// 필수값 판정 후보(button-execution의 VALUE_FIELD_TYPES)와는 다른 집합이다 —
// list는 minItems로 개수를 정하지 결 required로 판정하지 않는다.
const FIELD_ELEMENT_TYPES = new Set(["input", "select", "list"]);

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function elementLabel(element, index) {
  const spec = element?.spec;
  const name = spec?.fieldKey ?? spec?.label ?? element?.source?.nodeId;
  return name ? `elements[${index}](${name})` : `elements[${index}]`;
}

export function collectDesignNodeIds(root, ids = new Set()) {
  if (!isObject(root)) {
    return ids;
  }
  if (typeof root.id === "string") {
    ids.add(root.id);
  }
  if (Array.isArray(root.children)) {
    for (const child of root.children) {
      collectDesignNodeIds(child, ids);
    }
  }
  return ids;
}

function findDesignNode(root, nodeId) {
  if (!isObject(root)) {
    return null;
  }
  if (root.id === nodeId) {
    return root;
  }
  for (const child of Array.isArray(root.children) ? root.children : []) {
    const found = findDesignNode(child, nodeId);
    if (found) {
      return found;
    }
  }
  return null;
}

function collectSubtreeText(node, parts = []) {
  if (!isObject(node)) {
    return parts;
  }
  if (typeof node.text?.content === "string") {
    parts.push(node.text.content);
  }
  for (const child of Array.isArray(node.children) ? node.children : []) {
    collectSubtreeText(child, parts);
  }
  return parts;
}

function normalizeForCompare(value) {
  // 라벨 끝의 필수 표시(*)는 required로 분리되어 spec.label에는 없다.
  return value.replace(/\s+/gu, "").replace(/\*$/u, "");
}

function collectSubtreeNodes(node, out = []) {
  if (!isObject(node)) {
    return out;
  }
  out.push(node);
  for (const child of Array.isArray(node.children) ? node.children : []) {
    collectSubtreeNodes(child, out);
  }
  return out;
}

// 하위 어딘가에 "합치면 정확히 이 텍스트가 되는" 노드가 있는지 본다.
// 부분 일치로 하면 placeholder가 라벨을 품기만 해도 통과한다
// (예: 라벨 '학교' ⊂ placeholder '학교명을 검색하세요').
function hasNodeWithExactText(root, expected) {
  const target = normalizeForCompare(expected);
  return collectSubtreeNodes(root).some(
    (node) => normalizeForCompare(collectSubtreeText(node).join("")) === target
  );
}

// 등록 노드 계약(element-types.md): nodeId는 요소의 모든 부분을 포함하는
// 가장 안쪽 노드다. 식별 텍스트가 하위 트리에 없으면 안쪽 컨트롤만 등록해
// 라벨·아이콘이 바깥에 남은 상태다.
function checkElementNodeCoverage(findings, context) {
  const { file, element, index, design } = context;
  const spec = element.spec;
  // label을 쓰는 유형(input·select·button)과 title을 쓰는 유형(group·summary·
  // itemList)이 섞여 있다. 새 유형이 생길 때마다 여기를 고치지 않도록 둘 다 본다.
  const identifyingText = spec.label ?? spec.title;
  const nodeId = element.source?.nodeId;

  if (
    typeof identifyingText !== "string" ||
    !identifyingText.trim() ||
    typeof nodeId !== "string"
  ) {
    return;
  }

  const node = findDesignNode(design.root, nodeId);
  if (!node) {
    // nodeId 부재는 별도 검사가 이미 보고한다.
    return;
  }

  if (!hasNodeWithExactText(node, identifyingText)) {
    findings.push({
      level: "error",
      file,
      message: `${elementLabel(element, index)}의 nodeId '${nodeId}'(${node.name})가 요소 전체를 대표하지 않습니다. 식별 텍스트 '${identifyingText}'가 이 노드 안에 없습니다. 라벨과 컨트롤을 모두 포함하는 노드로 등록하세요.`
    });
  }
}

// design에 있는데 명세에 없는 것을 본다.
//
// 지금까지 대조는 **한 방향**이었다 — 명세가 가리키는 자리를 화면이 그렸는가.
// 그래서 명세 자체의 구멍은 통과했다. TASK-01의 design `18:86`('업무 추가')이
// 명세에도 화면에도 없었는데 어떤 검사도 이를 잡지 못했고, EVT-00A 사이클에서
// 헤더에 자리를 내다가 우연히 드러났다.
//
// 보는 것은 **상호작용 노드**뿐이다(Btn·Button·Text Input·Dropdown). 이름이 곧
// 신호라 판정이 흔들리지 않고, 빠지면 화면의 동작이 통째로 사라진다. 되풀이나
// 카드처럼 읽는 방법이 여럿인 것은 여기서 세지 않는다 — 초안 추출기가 질문한다.
//
// 등록 요소의 하위 트리에 든 것은 그 요소의 내부다(목록 항목의 버튼, 선택지 묶음의
// 버튼). 문구 없는 노드도 세지 않는다 — 명세에 적을 라벨이 없다(선택지가 디자인에
// 비어 있는 드롭다운, 항목의 '…' 메뉴).
function checkDesignInteractionCoverage(findings, file, spec, design, shell) {
  const excluded = new Set(
    Array.isArray(shell?.design?.excludeNodeNames) ? shell.design.excludeNodeNames : []
  );
  const registered = new Set(
    spec.elements
      .map((element) => element?.source?.nodeId)
      .filter((nodeId) => typeof nodeId === "string")
  );
  // 작업 공간의 갈피 줄도 등록 노드다. 무엇을 그리는지는 셸이 알고 화면은 어디에
  // 그리는지만 아는데, 그 '어디'가 없으면 갈피 일곱이 명세에 없는 것으로 보인다.
  for (const nodeId of Object.values(spec.workspace?.source ?? {})) {
    if (typeof nodeId === "string") {
      registered.add(nodeId);
    }
  }
  const isInteraction = (node) =>
    DRAFT_SIGNALS.BUTTON_NAME_PATTERN.test(node.name ?? "") ||
    DRAFT_SIGNALS.CONTROL_NAMES.has(node.name ?? "");

  const walk = (node, covered) => {
    for (const child of Array.isArray(node?.children) ? node.children : []) {
      if (excluded.has(child.name)) {
        continue;
      }
      const inside = covered || registered.has(child.id);
      if (!inside && isInteraction(child)) {
        const drawn = collectSubtreeText(child).join("").trim();
        if (drawn) {
          findings.push({
            level: "error",
            file,
            message: `design의 '${drawn}'(${child.id} ${child.name})이 명세에 없습니다. 등록된 어느 요소 안에도 들어 있지 않습니다 — 화면의 동작이라면 요소로 등록하고, 다른 요소의 내부 조작이라면 그 요소의 nodeId가 이것을 품어야 합니다.`
          });
        }
      }
      walk(child, inside);
    }
  };
  walk(design.root, false);
}

function checkScreenAgainstDesign(findings, screen, designEntry, shell) {
  const { file, spec } = screen;
  const design = designEntry?.design;
  if (!isObject(design)) {
    return;
  }

  if (design.screenId !== spec.screenId) {
    findings.push({
      level: "error",
      file: designEntry.file,
      message: `figma.design.json의 screenId(${design.screenId})가 화면(${spec.screenId})과 다릅니다.`
    });
  }

  // 화면 폴더의 신원(브리지가 쓰는 앵커)이 어긋나면 이후 저장이 409로 막힌다.
  if (
    typeof spec.source?.nodeId === "string" &&
    typeof design.root?.id === "string" &&
    spec.source.nodeId !== design.root.id
  ) {
    findings.push({
      level: "error",
      file,
      message: `화면 source.nodeId '${spec.source.nodeId}'가 figma.design.json의 루트 '${design.root.id}'와 다릅니다.`
    });
  }

  const nodeIds = collectDesignNodeIds(design.root);
  spec.elements.forEach((element, index) => {
    const nodeId = element?.source?.nodeId;
    if (typeof nodeId === "string" && !nodeIds.has(nodeId)) {
      findings.push({
        level: "error",
        file,
        message: `${elementLabel(element, index)}의 nodeId '${nodeId}'가 figma.design.json에 없습니다.`
      });
      return;
    }
    if (isObject(element?.spec)) {
      checkElementNodeCoverage(findings, { file, element, index, design });
    }
  });

  checkDesignInteractionCoverage(findings, file, spec, design, shell);

  const assetFiles = new Set(designEntry.assetFiles ?? []);
  for (const asset of Array.isArray(design.assets) ? design.assets : []) {
    const fileName = String(asset?.file ?? "").replace(/^assets\//, "");
    if (fileName && !assetFiles.has(fileName)) {
      findings.push({
        level: "error",
        file: designEntry.file,
        message: `자산 파일 '${asset.file}'이 assets 폴더에 없습니다.`
      });
    }
  }

  if (designEntry.hasReference === false) {
    findings.push({
      level: "warning",
      file: designEntry.file,
      message: "검증 기준 reference.png가 없습니다."
    });
  }
}

function checkOptionsSource(findings, context) {
  const { file, element, index, optionSources, sourceByKey, fieldKeys } = context;
  const optionsSource = element.spec.optionsSource;
  if (!isObject(optionsSource) || typeof optionsSource.key !== "string") {
    return;
  }

  if (!isObject(optionSources)) {
    findings.push({
      level: "warning",
      file,
      message: `option-sources.json이 없어 ${elementLabel(element, index)}의 출처 '${optionsSource.key}'를 확인하지 못했습니다.`
    });
    return;
  }

  const catalogSource = sourceByKey.get(optionsSource.key);
  if (!catalogSource) {
    findings.push({
      level: "error",
      file,
      message: `${elementLabel(element, index)}의 선택지 출처 '${optionsSource.key}'가 카탈로그에 없습니다.`
    });
    return;
  }

  const requiredParams = Array.isArray(catalogSource.params)
    ? catalogSource.params
    : [];
  const mapping = isObject(optionsSource.params) ? optionsSource.params : {};

  for (const param of requiredParams) {
    if (!(param in mapping)) {
      findings.push({
        level: "error",
        file,
        message: `${elementLabel(element, index)}의 출처 '${optionsSource.key}'에 필요한 인자 '${param}' 매핑이 없습니다.`
      });
    }
  }
  for (const [param, fieldKey] of Object.entries(mapping)) {
    if (!requiredParams.includes(param)) {
      findings.push({
        level: "error",
        file,
        message: `${elementLabel(element, index)}가 출처 '${optionsSource.key}'에 없는 인자 '${param}'를 매핑했습니다.`
      });
    }
    if (!fieldKeys.has(fieldKey)) {
      findings.push({
        level: "error",
        file,
        message: `${elementLabel(element, index)}의 인자 '${param}'가 참조한 fieldKey '${fieldKey}'가 화면에 없습니다.`
      });
    }
  }
}

// 화면들이 선언한 상태 스코프별로, 그 스코프에 값을 쓰는 fieldKey 집합을 모은다.
// note는 다른 화면의 스코프를 읽으므로 화면 단위가 아니라 wireframe 단위로 봐야 한다.
function collectFieldKeysByScope(screens) {
  const fieldKeysByScope = new Map();

  for (const screen of screens) {
    const spec = screen?.spec;
    const scopeKey = spec?.stateScopeKey;
    if (typeof scopeKey !== "string" || !Array.isArray(spec.elements)) {
      continue;
    }

    const fieldKeys = fieldKeysByScope.get(scopeKey) ?? new Set();
    for (const element of spec.elements) {
      const elementSpec = element?.spec;
      if (
        isObject(elementSpec) &&
        FIELD_ELEMENT_TYPES.has(elementSpec.type) &&
        typeof elementSpec.fieldKey === "string"
      ) {
        fieldKeys.add(elementSpec.fieldKey);
      }
    }
    fieldKeysByScope.set(scopeKey, fieldKeys);
  }

  return fieldKeysByScope;
}

function checkNoteFieldRefs(findings, context) {
  const { file, element, index, stateScopes, scopeKeys, fieldKeysByScope } =
    context;
  const fieldRefs = element.spec.fieldRefs;

  if (!Array.isArray(fieldRefs)) {
    return;
  }

  for (const fieldRef of fieldRefs) {
    const scope = fieldRef?.scope;
    const fieldKey = fieldRef?.fieldKey;
    if (typeof scope !== "string" || typeof fieldKey !== "string") {
      continue;
    }

    if (!isObject(stateScopes)) {
      findings.push({
        level: "warning",
        file,
        message: `state-scopes.json이 없어 ${elementLabel(element, index)}의 참조 스코프 '${scope}'를 확인하지 못했습니다.`
      });
      continue;
    }

    if (!scopeKeys.has(scope)) {
      findings.push({
        level: "error",
        file,
        message: `${elementLabel(element, index)}가 참조한 상태 스코프 '${scope}'가 카탈로그에 없습니다.`
      });
      continue;
    }

    if (!(fieldKeysByScope.get(scope)?.has(fieldKey) ?? false)) {
      findings.push({
        level: "error",
        file,
        message: `${elementLabel(element, index)}가 참조한 '${fieldKey}'를 상태 스코프 '${scope}'의 어느 화면도 쓰지 않습니다.`
      });
    }
  }
}

function checkGroupMembers(findings, context) {
  const { file, element, index, fieldKeys, groupedFieldKeys } = context;
  const memberFieldKeys = element.spec.memberFieldKeys;

  if (!Array.isArray(memberFieldKeys)) {
    return;
  }

  for (const fieldKey of memberFieldKeys) {
    if (typeof fieldKey !== "string") {
      continue;
    }

    if (!fieldKeys.has(fieldKey)) {
      findings.push({
        level: "error",
        file,
        message: `${elementLabel(element, index)}가 묶은 fieldKey '${fieldKey}'가 화면에 없습니다.`
      });
      continue;
    }

    // 한 필드가 두 묶음에 속하면 어느 묶음 안에 그릴지가 모호해진다.
    if (groupedFieldKeys.has(fieldKey)) {
      findings.push({
        level: "error",
        file,
        message: `${elementLabel(element, index)}의 fieldKey '${fieldKey}'가 이미 다른 묶음에 속합니다.`
      });
      continue;
    }
    groupedFieldKeys.add(fieldKey);
  }
}

function checkListReferences(findings, context) {
  const { file, element, index, fieldKeys } = context;
  const { initialItems, minItems, maxItems } = element.spec;

  if (typeof minItems === "number" && typeof maxItems === "number" && minItems > maxItems) {
    findings.push({
      level: "error",
      file,
      message: `${elementLabel(element, index)}의 minItems(${minItems})가 maxItems(${maxItems})보다 큽니다.`
    });
  }

  if (isObject(initialItems) && typeof initialItems.fieldKey === "string") {
    if (!fieldKeys.has(initialItems.fieldKey)) {
      findings.push({
        level: "error",
        file,
        message: `${elementLabel(element, index)}의 initialItems가 참조한 fieldKey '${initialItems.fieldKey}'가 화면에 없습니다.`
      });
    }
    const counts = Object.values(
      isObject(initialItems.byValue) ? initialItems.byValue : {}
    );
    for (const items of counts) {
      if (Array.isArray(items) && typeof maxItems === "number" && items.length > maxItems) {
        findings.push({
          level: "error",
          file,
          message: `${elementLabel(element, index)}의 초기 항목 ${items.length}개가 maxItems(${maxItems})를 넘습니다.`
        });
      }
    }
  }
}

function checkSubmitAction(findings, context) {
  const { file, element, index, mutations, mutationKeys, scopeKeys, stateScopes } = context;
  const action = element.spec.action;

  if (!isObject(action) || action.type !== "submit") {
    return;
  }

  if (typeof action.mutationKey === "string") {
    if (!isObject(mutations)) {
      findings.push({
        level: "warning",
        file,
        message: `mutations.json이 없어 ${elementLabel(element, index)}의 제출 계약 '${action.mutationKey}'를 확인하지 못했습니다.`
      });
    } else if (!mutationKeys.has(action.mutationKey)) {
      findings.push({
        level: "error",
        file,
        message: `${elementLabel(element, index)}의 제출 계약 '${action.mutationKey}'가 카탈로그에 없습니다.`
      });
    }
  }

  // 스코프 이벤트는 그 화면이 참조하는 스코프의 수명을 끝낸다.
  const scopeEvent = action.onSuccess?.scopeEvent;
  if (typeof scopeEvent === "string" && isObject(stateScopes)) {
    const screenScope = context.screenScopeKey;
    if (!screenScope) {
      findings.push({
        level: "error",
        file,
        message: `${elementLabel(element, index)}가 scopeEvent '${scopeEvent}'를 내지만 화면에 stateScopeKey가 없습니다.`
      });
    } else if (!scopeKeys.has(screenScope)) {
      // 화면 스코프 자체의 오류는 별도 검사가 이미 보고한다.
    } else if (!(context.clearOnByScope.get(screenScope) ?? []).includes(scopeEvent)) {
      findings.push({
        level: "error",
        file,
        message: `${elementLabel(element, index)}의 scopeEvent '${scopeEvent}'가 상태 스코프 '${screenScope}'의 clearOn에 없습니다.`
      });
    }
  }
}

// 플러그인은 스키마 선언 순서로 화면 JSON을 쓴다. 손으로 쓴 파일의 순서가
// 다르면 Figma에서 저장할 때마다 순서만 바뀐 diff가 나오고, "저장 후 diff가
// 비어 있다"를 왕복 보존의 신호로 쓸 수 없게 된다. 값이 아니라 표현의 문제라
// 기계적으로 고칠 수 있고, 그래서 경고가 아니라 오류다.
function checkPropertyOrder(findings, context) {
  const { file, element, index, propertyOrderByType } = context;
  const declaredOrder = propertyOrderByType?.[element.spec.type];

  if (!Array.isArray(declaredOrder)) {
    return;
  }

  const actual = Object.keys(element.spec);
  const expected = declaredOrder.filter((key) => actual.includes(key));

  if (actual.length !== expected.length || actual.some((key, at) => key !== expected[at])) {
    findings.push({
      level: "error",
      file,
      message: `${elementLabel(element, index)}의 속성 순서가 ${element.spec.type}.schema.json 선언 순서와 다릅니다. 기대: ${expected.join(", ")}`
    });
  }
}

// summary·itemList가 가리키는 데이터 출처는 카탈로그에 있어야 하고, 모양이
// 맞아야 한다. summary는 값 묶음 하나(object), itemList는 반복 항목(list)이다.
function checkDataSource(findings, context) {
  const { file, element, index, dataSources, dataSourceByKey } = context;
  const spec = element.spec;
  const key = spec.dataSourceKey;

  if (typeof key !== "string") {
    // 출처가 없으면 값은 명세에 담긴 예시다. field를 가리킬 수는 없다.
    const withField = (spec.items ?? []).filter((item) => item?.field !== undefined);
    if (
      spec.titleField !== undefined ||
      spec.descriptionField !== undefined ||
      withField.length > 0
    ) {
      findings.push({
        level: "error",
        file,
        message: `${elementLabel(element, index)}가 dataSourceKey 없이 field를 가리킵니다.`
      });
    }
    return;
  }

  if (!isObject(dataSources)) {
    findings.push({
      level: "warning",
      file,
      message: `data-sources.json이 없어 ${elementLabel(element, index)}의 데이터 출처 '${key}'를 확인하지 못했습니다.`
    });
    return;
  }

  const source = dataSourceByKey.get(key);
  if (!source) {
    findings.push({
      level: "error",
      file,
      message: `${elementLabel(element, index)}의 데이터 출처 '${key}'가 카탈로그에 없습니다.`
    });
    return;
  }

  const expectedShape = spec.type === "itemList" ? "list" : "object";
  if (source.shape !== expectedShape) {
    findings.push({
      level: "error",
      file,
      message: `${elementLabel(element, index)}(${spec.type})는 shape가 '${expectedShape}'인 출처를 써야 하는데 '${key}'는 '${source.shape}'입니다.`
    });
  }

  const fieldKeys = new Set((source.fields ?? []).map((field) => field.key));
  const referenced = [
    ...(spec.titleField === undefined ? [] : [spec.titleField]),
    ...(spec.descriptionField === undefined ? [] : [spec.descriptionField]),
    ...(spec.items ?? []).map((item) => item?.field).filter((field) => field !== undefined)
  ];
  for (const field of referenced) {
    if (!fieldKeys.has(field)) {
      findings.push({
        level: "error",
        file,
        message: `${elementLabel(element, index)}가 가리킨 조각 '${field}'가 데이터 출처 '${key}'에 없습니다.`
      });
    }
  }
}

// 조회에 넘기는 값이 어디서 오는지 검사한다. 인자 이름은 카탈로그가, 그 값을
// 담은 필드는 화면이 갖는다 — 둘 중 하나만 틀려도 조용히 안 걸러진다.
function checkQueryParams(findings, context) {
  const { file, element, index, dataSources, dataSourceByKey, fieldKeys, screenParams } =
    context;
  const spec = element.spec;
  const params = spec.params;

  if (!isObject(params)) {
    return;
  }

  const source = isObject(dataSources) ? dataSourceByKey.get(spec.dataSourceKey) : null;
  const declared = new Set(source ? source.params ?? [] : []);

  for (const [paramName, argument] of Object.entries(params)) {
    if (source && !declared.has(paramName)) {
      findings.push({
        level: "error",
        file,
        message: `${elementLabel(element, index)}가 넘긴 조회 인자 '${paramName}'가 데이터 출처 '${spec.dataSourceKey}'에 선언돼 있지 않습니다.`
      });
    }
    // 고정값(value)은 명세가 정한 것이라 참조할 필드가 없다.
    const fieldKey = isObject(argument) ? argument.fieldKey : argument;
    if (typeof fieldKey === "string" && !fieldKeys.has(fieldKey)) {
      findings.push({
        level: "error",
        file,
        message: `${elementLabel(element, index)}의 조회 인자 '${paramName}'가 참조한 fieldKey '${fieldKey}'가 화면에 없습니다.`
      });
    }
    // 화면이 밖에서 받은 인자. 선언하지 않은 것을 가리키면 상세 화면이 아무것도
    // 못 집어 오고, 그 사실이 조용하다 — 화면에 필드가 없는 것이 정상이기 때문이다.
    const screenParam = isObject(argument) ? argument.screenParam : undefined;
    if (typeof screenParam === "string" && !screenParams.has(screenParam)) {
      findings.push({
        level: "error",
        file,
        message: `${elementLabel(element, index)}의 조회 인자 '${paramName}'가 화면 인자 '${screenParam}'를 가리키는데 화면의 params에 없습니다.`
      });
    }
    // 목록을 조회하는 시점에는 아직 항목이 없다. 자기가 받아 올 행을 가리켜
    // 조회할 수는 없으므로 itemField는 여기서 뜻이 없다.
    if (isObject(argument) && typeof argument.itemField === "string") {
      findings.push({
        level: "error",
        file,
        message: `${elementLabel(element, index)}의 조회 인자 '${paramName}'가 항목의 조각(itemField)을 가리킵니다. 조회하는 시점에는 아직 항목이 없습니다 — 항목의 조각은 눌렸을 때의 동작(action.params)에서만 쓸 수 있습니다.`
      });
    }
  }
}

// 이동하면서 넘기는 인자.
//
// 화면이 인자를 받으면(screen.params) 누군가는 그 값을 줘야 한다. 주지 않으면
// 대상 화면은 오류 카드를 띄우고 끝나는데, **그 사실이 명세를 읽어서는 보이지
// 않는다** — 이동은 성공하고 화면만 비기 때문이다. 그래서 여기서 본다.
function checkNavigateParams(findings, context) {
  const { file, element, index, dataSourceByKey, fieldKeys, screenParams, screenParamsById } =
    context;
  const spec = element.spec;

  const actions = [
    { at: "action", action: spec.action },
    { at: "itemAction", action: spec.itemAction }
  ].filter(({ action }) => isObject(action));

  for (const { at, action } of actions) {
    const params = action.params;
    const target = action.targetScreenId;
    const targetParams = screenParamsById?.get(target) ?? null;
    const label = elementLabel(element, index);

    if (isObject(params) && action.type !== "navigate") {
      findings.push({
        level: "error",
        file,
        message: `${label}의 ${at}이 이동하지 않는데 인자를 넘깁니다(type=${action.type}). 받을 화면이 없습니다.`
      });
      continue;
    }

    // 항목의 조각은 눌린 행이 있는 자리에서만 가리킬 것이 있다.
    const rowFields =
      at === "itemAction" && spec.type === "itemList"
        ? new Set((dataSourceByKey.get(spec.dataSourceKey)?.fields ?? []).map((f) => f?.key))
        : null;

    for (const [paramName, argument] of Object.entries(isObject(params) ? params : {})) {
      if (targetParams && !targetParams.has(paramName)) {
        findings.push({
          level: "error",
          file,
          message: `${label}이 이동하며 넘긴 인자 '${paramName}'를 대상 화면 '${target}'이 받지 않습니다(그 화면의 params에 없습니다).`
        });
      }
      if (!isObject(argument)) {
        continue;
      }
      if (typeof argument.fieldKey === "string" && !fieldKeys.has(argument.fieldKey)) {
        findings.push({
          level: "error",
          file,
          message: `${label}의 이동 인자 '${paramName}'가 참조한 fieldKey '${argument.fieldKey}'가 화면에 없습니다.`
        });
      }
      if (typeof argument.screenParam === "string" && !screenParams.has(argument.screenParam)) {
        findings.push({
          level: "error",
          file,
          message: `${label}의 이동 인자 '${paramName}'가 화면 인자 '${argument.screenParam}'를 가리키는데 화면의 params에 없습니다.`
        });
      }
      if (typeof argument.itemField === "string") {
        if (rowFields === null) {
          findings.push({
            level: "error",
            file,
            message: `${label}의 이동 인자 '${paramName}'가 항목의 조각(itemField)을 가리키는데 이 자리에는 눌린 항목이 없습니다. 항목의 조각은 itemList의 itemAction에서만 쓸 수 있습니다.`
          });
        } else if (rowFields.size > 0 && !rowFields.has(argument.itemField)) {
          findings.push({
            level: "error",
            file,
            message: `${label}의 이동 인자 '${paramName}'가 항목의 조각 '${argument.itemField}'를 가리키는데 데이터 출처 '${spec.dataSourceKey}'에 그 조각이 없습니다.`
          });
        }
      }
    }

    // 대상이 받는데 아무도 주지 않으면 그 화면은 열리자마자 비어 있다.
    if (action.type === "navigate" && targetParams) {
      const given = new Set(Object.keys(isObject(params) ? params : {}));
      const missing = [...targetParams].filter((name) => !given.has(name));
      if (missing.length > 0) {
        findings.push({
          level: "error",
          file,
          message: `${label}이 화면 '${target}'으로 이동하는데 그 화면이 받는 인자 ${missing.map((name) => `'${name}'`).join(", ")}를 넘기지 않습니다. 넘기지 않으면 그 화면은 무엇을 보여줄지 알 수 없습니다.`
        });
      }
    }
  }
}

// 선택지는 명세가, 각 선택지의 건수는 데이터가 정한다. 둘을 잇는 것은 value와
// fields[].key의 일치뿐이라 검사하지 않으면 배지가 통째로 비어도 알 수 없다.
function checkOptionCounts(findings, context) {
  const { file, element, index, optionSources, sourceByKey, dataSources, dataSourceByKey } =
    context;
  const spec = element.spec;
  const counts = spec.optionCounts;

  if (!isObject(counts)) {
    return;
  }

  if (!isObject(dataSources)) {
    findings.push({
      level: "warning",
      file,
      message: `data-sources.json이 없어 ${elementLabel(element, index)}의 개수 출처 '${counts.dataSourceKey}'를 확인하지 못했습니다.`
    });
    return;
  }

  const source = dataSourceByKey.get(counts.dataSourceKey);
  if (!source) {
    findings.push({
      level: "error",
      file,
      message: `${elementLabel(element, index)}의 개수 출처 '${counts.dataSourceKey}'가 카탈로그에 없습니다.`
    });
    return;
  }

  if (source.shape !== "object") {
    findings.push({
      level: "error",
      file,
      message: `${elementLabel(element, index)}의 개수 출처 '${counts.dataSourceKey}'는 shape가 'object'여야 하는데 '${source.shape}'입니다.`
    });
    return;
  }

  const optionSource = isObject(optionSources)
    ? sourceByKey.get(spec.optionsSource?.key)
    : null;
  if (!optionSource || !Array.isArray(optionSource.options)) {
    return;
  }

  const countFields = new Set((source.fields ?? []).map((field) => field.key));
  for (const option of optionSource.options) {
    const value = option?.value;
    if (value !== undefined && !countFields.has(String(value))) {
      findings.push({
        level: "error",
        file,
        message: `${elementLabel(element, index)}의 개수 출처 '${counts.dataSourceKey}'에 선택지 '${value}'의 조각이 없습니다.`
      });
    }
  }
}

function checkFieldReferences(findings, context) {
  const { file, element, index, fieldKeys } = context;
  const { enabledWhen, resetOnChangeOf } = element.spec;

  if (Array.isArray(enabledWhen)) {
    for (const condition of enabledWhen) {
      const fieldKey = condition?.fieldKey;
      if (typeof fieldKey === "string" && !fieldKeys.has(fieldKey)) {
        findings.push({
          level: "error",
          file,
          message: `${elementLabel(element, index)}의 enabledWhen이 참조한 fieldKey '${fieldKey}'가 화면에 없습니다.`
        });
      }
    }
  }
  if (Array.isArray(resetOnChangeOf)) {
    for (const fieldKey of resetOnChangeOf) {
      if (typeof fieldKey === "string" && !fieldKeys.has(fieldKey)) {
        findings.push({
          level: "error",
          file,
          message: `${elementLabel(element, index)}의 resetOnChangeOf가 참조한 fieldKey '${fieldKey}'가 화면에 없습니다.`
        });
      }
    }
  }
}

export function collectSpecFindings({
  screens = [],
  optionSources = null,
  dataSources = null,
  stateScopes = null,
  designs = {},
  flows = null,
  flowsFile = "flows.json",
  mutations = null,
  mutationsFile = "mutations.json",
  shell = null,
  shellFile = "shell.json",
  propertyOrderByType = null
} = {}) {
  const findings = [];
  const screenIds = new Set(
    screens
      .map((screen) => screen?.spec?.screenId)
      .filter((screenId) => typeof screenId === "string")
  );
  // 화면마다 '받는 인자'. 이동하는 쪽이 무엇을 넘겨야 하는지 여기서만 알 수 있다.
  const screenParamsById = new Map(
    screens
      .filter((screen) => typeof screen?.spec?.screenId === "string")
      .map((screen) => [
        screen.spec.screenId,
        new Set(
          (Array.isArray(screen.spec.params) ? screen.spec.params : [])
            .map((param) => param?.key)
            .filter((key) => typeof key === "string")
        )
      ])
  );
  const sourceByKey = new Map(
    (isObject(optionSources) && Array.isArray(optionSources.sources)
      ? optionSources.sources
      : []
    ).map((source) => [source.key, source])
  );
  const dataSourceByKey = new Map(
    (isObject(dataSources) && Array.isArray(dataSources.sources)
      ? dataSources.sources
      : []
    ).map((source) => [source.key, source])
  );
  const scopeKeys = new Set(
    (isObject(stateScopes) && Array.isArray(stateScopes.scopes)
      ? stateScopes.scopes
      : []
    ).map((scope) => scope.key)
  );
  const fieldKeysByScope = collectFieldKeysByScope(screens);
  const scopeList =
    isObject(stateScopes) && Array.isArray(stateScopes.scopes) ? stateScopes.scopes : [];
  const clearOnByScope = new Map(
    scopeList.map((scope) => [scope.key, Array.isArray(scope.clearOn) ? scope.clearOn : []])
  );
  const mutationList =
    isObject(mutations) && Array.isArray(mutations.mutations) ? mutations.mutations : [];
  const mutationKeys = new Set(mutationList.map((mutation) => mutation.key));

  // 제출 계약이 참조하는 payload 스코프는 카탈로그에 있어야 한다.
  for (const mutation of mutationList) {
    if (typeof mutation?.payloadScope === "string" && !scopeKeys.has(mutation.payloadScope)) {
      findings.push({
        level: "error",
        file: mutationsFile,
        message: `제출 계약 '${mutation.key}'의 payloadScope '${mutation.payloadScope}'가 상태 스코프 카탈로그에 없습니다.`
      });
    }
  }

  for (const screen of screens) {
    const { file, spec } = screen;
    if (!isObject(spec) || !Array.isArray(spec.elements)) {
      continue;
    }

    // 위치에서 기대 screenId를 얻는다: screens/<screenId>/screen.json 또는
    // (과거 형태) screens/<screenId>.json 모두 지원한다.
    const segments = String(file).split("/");
    const screensIndex = segments.lastIndexOf("screens");
    const locationId =
      screensIndex >= 0 && segments.length > screensIndex + 1
        ? segments[screensIndex + 1].replace(/\.json$/u, "")
        : undefined;
    if (
      typeof spec.screenId === "string" &&
      locationId &&
      locationId !== spec.screenId
    ) {
      findings.push({
        level: "error",
        file,
        message: `screenId '${spec.screenId}'가 위치 '${locationId}'과 다릅니다.`
      });
    }

    if (typeof spec.stateScopeKey === "string") {
      if (!isObject(stateScopes)) {
        findings.push({
          level: "warning",
          file,
          message: `state-scopes.json이 없어 상태 스코프 '${spec.stateScopeKey}'를 확인하지 못했습니다.`
        });
      } else if (!scopeKeys.has(spec.stateScopeKey)) {
        findings.push({
          level: "error",
          file,
          message: `상태 스코프 '${spec.stateScopeKey}'가 카탈로그에 없습니다.`
        });
      }
    }

    // 작업 공간. 화면은 key만 가리키므로, 가리킨 곳이 없거나 그 공간이 요구하는
    // 인자를 화면이 받지 않으면 **제목과 상태 줄이 통째로 빈다** — 요소가 아니라
    // 아무도 안 본다.
    const workspace = isObject(spec.workspace) ? spec.workspace : null;
    if (workspace) {
      const declared = (isObject(shell) && Array.isArray(shell.workspaces)
        ? shell.workspaces
        : []
      ).find((candidate) => candidate?.key === workspace.key);
      if (!isObject(shell) || !Array.isArray(shell.workspaces)) {
        findings.push({
          level: "warning",
          file,
          message: `shell.json에 작업 공간 목록이 없어 '${workspace.key}'를 확인하지 못했습니다.`
        });
      } else if (!declared) {
        findings.push({
          level: "error",
          file,
          message: `작업 공간 '${workspace.key}'가 shell.json에 없습니다.`
        });
      } else {
        const screenParamKeys = new Set(
          (Array.isArray(spec.params) ? spec.params : [])
            .map((param) => param?.key)
            .filter((key) => typeof key === "string")
        );
        if (!screenParamKeys.has(declared.param)) {
          findings.push({
            level: "error",
            file,
            message: `작업 공간 '${workspace.key}'는 인자 '${declared.param}'로 무엇의 공간인지를 정하는데 이 화면이 그것을 받지 않습니다(params에 없습니다).`
          });
        }
        // 갈피가 이 화면을 가리키는지. 없으면 갈피 줄에 지금 자리가 표시되지 않는다.
        const here = (declared.tabs ?? []).filter(
          (item) => item?.targetScreenId === spec.screenId
        );
        if (here.length === 0) {
          findings.push({
            level: "warning",
            file,
            message: `작업 공간 '${workspace.key}'의 갈피 중 이 화면을 가리키는 것이 없습니다. 갈피 줄이 지금 어디인지 표시하지 못합니다.`
          });
        } else if (here.length > 1) {
          findings.push({
            level: "error",
            file,
            message: `작업 공간 '${workspace.key}'의 갈피 ${here.length}개가 같은 화면 '${spec.screenId}'을 가리킵니다.`
          });
        }
      }
    }

    // 제목이 데이터에서 오는 화면. 요소가 아니라 화면 자체가 값을 읽으므로
    // 요소 검사가 지나치고, 지나치면 없는 조각을 가리켜도 제목만 조용히 빈다.
    const titleFrom = isObject(spec.meta) ? spec.meta.titleFrom : null;
    if (isObject(titleFrom)) {
      const screenParamKeys = new Set(
        (Array.isArray(spec.params) ? spec.params : [])
          .map((param) => param?.key)
          .filter((key) => typeof key === "string")
      );
      const source = dataSourceByKey.get(titleFrom.dataSourceKey);
      if (!isObject(dataSources)) {
        findings.push({
          level: "warning",
          file,
          message: `data-sources.json이 없어 화면 제목의 출처 '${titleFrom.dataSourceKey}'를 확인하지 못했습니다.`
        });
      } else if (!source) {
        findings.push({
          level: "error",
          file,
          message: `화면 제목의 데이터 출처 '${titleFrom.dataSourceKey}'가 카탈로그에 없습니다.`
        });
      } else {
        if (source.shape !== "object") {
          findings.push({
            level: "error",
            file,
            message: `화면 제목의 데이터 출처 '${titleFrom.dataSourceKey}'는 shape가 '${source.shape}'입니다. 제목은 값 하나이므로 object여야 합니다.`
          });
        }
        const sourceFields = new Set((source.fields ?? []).map((field) => field?.key));
        if (!sourceFields.has(titleFrom.field)) {
          findings.push({
            level: "error",
            file,
            message: `화면 제목이 가리킨 조각 '${titleFrom.field}'가 데이터 출처 '${titleFrom.dataSourceKey}'에 없습니다.`
          });
        }
        const declared = new Set(source.params ?? []);
        for (const [paramName, argument] of Object.entries(titleFrom.params ?? {})) {
          if (!declared.has(paramName)) {
            findings.push({
              level: "error",
              file,
              message: `화면 제목이 넘긴 조회 인자 '${paramName}'가 데이터 출처 '${titleFrom.dataSourceKey}'에 선언돼 있지 않습니다.`
            });
          }
          const screenParam = isObject(argument) ? argument.screenParam : undefined;
          if (typeof screenParam === "string" && !screenParamKeys.has(screenParam)) {
            findings.push({
              level: "error",
              file,
              message: `화면 제목의 조회 인자 '${paramName}'가 화면 인자 '${screenParam}'를 가리키는데 화면의 params에 없습니다.`
            });
          }
        }
      }
    }

    const fieldKeys = new Set();
    const seenFieldKeys = new Set();
    const seenNodeIds = new Set();
    spec.elements.forEach((element, index) => {
      const nodeId = element?.source?.nodeId;
      if (typeof nodeId === "string") {
        if (seenNodeIds.has(nodeId)) {
          findings.push({
            level: "error",
            file,
            message: `${elementLabel(element, index)}의 nodeId '${nodeId}'가 다른 요소와 중복됩니다.`
          });
        }
        seenNodeIds.add(nodeId);
      }

      const spec_ = element?.spec;
      if (isObject(spec_) && FIELD_ELEMENT_TYPES.has(spec_.type)) {
        const fieldKey = spec_.fieldKey;
        if (typeof fieldKey === "string") {
          if (seenFieldKeys.has(fieldKey)) {
            findings.push({
              level: "error",
              file,
              message: `${elementLabel(element, index)}의 fieldKey '${fieldKey}'가 다른 요소와 중복됩니다.`
            });
          }
          seenFieldKeys.add(fieldKey);
          fieldKeys.add(fieldKey);
        }
      }
    });

    const groupedFieldKeys = new Set();
    spec.elements.forEach((element, index) => {
      const spec_ = element?.spec;
      if (!isObject(spec_)) {
        return;
      }
      const context = {
        file,
        element,
        index,
        optionSources,
        sourceByKey,
        dataSources,
        dataSourceByKey,
        fieldKeys,
        stateScopes,
        scopeKeys,
        fieldKeysByScope,
        groupedFieldKeys,
        mutations,
        mutationKeys,
        clearOnByScope,
        screenScopeKey: spec.stateScopeKey,
        // 이 화면이 밖에서 받는 인자. 상세 화면만 갖는다.
        screenParams: new Set(
          (Array.isArray(spec.params) ? spec.params : [])
            .map((param) => param?.key)
            .filter((key) => typeof key === "string")
        ),
        screenParamsById,
        propertyOrderByType
      };
      checkPropertyOrder(findings, context);
      if (spec_.type === "select") {
        checkOptionsSource(findings, context);
      }
      if (spec_.type === "note") {
        checkNoteFieldRefs(findings, context);
      }
      if (spec_.type === "group") {
        checkGroupMembers(findings, context);
      }
      if (spec_.type === "list") {
        checkListReferences(findings, context);
      }
      if (spec_.type === "button") {
        checkSubmitAction(findings, context);
      }
      if (spec_.type === "summary" || spec_.type === "itemList") {
        checkDataSource(findings, context);
        // 조회 인자는 목록만의 것이 아니다 — 상세 화면의 요약도 한 건을 집어 온다.
        checkQueryParams(findings, context);
      }
      if (spec_.type === "select") {
        checkOptionCounts(findings, context);
      }
      checkFieldReferences(findings, context);
      checkNavigateParams(findings, context);

      // navigate의 targetScreenId와 submit 성공 후 이동은 같은 규칙으로 검사한다.
      for (const targetScreenId of [
        spec_.action?.targetScreenId,
        spec_.action?.onSuccess?.navigate,
        spec_.itemAction?.targetScreenId
      ]) {
        if (
          typeof targetScreenId === "string" &&
          !screenIds.has(targetScreenId)
        ) {
          findings.push({
            level: "warning",
            file,
            message: `${elementLabel(element, index)}의 이동 대상 화면 '${targetScreenId}'의 명세 파일이 아직 없습니다.`
          });
        }
      }
    });

    checkScreenAgainstDesign(findings, screen, designs[spec.screenId], shell);
  }

  // 화면 셸: 화면마다 복사하지 않으려고 카탈로그로 뺐으므로, 셸이 가리키는
  // 화면과 데이터 조각은 어느 화면도 검사해 주지 않는다. 여기서 본다.
  if (isObject(shell)) {
    for (const item of shell.navigation ?? []) {
      const targetScreenId = item?.targetScreenId;
      if (typeof targetScreenId === "string" && !screenIds.has(targetScreenId)) {
        findings.push({
          level: "warning",
          file: shellFile,
          message: `셸 메뉴 '${item.label}'의 이동 대상 화면 '${targetScreenId}'의 명세 파일이 아직 없습니다.`
        });
      }
    }

    // 작업 공간. 갈피가 가리키는 화면과 제목·상태 줄이 읽는 조각을 본다 —
    // 화면 쪽 검사는 key만 보므로 여기가 아니면 아무도 안 본다.
    for (const workspace of shell.workspaces ?? []) {
      for (const item of workspace.tabs ?? []) {
        const targetScreenId = item?.targetScreenId;
        if (typeof targetScreenId === "string" && !screenIds.has(targetScreenId)) {
          findings.push({
            level: "warning",
            file: shellFile,
            message: `작업 공간 '${workspace.key}'의 갈피 '${item.label}'이 가리키는 화면 '${targetScreenId}'의 명세 파일이 아직 없습니다.`
          });
        }
      }
    }

    const shellRefs = [
      { part: "brand", ref: shell.brand, fields: ["subtitleField"] },
      { part: "viewer", ref: shell.viewer, fields: ["nameField", "roleField"] },
      ...(shell.workspaces ?? []).flatMap((workspace) => [
        {
          part: `작업 공간 '${workspace.key}'의 제목`,
          ref: workspace.titleFrom,
          fields: ["field"]
        },
        {
          part: `작업 공간 '${workspace.key}'의 상태 줄`,
          ref: workspace.status,
          // items[].field는 아래에서 따로 편다.
          fields: (workspace.status?.items ?? []).map((_, at) => `items.${at}.field`)
        }
      ])
    ];
    for (const { part, ref, fields } of shellRefs) {
      const key = ref?.dataSourceKey;
      if (typeof key !== "string") {
        continue;
      }
      if (!isObject(dataSources)) {
        findings.push({
          level: "warning",
          file: shellFile,
          message: `data-sources.json이 없어 셸 ${part}의 데이터 출처 '${key}'를 확인하지 못했습니다.`
        });
        continue;
      }
      const source = dataSourceByKey.get(key);
      if (!source) {
        findings.push({
          level: "error",
          file: shellFile,
          message: `셸 ${part}의 데이터 출처 '${key}'가 카탈로그에 없습니다.`
        });
        continue;
      }
      if (source.shape !== "object") {
        findings.push({
          level: "error",
          file: shellFile,
          message: `셸 ${part}의 데이터 출처 '${key}'는 shape가 'object'여야 하는데 '${source.shape}'입니다.`
        });
        continue;
      }
      const sourceFields = new Set((source.fields ?? []).map((field) => field.key));
      // 'items.0.field'처럼 파고들어야 하는 이름도 온다(작업 공간의 상태 줄).
      const readRef = (name) =>
        name.split(".").reduce((value, part) => (isObject(value) || Array.isArray(value) ? value[part] : undefined), ref);
      for (const fieldName of fields) {
        const field = readRef(fieldName);
        if (typeof field === "string" && !sourceFields.has(field)) {
          findings.push({
            level: "error",
            file: shellFile,
            message: `셸 ${part}가 가리킨 조각 '${field}'가 데이터 출처 '${key}'에 없습니다.`
          });
        }
      }
    }
  }

  // 흐름 카탈로그: 참조한 화면의 명세 존재와 단일 멤버십(단계 표시의 유일성)을 검사한다.
  if (isObject(flows) && Array.isArray(flows.flows)) {
    const flowKeysByScreen = new Map();
    for (const flow of flows.flows) {
      if (!isObject(flow) || !Array.isArray(flow.screens)) {
        continue;
      }
      for (const step of flow.screens) {
        const screenId = step?.screenId;
        if (typeof screenId !== "string") {
          continue;
        }
        if (!screenIds.has(screenId)) {
          findings.push({
            level: "warning",
            file: flowsFile,
            message: `흐름 '${flow.key}'의 화면 '${screenId}' 명세가 아직 없습니다.`
          });
        }
        const owners = flowKeysByScreen.get(screenId) ?? [];
        owners.push(flow.key);
        flowKeysByScreen.set(screenId, owners);
      }
    }
    for (const [screenId, owners] of flowKeysByScreen) {
      if (owners.length > 1) {
        findings.push({
          level: "error",
          file: flowsFile,
          message: `화면 '${screenId}'가 여러 흐름(${owners.join(", ")})에 속합니다. 단계 표시가 모호해집니다.`
        });
      }
    }
  }

  return findings;
}
