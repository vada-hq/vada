import { allElementsOf } from "./element-walk.mjs";

import { DRAFT_SIGNALS } from "./screen-draft.mjs";

// fieldKey를 갖고 값을 담는 요소. 중복 검사와 참조 해석의 대상이다.
// 필수값 판정 후보(button-execution의 VALUE_FIELD_TYPES)와는 다른 집합이다 —
// list는 minItems로 개수를 정하지 결 required로 판정하지 않는다.
const FIELD_ELEMENT_TYPES = new Set(["input", "select", "list"]);

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** 이 그림 어딘가에 그 글이 그려져 있는가. 셸의 메뉴까지 함께 본다 — 제목이 어느
 * 자리에 그려지는지는 명세가 정하지 않기 때문이다. */
function designDrawsText(node, text) {
  if (!isObject(node)) {
    return false;
  }
  if (node.text?.content === text) {
    return true;
  }
  for (const child of node.children ?? []) {
    if (designDrawsText(child, text)) {
      return true;
    }
  }
  return false;
}

// 인자의 이름들. 카탈로그의 인자는 이름·필수·값의 종류·설명을 갖는 묶음이고,
// 여기서 보는 것은 그중 이름뿐이다 — 꺼내는 자리를 흩으면 모양이 또 바뀔 때 갈린다.
function paramKeys(source) {
  const params = Array.isArray(source?.params) ? source.params : [];
  return new Set(params.map((param) => param?.key));
}

/**
 * **열쇠를 빠뜨리고 부르지 않았는가.**
 *
 * 카탈로그가 인자마다 '부르는 쪽이 늘 넘기는가'를 갖고 있다. 빠뜨리면 서버는
 * 거르지 않은 전부를 주고, 화면은 그것이 걸러진 것인 줄 알고 그린다 — 남의 것이
 * 섞여 그려지는데 아무도 말하지 않는다.
 *
 * 이 판정을 짐작으로 세우지 않았다. 값이 어디서 오는지가 답한다 — 경로에 박힌 것,
 * 주소가 실어 온 것, 명세가 박은 값, 눌린 항목은 빌 수가 없고, 화면의 칸에서
 * 오는 것은 그 칸이 반드시 채우는 칸일 때만 늘 채워진다.
 */
function checkRequiredParams(findings, file, source, params, where) {
  const given = isObject(params) ? params : {};
  for (const param of Array.isArray(source?.params) ? source.params : []) {
    checkFixedValueType(findings, file, param, given[param?.key], where);
    if (param?.required !== true) continue;
    // **경로에 박힌 것도 넘기는 쪽이 준다.** 한동안 여기서 건너뛰었는데, 그것은
    // 주소를 서버가 만든다는 착각이었다 — 주소를 만드는 것은 부르는 쪽이고,
    // `{meetingId}`에 무엇을 넣을지는 이 params가 말한다. 건너뛰는 동안 **130자리가
    // 검사 없이 지나갔고**, 그 자리가 하필 가장 중요한 인자들이다.
    if (param.key in given) continue;
    findings.push({
      level: "error",
      file,
      message: `${where}가 반드시 넘겨야 하는 인자 '${param.key}'를 넘기지 않았습니다(${param.description}).`
    });
  }
}

/**
 * **명세가 박은 값이 선언한 종류와 맞는가.**
 *
 * 인자가 값의 종류를 갖게 됐는데 보는 곳이 없으면 그 선언은 장식이다. 실제로 하나가
 * 걸렸다 — 참거짓 인자에 `"y"`를 넘기고 있었다. 응답 쪽의 `''`/`'y'`는 참거짓으로
 * 고쳤는데 **요청 쪽에 그대로 남아 있었고**, 받는 쪽은 그 글자를 어떻게 읽을지
 * 명세 어디서도 알 수 없었다.
 *
 * 조회 문자열은 글로 실려 가므로 여기서 보는 것은 **그 글이 선언한 종류로 읽히는가**다.
 */
function checkFixedValueType(findings, file, param, argument, where) {
  const value = isObject(argument) ? argument.value : undefined;
  if (typeof value !== "string" || typeof param?.valueType !== "string") return;
  const readable =
    param.valueType === "string" ||
    (param.valueType === "boolean" && (value === "true" || value === "false")) ||
    (param.valueType === "number" && value.trim() !== "" && Number.isFinite(Number(value)));
  if (readable) return;
  findings.push({
    level: "error",
    file,
    message: `${where}의 인자 '${param.key}'는 ${param.valueType}인데 명세가 박은 값이 '${value}'입니다.`
  });
}

/**
 * 권한 규칙이 스스로 어긋나지 않는가.
 *
 * 스키마는 모양만 본다. **이름이 실제로 있는가**는 여기서 본다 — 없는 조건을 가리키는
 * 규칙은 판정할 수가 없고, 판정할 수 없는 자리는 조용히 통과하거나 조용히 막힌다.
 */
function checkPermissions(findings, permissions, file) {
  if (!isObject(permissions)) return;
  const conditions = Array.isArray(permissions.conditions) ? permissions.conditions : [];
  const known = new Set(conditions.map((condition) => condition?.key));
  const areas = Array.isArray(permissions.areas) ? permissions.areas : [];

  const seen = new Set();
  for (const area of areas) {
    if (seen.has(area?.key)) {
      findings.push({ level: "error", file, message: `권한 영역 '${area.key}'가 두 번 있습니다.` });
    }
    seen.add(area?.key);
    for (const [role, rule] of Object.entries(isObject(area?.rules) ? area.rules : {})) {
      if (!known.has(rule?.when)) {
        findings.push({
          level: "error",
          file,
          message: `권한 영역 '${area?.key}'의 ${role} 규칙이 없는 조건 '${rule?.when}'을 가리킵니다.`
        });
      }
      // 표에 그리는 줄은 칸마다 그려질 말이 있어야 한다. 없으면 화면이 짐작한다.
      if (area?.drawnInMatrix === true && typeof rule?.label !== "string") {
        findings.push({
          level: "error",
          file,
          message: `권한 영역 '${area?.key}'는 표에 그리는데 ${role} 칸에 그려질 말이 없습니다.`
        });
      }
      if (area?.drawnInMatrix !== true && typeof rule?.label === "string") {
        findings.push({
          level: "error",
          file,
          message: `권한 영역 '${area?.key}'는 표에 그리지 않는데 ${role} 칸에 말이 적혀 있습니다.`
        });
      }
    }
  }

  // 쓰지 않는 조건은 죽은 이름이다. 남아 있으면 다음 사람이 그것을 쓸 수 있는 줄 안다.
  const used = new Set(
    areas.flatMap((area) => Object.values(isObject(area?.rules) ? area.rules : {}).map((rule) => rule?.when))
  );
  for (const condition of conditions) {
    if (!used.has(condition?.key)) {
      findings.push({
        level: "error",
        file,
        message: `조건 '${condition?.key}'를 쓰는 권한 영역이 없습니다.`
      });
    }
  }
}

/**
 * 자리마다 매단 권한 영역이 실제로 있는가, 그리고 **판정할 수 있는가.**
 *
 * 조건이 대상을 요구하는데 그 대상을 가리키는 인자가 자리에 없으면, 그 조건은
 * 판정할 수가 없다 — 그러면 서버는 막거나 열거나 둘 중 하나를 **짐작으로** 하게 된다.
 */
/**
 * 밖에서 열리는 자리의 인자는 **열쇠인지 아닌지를 말해야 한다.**
 *
 * 로그인이 없거나(공개) 아직 구성원이 아닌 사람이 여는 자리에서는 **그 인자 하나가
 * 유일한 벽인 경우가 있다** — 참석 QR·설문 링크·영수증, 그리고 학생회에 들어오는
 * 초대 코드. 서버는 그런 값을 접속 기록에서 지우는데, 지울 자리를 계약이 말해야
 * 한다(`secret`).
 *
 * **적기를 잊는 쪽이 조용하다.** 표시를 안 하면 아무 일도 안 일어나고 열쇠가 1년
 * 남는다 — 초대 코드가 실제로 그랬다. 그래서 참·거짓 어느 쪽이든 **정하기를**
 * 요구한다. 안 정하면 여기서 멈춘다.
 *
 * 안쪽 자리는 묻지 않는다. `eventId`를 알아도 세션과 소속이 없으면 아무것도 못 여니
 * 그 값은 열쇠가 아니다.
 */
function checkSecretDeclared(findings, permissions, groups) {
  const OPEN = new Set(["public", "signedIn"]);
  for (const [items, what, file] of groups) {
    for (const item of Array.isArray(items) ? items : []) {
      if (!OPEN.has(item?.authorize?.area)) continue;
      for (const param of Array.isArray(item.params) ? item.params : []) {
        if (typeof param?.secret === "boolean") continue;
        findings.push({
          level: "error",
          file,
          message:
            `${what} '${item.key}'의 인자 '${param?.key}'가 밖에서 열리는 자리에 있는데 ` +
            "열쇠인지(secret) 정하지 않았습니다. 참이면 서버가 기록에서 지웁니다."
        });
      }
    }
  }
}

/**
 * **화면을 보는 사람이 그 화면의 출처에 닿을 수 있는가.**
 *
 * 화면마다 누가 보는지가 적혀 있고(`viewer`), 출처마다 누가 열 수 있는지가 적혀
 * 있다(`authorize.area`). 둘은 따로 적히므로 **어긋나도 아무 데서도 안 드러난다** —
 * 명세는 정합하고 화면도 그려지는데, 배포한 뒤 진짜 사람이 열면 그때 403이 온다.
 *
 * 실제로 그랬다: 학생회에 들어오려는 사람이 보는 화면 다섯이 학교·단과대·학부
 * 목록을 읽는데 그 목록들이 `member`를 요구했다. **학교를 골라야 구성원이 되는데
 * 구성원이라야 학교를 고를 수 있었다.** 서버를 지어 붙이다가 사람이 눈으로 찾았고,
 * 눈으로 찾은 것은 다음에 또 놓친다.
 *
 * 규칙은 하나다. 로그인이 없는 화면(`external`)은 `public`에만, 로그인만 한 화면
 * (`joining`)은 `public`과 `signedIn`에만 닿는다. 그 밖의 화면은 구성원이 보므로
 * 무엇에든 닿는다 — 여기서 재지 않는다.
 */
const REACHABLE_AREAS = new Map([
  ["external", new Set(["public"])],
  ["joining", new Set(["public", "signedIn"])]
]);

/** 화면이 이름을 불러 쓰는 출처·변이. 어디에 적히든 찾는다. */
const NAMED_SOURCE_PROPS = new Set([
  "dataSourceKey",
  "poolSourceKey",
  "downloadSourceKey",
  "copySourceKey",
  "mutationKey"
]);

function namedSourcesOf(node, found = new Set()) {
  if (Array.isArray(node)) {
    for (const item of node) namedSourcesOf(item, found);
    return found;
  }
  if (!isObject(node)) return found;
  for (const [property, value] of Object.entries(node)) {
    if (NAMED_SOURCE_PROPS.has(property) && typeof value === "string") found.add(value);
    // 선택지는 이름만이 아니라 인자까지 실어서 한 덩어리로 적힌다.
    if (property === "optionsSource" && isObject(value) && typeof value.key === "string") {
      found.add(value.key);
    }
    namedSourcesOf(value, found);
  }
  return found;
}

function checkViewerReach(findings, screens, groups) {
  const areaOf = new Map();
  for (const [items] of groups) {
    for (const item of Array.isArray(items) ? items : []) {
      if (typeof item?.key === "string") areaOf.set(item.key, item?.authorize?.area);
    }
  }
  for (const screen of Array.isArray(screens) ? screens : []) {
    const viewer = screen?.spec?.viewer;
    const reachable = REACHABLE_AREAS.get(viewer);
    if (reachable === undefined) continue;
    for (const key of [...namedSourcesOf(screen.spec)].sort()) {
      const area = areaOf.get(key);
      // 카탈로그에 없는 이름은 다른 검사가 잡는다. 여기서 두 번 말하지 않는다.
      if (area === undefined || reachable.has(area)) continue;
      findings.push({
        level: "error",
        file: screen.file,
        message:
          `'${viewer}'가 보는 화면인데 '${key}'가 '${area}'를 요구합니다. ` +
          `이 화면을 여는 사람은 [${[...reachable].join(", ")}]에만 닿습니다.`
      });
    }
  }
}

function checkAuthorize(findings, permissions, groups) {
  if (!isObject(permissions)) return;
  const areas = new Map(
    (Array.isArray(permissions.areas) ? permissions.areas : []).map((area) => [area?.key, area])
  );
  const needsOf = new Map(
    (Array.isArray(permissions.conditions) ? permissions.conditions : [])
      .map((condition) => [condition?.key, condition?.needs])
  );

  for (const [items, what, file] of groups) {
    for (const item of Array.isArray(items) ? items : []) {
      const authorize = item?.authorize;
      if (!isObject(authorize)) continue;
      const area = areas.get(authorize.area);
      if (area === undefined) {
        findings.push({
          level: "error",
          file,
          message: `${what} '${item.key}'가 없는 권한 영역 '${authorize.area}'를 가리킵니다.`
        });
        continue;
      }
      const needs = [
        ...new Set(
          Object.values(isObject(area.rules) ? area.rules : {})
            .map((rule) => needsOf.get(rule?.when))
            .filter((need) => typeof need === "string" && need !== "viewer")
        )
      ];
      if (needs.length === 0) {
        if (typeof authorize.object === "string") {
          findings.push({
            level: "error",
            file,
            message: `${what} '${item.key}'의 권한 영역 '${area.key}'는 대상이 필요 없는데 object를 적었습니다.`
          });
        }
        continue;
      }
      if (typeof authorize.object !== "string") {
        findings.push({
          level: "warning",
          file,
          message: `${what} '${item.key}'의 권한 영역 '${area.key}'는 ${needs.join("·")}을 보고 판정하는데, 그 대상을 가리키는 인자가 이 자리에 없습니다 — 조건을 판정할 수 없습니다.`
        });
        continue;
      }
      const declared = paramKeys(item);
      if (!declared.has(authorize.object)) {
        findings.push({
          level: "error",
          file,
          message: `${what} '${item.key}'가 권한 대상으로 가리킨 인자 '${authorize.object}'가 이 자리에 선언돼 있지 않습니다.`
        });
      }
    }
  }
}

/**
 * **두 번 보내지면 어떻게 되는가**를 적어 둔 것이 실제로 판정 가능한가.
 *
 * `naturalKey`는 '이미 있는지 데이터가 답한다'는 뜻이다. 그런데 그 열쇠가 실제로 오는
 * 값이 아니면 받는 쪽은 가릴 것이 없다 — 적어만 두고 판정할 수 없는 계약이 된다.
 *
 * 열쇠는 둘 중 하나에서 온다. **이 자리의 인자**(경로가 실어 온 토큰)이거나
 * **보내는 값의 칸**(폼에 적은 학번)이다.
 */
function checkRepeat(findings, file, mutation, fieldKeysByScope) {
  const repeat = mutation?.repeat;
  if (!isObject(repeat)) return;

  const declared = new Set([...paramKeys(mutation)]);
  const inPayload = fieldKeysByScope.get(mutation.payloadScope) ?? new Set();

  if (repeat.kind === "naturalKey") {
    const keys = Array.isArray(repeat.naturalKey) ? repeat.naturalKey : [];
    if (keys.length === 0) {
      findings.push({
        level: "error",
        file,
        message: `제출 계약 '${mutation.key}'가 자연 열쇠로 가린다고 적었는데 무엇이 열쇠인지 말하지 않습니다.`
      });
    }
    for (const key of keys) {
      if (declared.has(key) || inPayload.has(key)) continue;
      findings.push({
        level: "error",
        file,
        message: `제출 계약 '${mutation.key}'의 자연 열쇠 '${key}'가 이 자리의 인자에도 보내는 값에도 없습니다 — 가릴 것이 없습니다.`
      });
    }
  }

  // 같은 사실이 이미 있는지 가리는 열쇠도 실제로 오는 값이어야 한다.
  const conflict = mutation?.conflict;
  if (isObject(conflict)) {
    for (const key of Array.isArray(conflict.naturalKey) ? conflict.naturalKey : []) {
      if (declared.has(key) || inPayload.has(key)) continue;
      findings.push({
        level: "error",
        file,
        message: `제출 계약 '${mutation.key}'의 자연 열쇠 '${key}'가 이 자리의 인자에도 보내는 값에도 없습니다 — 가릴 것이 없습니다.`
      });
    }
  }

  if (repeat.kind !== "naturalKey" && Array.isArray(repeat.naturalKey)) {
    findings.push({
      level: "error",
      file,
      message: `제출 계약 '${mutation.key}'는 '${repeat.kind}'인데 자연 열쇠를 적었습니다.`
    });
  }
}

/**
 * 그 스코프에 값을 쓰는 화면의 칸들. 보내는 값이 무엇인지는 화면이 안다.
 *
 * **한 번만 걷는다.** 처음에는 변이마다 화면 전부를 걸었는데, 변이 44개 × 화면 82개면
 * 3,608번 걷는 일이 되고 검증이 14초에서 41초로 늘었다. 재는 저울이 느려지면 사람이
 * 덜 재게 된다 — 그것이 검사를 없애는 가장 흔한 길이다.
 */
function payloadFieldKeysByScope(screens) {
  const byScope = new Map();
  for (const screen of screens) {
    const scopeKey = screen?.spec?.stateScopeKey;
    if (typeof scopeKey !== "string") continue;
    const keys = byScope.get(scopeKey) ?? new Set();
    const walk = (node) => {
      if (Array.isArray(node)) {
        for (const item of node) walk(item);
        return;
      }
      if (!isObject(node)) return;
      if (typeof node.fieldKey === "string") keys.add(node.fieldKey);
      for (const value of Object.values(node)) walk(value);
    };
    walk(screen.spec);
    byScope.set(scopeKey, keys);
  }
  return byScope;
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
  // 그려지지 않는 라벨은 디자인에서 찾을 수 없다. 글 없는 조작의 label은
  // '부르는 이름'이지 '그려지는 글'이 아니다.
  // 상황에 따라 바뀌는 글은 디자인이 한쪽만 그린다. 어느 쪽이든 그 자리에 있으면 된다.
  const candidates =
    spec.labelHidden === true
      ? []
      : [spec.label ?? spec.title, spec.labelWhenAnyItemIs?.label].filter(
          (text) => typeof text === "string" && text.trim()
        );
  const identifyingText = candidates[0];
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

  if (!candidates.some((text) => hasNodeWithExactText(node, text))) {
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
  // 변형은 **본 화면을 다르게 그린 것**이라 함께 있는 것은 본 화면이 이미 세었다.
  // 여기서 다시 세면 회의 목록의 검색·줄마다의 단추가 네 번 '명세에 없다'고 나온다.
  if (isObject(spec.variantOf)) {
    return;
  }
  // 모달은 **아래 화면 위에 뜬다.** 디자인이 그것을 화면 전체와 형제로 그리므로,
  // 이 화면이 그리는 부분 밖은 아래 화면의 것이다 - 거기까지 세면 아래 화면의
  // 버튼이 전부 '명세에 없는 상호작용'으로 보인다(ORG-07B의 머리 버튼 셋).
  const overlaySource = spec.overlay?.source;
  const root =
    typeof overlaySource === "string"
      ? (findDesignNode(design.root, overlaySource) ?? design.root)
      : design.root;
  const excluded = new Set(
    Array.isArray(shell?.design?.excludeNodeNames) ? shell.design.excludeNodeNames : []
  );
  const registered = new Set(
    allElementsOf(spec)
      .map(({ element }) => element?.source?.nodeId)
      .filter((nodeId) => typeof nodeId === "string")
  );
  // 한 자리를 여러 번 그린 그림. **나머지 사본도 등록된 것이다** — 하나만 세면
  // 나머지 안의 단추가 '명세에 없는 상호작용'으로 잡힌다.
  for (const { element } of allElementsOf(spec)) {
    for (const nodeId of element?.source?.alsoDrawnAt ?? []) {
      if (typeof nodeId === "string") {
        registered.add(nodeId);
      }
    }
  }
  // 작업 공간의 갈피 줄도 등록 노드다. 무엇을 그리는지는 셸이 알고 화면은 어디에
  // 그리는지만 아는데, 그 '어디'가 없으면 갈피 일곱이 명세에 없는 것으로 보인다.
  for (const nodeId of Object.values(spec.workspace?.source ?? {})) {
    if (typeof nodeId === "string") {
      registered.add(nodeId);
    }
  }
  // 현재 위치 경로도 등록 노드다. 그 안의 글은 명세가 갖고 있으므로 대조기가
  // 지켜야 한다 — 등록하지 않으면 디자인이 그린 여섯 조각이 아무의 것도 아니게 된다.
  if (typeof spec.breadcrumb?.source === "string") {
    registered.add(spec.breadcrumb.source);
  }
  // 목록의 쪽 줄도 그렇다. 디자인이 표와 쪽 줄을 형제로 두어 둘을 함께 품는 노드가
  // 없으므로, 목록이 그 자리를 따로 갖는다.
  for (const element of spec.elements) {
    const source = element?.spec?.paging?.source;
    if (typeof source === "string") {
      registered.add(source);
    }
  }
  // 되풀이되는 요소는 **첫 사본의 노드만** 등록한다(itemFields 계약). 그런데 디자인이
  // 사본을 형제로 나란히 그리면 둘째부터의 상호작용이 등록 밖이 된다 - FIN-EVID-01의
  // 결제 묶음 셋이 각각 '파일 추가'를 갖는 자리가 그렇다.
  //
  // 임자 없는 형제는 사본으로 본다: 명세가 임자를 밝힌 형제는 그 임자의 것이고(등록됐거나
  // 등록된 것을 품거나), 아무도 안 챙긴 같은 이름의 형제는 되풀이되는 틀의 다른 사본이다.
  const repeatedSources = new Set();
  for (const { element } of allElementsOf(spec)) {
    if (Array.isArray(element?.spec?.itemFields) && typeof element.source?.nodeId === "string") {
      repeatedSources.add(element.source.nodeId);
    }
  }
  const copies = new Set();
  const markCopies = (node) => {
    const children = Array.isArray(node?.children) ? node.children : [];
    const first = children.find((child) => repeatedSources.has(child.id));
    if (first) {
      for (const sibling of children) {
        if (sibling.id === first.id) continue;
        if (sibling.name !== first.name) continue;
        if (registered.has(sibling.id) || holdsRegistered(sibling)) continue;
        copies.add(sibling.id);
      }
    }
    for (const child of children) markCopies(child);
  };

  const isInteraction = (node) =>
    DRAFT_SIGNALS.BUTTON_NAME_PATTERN.test(node.name ?? "") ||
    DRAFT_SIGNALS.CONTROL_NAMES.has(node.name ?? "");

  // 이름으로 빼는 것은 셸이다(왼쪽 사이드바). 그런데 **화면이 제 안쪽 패널에도
  // 같은 이름을 붙일 수 있다** — FIN-REQ-01의 요청 요약 패널이 'Sidebar'다.
  // 이름만 보고 빼면 그 안의 제출 버튼 셋이 통째로 검사 밖으로 나간다.
  // 화면이 그 안에 요소를 등록했으면 셸이 아니다.
  const holdsRegistered = (node) =>
    (Array.isArray(node?.children) ? node.children : []).some(
      (child) => registered.has(child.id) || holdsRegistered(child)
    );

  markCopies(root);

  const walk = (node, covered) => {
    for (const child of Array.isArray(node?.children) ? node.children : []) {
      if (excluded.has(child.name) && !holdsRegistered(child)) {
        continue;
      }
      const inside = covered || registered.has(child.id) || copies.has(child.id);
      if (!inside && isInteraction(child)) {
        const drawn = collectSubtreeText(child).join("").trim();
        // **글이 없다고 넘기지 않는다.** 켜고 끄는 칸은 제 안에 글을 담지 않는다 —
        // 체크 상자의 '동의합니다'는 형제고, 스위치와 빈 드롭다운은 아예 글이 없다.
        // 글이 있을 때만 알리면 그런 칸이 명세에서 통째로 빠져도 조용하다.
        findings.push({
          level: "error",
          file,
          message: `design의 ${drawn ? `'${drawn}'` : "글 없는 칸"}(${child.id} ${child.name})이 명세에 없습니다. 등록된 어느 요소 안에도 들어 있지 않습니다 — 화면의 동작이라면 요소로 등록하고, 다른 요소의 내부 조작이라면 그 요소의 nodeId가 이것을 품어야 합니다.`
        });
      }
      walk(child, inside);
    }
  };
  walk(root, false);
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
  allElementsOf(spec).forEach(({ element }, index) => {
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

  const declaredParams = [...paramKeys(catalogSource)];
  const mapping = isObject(optionsSource.params) ? optionsSource.params : {};

  for (const param of declaredParams) {
    if (!(param in mapping)) {
      findings.push({
        level: "error",
        file,
        message: `${elementLabel(element, index)}의 출처 '${optionsSource.key}'에 필요한 인자 '${param}' 매핑이 없습니다.`
      });
    }
  }
  checkArgumentValues(findings, context, mapping, {
    declared: new Set(declaredParams),
    where: `선택지 출처 '${optionsSource.key}'`
  });
  checkRequiredParams(
    findings, file, catalogSource, mapping,
    `${elementLabel(element, index)}의 선택지 출처 '${optionsSource.key}' 조회`
  );
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

// 항목이 여러 칸을 갖는 목록.
//
// 항목 머리에 그리는 이름은 항목의 칸 하나다. 그것을 가리키지 않으면 화면은 머리에
// 무엇을 적을지 모르고, 순번만 남는다.
function checkListItemFields(findings, context) {
  const { file, element, index } = context;
  const { itemFields, itemTitleFieldKey, itemActions } = element.spec;

  if (!Array.isArray(itemFields)) {
    if (typeof itemTitleFieldKey === "string") {
      findings.push({
        level: "error",
        file,
        message: `${elementLabel(element, index)}에 itemTitleFieldKey가 있는데 itemFields가 없습니다. 가리킬 칸이 없습니다.`
      });
    }
    return;
  }

  const itemKeys = new Set(
    itemFields
      .map((field) => field?.spec?.fieldKey)
      .filter((key) => typeof key === "string")
  );

  if (typeof itemTitleFieldKey !== "string") {
    findings.push({
      level: "error",
      file,
      message: `${elementLabel(element, index)}에 itemTitleFieldKey가 없습니다. 항목 머리에 그릴 이름이 어느 칸의 값인지 정해야 합니다.`
    });
  } else if (!itemKeys.has(itemTitleFieldKey)) {
    findings.push({
      level: "error",
      file,
      message: `${elementLabel(element, index)}의 itemTitleFieldKey '${itemTitleFieldKey}'가 itemFields에 없습니다.`
    });
  }

  // 이름도 항목의 칸이므로, 그 칸을 고치는 것이 곧 이름을 고치는 것이다.
  if (Array.isArray(itemActions) && itemActions.includes("rename")) {
    findings.push({
      level: "error",
      file,
      message: `${elementLabel(element, index)}는 itemFields가 있으므로 itemActions에 'rename'을 쓸 수 없습니다. 이름은 '${itemTitleFieldKey}' 칸이고, 그 칸을 고치는 것이 이름을 고치는 것입니다.`
    });
  }
}

// 고칠 것을 먼저 읽어 오는 화면.
//
// 읽어 온 조각이 화면의 어느 칸에도 닿지 않으면 그 조각은 받아만 놓고 버려진다.
// 반대로 목록의 칸이 조각에 없으면 그 칸은 고치는 화면에서도 늘 비어 있다. 둘 다
// 조용하다 — 화면은 멀쩡히 그려지고 값만 없다.
// 인자 없이 열렸을 때 뭐라고 할지.
//
// 지금까지 그 문장은 화면마다 코드에 있었다. 명세에 없는 카피이므로 대조기도
// 준수 검사도 보지 않았고, 화면마다 다른 말을 했다 — 어떤 화면은 '이 화면은
// eventId가 있어야 열립니다'라 했고 어떤 화면은 명세의 내부 설명을 그대로
// 뿌렸다. 없어도 되는 인자는 없는 것이 사고가 아니므로 이 글도 없다.
function checkParamMissingNotes(findings, file, spec) {
  for (const param of Array.isArray(spec.params) ? spec.params : []) {
    if (!isObject(param) || typeof param.key !== "string") {
      continue;
    }
    const optional = param.optional === true;
    const note = param.missingNote;
    if (optional && note !== undefined) {
      findings.push({
        level: "error",
        file,
        message: `인자 '${param.key}'는 없어도 되는데 없을 때의 글(missingNote)을 갖습니다. 그 자리는 그려지지 않습니다.`
      });
      continue;
    }
    if (!optional && typeof note !== "string") {
      findings.push({
        level: "error",
        file,
        message: `인자 '${param.key}'가 없을 때 사람에게 뭐라고 할지(missingNote)가 없습니다. 적지 않으면 구현이 지어냅니다.`
      });
    }
  }
}

// 제목 위의 현재 위치 경로.
//
// 조각의 글은 디자인이 그려 두었고 등록 노드이므로 대조기가 지킨다. 여기서
// 보는 것은 데이터에서 오는 조각뿐이다 — 출처 없이 field를 가리키면 화면이
// 무엇을 그려야 할지 알 수 없다.
function checkBreadcrumb(findings, file, spec, { dataSources, dataSourceByKey, screenParams }) {
  const breadcrumb = isObject(spec.breadcrumb) ? spec.breadcrumb : null;
  if (!breadcrumb) {
    return;
  }

  const items = Array.isArray(breadcrumb.items) ? breadcrumb.items : [];
  const fields = items
    .map((item) => (isObject(item) ? item.field : undefined))
    .filter((field) => typeof field === "string");

  const key = breadcrumb.dataSourceKey;
  if (typeof key !== "string") {
    if (fields.length > 0) {
      findings.push({
        level: "error",
        file,
        message: `현재 위치 경로가 dataSourceKey 없이 조각 '${fields[0]}'를 가리킵니다.`
      });
    }
    return;
  }
  if (fields.length === 0) {
    findings.push({
      level: "error",
      file,
      message: `현재 위치 경로가 데이터 출처 '${key}'를 쓰지 않습니다. 조각을 가리키지 않을 거면 출처도 없습니다.`
    });
    return;
  }

  if (!isObject(dataSources)) {
    findings.push({
      level: "warning",
      file,
      message: `data-sources.json이 없어 현재 위치 경로의 출처 '${key}'를 확인하지 못했습니다.`
    });
    return;
  }

  const source = dataSourceByKey.get(key);
  if (!source) {
    findings.push({
      level: "error",
      file,
      message: `현재 위치 경로의 데이터 출처 '${key}'가 카탈로그에 없습니다.`
    });
    return;
  }
  if (source.shape !== "object") {
    findings.push({
      level: "error",
      file,
      message: `현재 위치 경로의 출처 '${key}'는 shape가 '${source.shape}'입니다. 지금 있는 자리는 한 건이므로 object여야 합니다.`
    });
  }

  const known = new Set((source.fields ?? []).map((field) => field.key));
  for (const field of fields) {
    if (!known.has(field)) {
      findings.push({
        level: "error",
        file,
        message: `현재 위치 경로가 가리킨 조각 '${field}'가 데이터 출처 '${key}'에 없습니다.`
      });
    }
  }

  const declared = paramKeys(source);
  checkRequiredParams(findings, file, source, breadcrumb.params, "현재 위치 경로");
  for (const [name, argument] of Object.entries(
    isObject(breadcrumb.params) ? breadcrumb.params : {}
  )) {
    if (!declared.has(name)) {
      findings.push({
        level: "error",
        file,
        message: `현재 위치 경로가 넘긴 인자 '${name}'를 데이터 출처 '${key}'가 받지 않습니다.`
      });
    }
    const screenParam = isObject(argument) ? argument.screenParam : undefined;
    if (typeof screenParam === "string" && !screenParams.has(screenParam)) {
      findings.push({
        level: "error",
        file,
        message: `현재 위치 경로가 화면 인자 '${screenParam}'를 가리키는데 화면의 params에 없습니다.`
      });
    }
  }
}

function checkDraftFrom(findings, file, spec, { dataSources, dataSourceByKey, screenParams }) {
  const draftFrom = isObject(spec.draftFrom) ? spec.draftFrom : null;
  if (!draftFrom) {
    return;
  }

  if (!isObject(dataSources)) {
    findings.push({
      level: "warning",
      file,
      message: `data-sources.json이 없어 초안 출처 '${draftFrom.dataSourceKey}'를 확인하지 못했습니다.`
    });
    return;
  }

  const source = dataSourceByKey.get(draftFrom.dataSourceKey);
  if (!source) {
    findings.push({
      level: "error",
      file,
      message: `초안 출처 '${draftFrom.dataSourceKey}'가 데이터 출처 카탈로그에 없습니다.`
    });
    return;
  }
  if (source.shape !== "object") {
    findings.push({
      level: "error",
      file,
      message: `초안 출처 '${draftFrom.dataSourceKey}'는 shape가 '${source.shape}'입니다. 고치는 대상은 한 건이므로 object여야 합니다.`
    });
  }

  const declared = paramKeys(source);
  checkRequiredParams(findings, file, source, draftFrom.params, "초안 출처");
  for (const [paramName, argument] of Object.entries(draftFrom.params ?? {})) {
    if (!declared.has(paramName)) {
      findings.push({
        level: "error",
        file,
        message: `초안 출처에 넘긴 인자 '${paramName}'가 '${draftFrom.dataSourceKey}'에 선언돼 있지 않습니다.`
      });
    }
    const screenParam = isObject(argument) ? argument.screenParam : undefined;
    if (typeof screenParam === "string" && !screenParams.has(screenParam)) {
      findings.push({
        level: "error",
        file,
        message: `초안 출처의 인자 '${paramName}'가 화면 인자 '${screenParam}'를 가리키는데 화면의 params에 없습니다.`
      });
    }
  }

  // 조각 이름과 칸 이름을 맞춰 본다. 목록의 조각은 다시 항목의 칸과 맞춰 본다.
  const lists = new Map(
    allElementsOf(spec)
      .map(({ element }) => element?.spec)
      .filter((candidate) => isObject(candidate) && candidate.type === "list")
      .map((candidate) => [candidate.fieldKey, candidate])
  );
  const screenFieldKeys = new Set(
    allElementsOf(spec)
      .map(({ element }) => element?.spec)
      .filter((candidate) => isObject(candidate) && FIELD_ELEMENT_TYPES.has(candidate.type))
      .map((candidate) => candidate.fieldKey)
      .filter((key) => typeof key === "string")
  );

  for (const field of Array.isArray(source.fields) ? source.fields : []) {
    if (typeof field?.key !== "string") {
      continue;
    }
    if (!screenFieldKeys.has(field.key)) {
      findings.push({
        level: "error",
        file,
        message: `초안 출처 '${draftFrom.dataSourceKey}'의 조각 '${field.key}'를 받을 칸이 화면에 없습니다. 읽어만 놓고 아무 데도 쓰지 않습니다.`
      });
      continue;
    }
    const list = lists.get(field.key);
    if (!list) {
      continue;
    }
    const itemKeys = new Set(
      (Array.isArray(list.itemFields) ? list.itemFields : [])
        .map((entry) => entry?.spec?.fieldKey)
        .filter((key) => typeof key === "string")
    );
    const nested = new Set(
      (Array.isArray(field.fields) ? field.fields : [])
        .map((entry) => entry?.key)
        .filter((key) => typeof key === "string")
    );
    for (const key of itemKeys) {
      if (!nested.has(key)) {
        findings.push({
          level: "error",
          file,
          message: `목록 '${field.key}'의 칸 '${key}'가 초안 출처 '${draftFrom.dataSourceKey}'의 항목 조각에 없습니다. 고치러 들어와도 그 칸만 늘 비어 있습니다.`
        });
      }
    }
  }
}

// 화면이 스스로 셈하는 값.
//
// 셈이 가리키는 목록과 칸이 실제로 있어야 한다. 없으면 값은 조용히 0이 되고,
// 0원은 틀린 값처럼 보이지 않는다 — 아직 아무것도 안 넣은 것처럼 보인다.
function checkSummaryCompute(findings, context) {
  const { file, element, index, inList, listsByFieldKey } = context;

  for (const item of Array.isArray(element.spec.items) ? element.spec.items : []) {
    const compute = isObject(item?.compute) ? item.compute : null;
    if (!compute) {
      continue;
    }
    const where = `${elementLabel(element, index)}의 '${item.label ?? compute.op}'`;

    if (compute.op === "product") {
      if (!inList) {
        findings.push({
          level: "error",
          file,
          message: `${where}는 product인데 항목 안에 있지 않습니다. 곱할 것은 한 항목의 칸들이므로 list.itemFields 안에서만 쓸 수 있습니다.`
        });
        continue;
      }
      if (typeof compute.listFieldKey === "string") {
        findings.push({
          level: "error",
          file,
          message: `${where}는 product인데 listFieldKey를 갖습니다. 지금 있는 그 항목 안에서 곱하므로 목록을 다시 가리키지 않습니다.`
        });
      }
    }

    const owner =
      compute.op === "product" ? inList : listsByFieldKey.get(compute.listFieldKey);

    if (compute.op !== "product") {
      if (typeof compute.listFieldKey !== "string") {
        findings.push({
          level: "error",
          file,
          message: `${where}는 ${compute.op}인데 listFieldKey가 없습니다. 무엇을 세거나 더하는지 정해야 합니다.`
        });
        continue;
      }
      if (!owner) {
        findings.push({
          level: "error",
          file,
          message: `${where}가 가리킨 목록 '${compute.listFieldKey}'가 화면에 없습니다.`
        });
        continue;
      }
    }

    if (compute.op === "count") {
      if (Array.isArray(compute.fieldKeys)) {
        findings.push({
          level: "error",
          file,
          message: `${where}는 count인데 fieldKeys를 갖습니다. 세는 것은 항목이지 칸이 아닙니다.`
        });
      }
      continue;
    }

    if (!Array.isArray(compute.fieldKeys)) {
      findings.push({
        level: "error",
        file,
        message: `${where}는 ${compute.op}인데 fieldKeys가 없습니다. 무엇을 곱하는지 정해야 합니다.`
      });
      continue;
    }
    const itemKeys = new Set(
      (Array.isArray(owner?.itemFields) ? owner.itemFields : [])
        .map((entry) => entry?.spec?.fieldKey)
        .filter((key) => typeof key === "string")
    );
    for (const key of compute.fieldKeys) {
      if (!itemKeys.has(key)) {
        findings.push({
          level: "error",
          file,
          message: `${where}가 곱하려는 칸 '${key}'가 목록 '${owner?.fieldKey}'의 항목에 없습니다.`
        });
      }
    }
  }
}

// 정해진 단계들과 '지금 어디인지'.
//
// 단계는 명세가 알고 지금 어디인지는 데이터가 안다. 그 둘이 **같은 말을 쓰는지**를
// 여기서 본다 — 어긋나면 줄은 그려지고 어느 단계도 켜지지 않는다. 조용한 어긋남이다.
// 칸 목록이 데이터에서 오는 묶음.
//
// 명세가 칸을 모르므로 검사할 것은 하나뿐이다: **그 출처가 칸을 말하는 출처인가.**
// key·label·placeholder 셋이 칸 하나를 이루고, 하나라도 없으면 화면이 무엇을 그려야
// 할지 알 수 없다. 이름을 화면마다 고르게 하지 않는 이유가 이것이다 — 짝짓기가 다시
// 명세의 일이 되면 칸을 데이터로 옮긴 뜻이 없다.
function checkFieldSet(findings, context) {
  const { file, element, index, dataSources, dataSourceByKey } = context;
  const spec = element.spec;
  if (!isObject(dataSources)) {
    return;
  }
  const source = dataSourceByKey.get(spec.dataSourceKey);
  if (!source) {
    return;
  }
  const known = new Set((source.fields ?? []).map((field) => field.key));
  for (const required of ["key", "label", "placeholder"]) {
    if (!known.has(required)) {
      findings.push({
        level: "error",
        file,
        message: `${elementLabel(element, index)}의 칸 목록 출처 '${spec.dataSourceKey}'에 '${required}' 조각이 없습니다. 칸 하나는 key·label·placeholder로 이루어집니다.`
      });
    }
  }
}

function checkSteps(findings, context) {
  const { file, element, index, dataSources, dataSourceByKey } = context;
  const spec = element.spec;

  const seen = new Set();
  for (const item of Array.isArray(spec.items) ? spec.items : []) {
    if (typeof item?.key !== "string") {
      continue;
    }
    if (seen.has(item.key)) {
      findings.push({
        level: "error",
        file,
        message: `${elementLabel(element, index)}의 단계 '${item.key}'가 두 번 나옵니다. 어느 것이 '지금'인지 정할 수 없습니다.`
      });
    }
    seen.add(item.key);
  }

  if (!isObject(dataSources)) {
    findings.push({
      level: "warning",
      file,
      message: `data-sources.json이 없어 단계의 출처 '${spec.dataSourceKey}'를 확인하지 못했습니다.`
    });
    return;
  }
  const source = dataSourceByKey.get(spec.dataSourceKey);
  if (!source) {
    // 출처 부재는 checkDataSource가 이미 보고한다.
    return;
  }
  const fields = new Set((source.fields ?? []).map((field) => field?.key));
  if (!fields.has(spec.currentField)) {
    findings.push({
      level: "error",
      file,
      message: `${elementLabel(element, index)}의 currentField '${spec.currentField}'가 데이터 출처 '${spec.dataSourceKey}'에 없습니다.`
    });
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

  // 스코프 이벤트는 그 화면이 참조하는 스코프의 수명을 끝낸다. 보내고 나서
  // 끝내거나(onSuccess.scopeEvent) 떠나면서 끝낸다(action.scopeEvent) - 모달의
  // 취소는 제출이 아니라 이동이라 뒤쪽이 없으면 cancel을 낼 방법이 없었다.
  const scopeEvent = action.onSuccess?.scopeEvent ?? action.scopeEvent;
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
    // 안쪽 목록은 조회하지 않는다. 항목이 바깥 항목의 조각에서 오므로 출처가 없다.
    if (typeof spec.itemsField === "string") {
      return;
    }
    // 되풀이되는 묶음 안에서는 출처를 다시 적지 않는다. 항목 하나가 곧 그 값이고,
    // 목록이 이미 어디서 오는지 말했다 — 안쪽마다 같은 출처를 되풀이해 적게 하면
    // 둘이 갈릴 자리가 생긴다.
    if (isObject(context.inList) && context.inList.type === "itemList") {
      return;
    }
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

  // 조각을 항목으로 받는 목록은 **한 건을 조회한다.** 줄들이 그 한 건 안에 이미
  // 들어 있으므로 출처는 object이고, list를 요구하면 이 꼴이 통째로 막힌다.
  const readsField = spec.type === "itemList" && typeof spec.itemsField === "string";
  const expectedShape =
    !readsField && (spec.type === "itemList" || spec.type === "fieldSet") ? "list" : "object";
  if (source.shape !== expectedShape) {
    findings.push({
      level: "error",
      file,
      message: `${elementLabel(element, index)}(${spec.type})는 shape가 '${expectedShape}'인 출처를 써야 하는데 '${key}'는 '${source.shape}'입니다.`
    });
  }

  // 조각을 항목으로 받는 목록은 그 조각이 무엇으로 이루어지는지도 말해야 한다.
  // 없으면 열이 무엇을 가리키는지 견줄 것이 없고, 검사가 조용해진다.
  if (readsField) {
    const nested = (source.fields ?? []).find((field) => field.key === spec.itemsField);
    if (!nested || !Array.isArray(nested.fields)) {
      findings.push({
        level: "error",
        file,
        message: `${elementLabel(element, index)}가 가리킨 조각 '${spec.itemsField}'가 데이터 출처 '${key}'에 없거나 fields를 갖지 않습니다. 항목이 무엇으로 이루어지는지 알 수 없습니다.`
      });
    }
  }

  const fieldKeys = new Set((source.fields ?? []).map((field) => field.key));
  const referenced = [
    ...(spec.eyebrowField === undefined ? [] : [spec.eyebrowField]),
    ...(spec.titleField === undefined ? [] : [spec.titleField]),
    ...(spec.descriptionField === undefined ? [] : [spec.descriptionField]),
    // **요약 자체의 색과 그림도 조각을 가리킨다.** 딱지의 것(status[])만 보고
    // 있어서 이 둘은 없는 조각을 가리켜도 조용했다 — 색이 무채색으로 그려지거나
    // 그림이 안 나와도 아무도 그것이 틀렸다고 말하지 않는다.
    ...(spec.toneField === undefined ? [] : [spec.toneField]),
    ...(spec.iconField === undefined ? [] : [spec.iconField]),
    // 상태 딱지는 글과 색 이름을 따로 가리킨다. 색만 없으면 딱지가 무채색으로
    // 그려지고 아무도 그것이 틀렸다고 말하지 않는다.
    //
    // **딱지는 여럿이다.** 한 자리에 둘 붙는 곳이 있어(OPS-MEET-07·04B) 스키마가
    // 배열인데, 여기는 오랫동안 isObject로 물었다 — 배열은 isObject가 아니므로
    // 이 판정은 **한 번도 돈 적이 없다**. 딱지가 없는 출처를 가리켜도 조용했다.
    ...(Array.isArray(spec.status) ? spec.status : [])
      .flatMap((badge) => [badge?.field, badge?.toneField])
      .filter((field) => typeof field === "string"),
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
  const { params, dataSourceKey } = context.element.spec;
  checkArgumentMap(findings, context, params, dataSourceKey);
}

// 조회하며 넘기는 인자 한 묶음. 목록·요약의 params, 선택지 개수의 params, 그리고
// 선택지 자체의 params가 같은 것이라 판정도 한 곳이다 — 인자의 출처가 늘면 세 자리가
// 함께 늘어야 한다.
function checkArgumentMap(findings, context, params, dataSourceKey) {
  const { dataSources, dataSourceByKey } = context;
  const source = isObject(dataSources) ? dataSourceByKey.get(dataSourceKey) : null;
  checkArgumentValues(findings, context, params, {
    declared: source ? paramKeys(source) : null,
    where: `데이터 출처 '${dataSourceKey}'`
  });
  if (source) {
    checkRequiredParams(
      findings, context.file, source, params,
      `${elementLabel(context.element, context.index)}의 데이터 출처 '${dataSourceKey}' 조회`
    );
  }
}

// 인자 하나하나가 가리키는 곳이 실제로 있는가. 무엇이 그 인자를 받는지(declared)는
// 부르는 쪽이 안다 — 데이터 출처일 수도 선택지 출처일 수도 있다.
function checkArgumentValues(findings, context, params, { declared, where }) {
  const { file, element, index, fieldKeys, screenParams } = context;

  if (!isObject(params)) {
    return;
  }

  for (const [paramName, argument] of Object.entries(params)) {
    if (declared && !declared.has(paramName)) {
      findings.push({
        level: "error",
        file,
        message: `${elementLabel(element, index)}가 넘긴 조회 인자 '${paramName}'가 ${where}에 선언돼 있지 않습니다.`
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
    //
    // **되풀이되는 묶음 안은 다르다.** 그 요소는 항목마다 한 번씩 그려지므로 그릴
    // 때 이미 항목이 정해져 있다 — 보완 품목마다 채울 칸이 다른 것이 그 자리다.
    if (isObject(argument) && typeof argument.itemField === "string" && !isObject(context.inList)) {
      findings.push({
        level: "error",
        file,
        message: `${elementLabel(element, index)}의 조회 인자 '${paramName}'가 항목의 조각(itemField)을 가리킵니다. 조회하는 시점에는 아직 항목이 없습니다 — 항목의 조각은 눌렸을 때의 동작(action.params)에서만 쓸 수 있습니다.`
      });
    }
  }
}

// 줄 전체의 색 이름도 실제로 있는 조각이어야 한다. 없으면 아무 줄도 표시되지
// 않고 아무도 말하지 않는다 - 열의 색 이름을 보는 것과 같은 이유다.
/**
 * 데이터가 허락할 때만 그리는 자리(drawnWhen).
 *
 * 그리는 조건을 명세가 적지 않고 **데이터가 답한다**. 그래서 검사할 것은 셋뿐이다 —
 * 그 출처가 카탈로그에 있는가, 그 조각이 그 출처에 있는가, 넘긴 인자가 선언돼 있는가.
 * '언제 참인가'는 서버의 것이라 여기서 묻지 않는다.
 */
function checkDrawnWhen(findings, context) {
  const { file, element, index, dataSources, dataSourceByKey } = context;
  const drawnWhen = element?.drawnWhen;
  if (!isObject(drawnWhen)) {
    return;
  }
  const where = `${elementLabel(element, index)}의 drawnWhen`;
  if (!dataSources) {
    findings.push({
      level: "warning",
      file,
      message: `data-sources.json이 없어 ${where}의 출처 '${drawnWhen.dataSourceKey}'를 확인하지 못했습니다.`
    });
    return;
  }
  const source = dataSourceByKey.get(drawnWhen.dataSourceKey);
  if (!source) {
    findings.push({
      level: "error",
      file,
      message: `${where}의 데이터 출처 '${drawnWhen.dataSourceKey}'가 카탈로그에 없습니다.`
    });
    return;
  }
  const sourceFields = new Set((source.fields ?? []).map((field) => field?.key));
  if (!sourceFields.has(drawnWhen.field)) {
    findings.push({
      level: "error",
      file,
      message: `${where}이 가리킨 조각 '${drawnWhen.field}'가 데이터 출처 '${drawnWhen.dataSourceKey}'에 없습니다.`
    });
  }
  checkRequiredParams(
    findings, context.file, source, drawnWhen.params,
    `그릴지 정하는 조회 '${drawnWhen.dataSourceKey}'`
  );
  checkArgumentValues(findings, context, drawnWhen.params, {
    declared: paramKeys(source),
    where: `데이터 출처 '${drawnWhen.dataSourceKey}'`
  });
}

/**
 * 더할 항목을 고르는 출처(list.candidatesSource).
 *
 * 이 자리가 없던 동안 화면이 출처 이름을 코드에 박아 읽었다 — 명세만 읽는 사람은
 * 그 화면이 그 출처를 쓴다는 것을 알 길이 없었다.
 */
function checkCandidatesSource(findings, context) {
  const { file, element, index, dataSources, dataSourceByKey } = context;
  const candidates = element?.spec?.candidatesSource;
  if (!isObject(candidates)) {
    return;
  }
  const where = `${elementLabel(element, index)}의 candidatesSource`;
  if (!dataSources) {
    findings.push({
      level: "warning",
      file,
      message: `data-sources.json이 없어 ${where}의 출처 '${candidates.dataSourceKey}'를 확인하지 못했습니다.`
    });
    return;
  }
  const source = dataSourceByKey.get(candidates.dataSourceKey);
  if (!source) {
    findings.push({
      level: "error",
      file,
      message: `${where}의 데이터 출처 '${candidates.dataSourceKey}'가 카탈로그에 없습니다.`
    });
    return;
  }
  if (source.shape !== "list") {
    findings.push({
      level: "error",
      file,
      message: `${where}의 데이터 출처 '${candidates.dataSourceKey}'는 shape가 '${source.shape}'입니다. 고를 후보이므로 list여야 합니다.`
    });
  }
  checkRequiredParams(
    findings, context.file, source, candidates.params,
    `고를 것을 가져오는 조회 '${candidates.dataSourceKey}'`
  );
  checkArgumentValues(findings, context, candidates.params, {
    declared: paramKeys(source),
    where: `데이터 출처 '${candidates.dataSourceKey}'`
  });
}

function checkRowToneField(findings, context) {
  checkRowField(findings, context, "rowToneField", "줄 색 이름 조각");
  // 줄 앞의 표시를 정하는 조각. 없는 것을 가리키면 그림이 안 나오는데, 그림이
  // 없는 것과 조각이 없는 것은 화면에서 똑같이 보인다.
  checkRowField(findings, context, "iconField", "줄 앞 표시를 정하는 조각");
}

function checkRowField(findings, context, prop, what) {
  const { file, element, index, dataSourceByKey } = context;
  const spec = element.spec;
  if (typeof spec?.[prop] !== "string" || typeof spec.dataSourceKey !== "string") {
    return;
  }
  const source = dataSourceByKey.get(spec.dataSourceKey);
  if (!source) {
    return;
  }
  // 되풀이되는 묶음은 항목의 조각이 안쪽에 있다. 바깥에서 찾으면 늘 없다고 한다.
  const fields =
    typeof spec.itemsField === "string"
      ? ((source.fields ?? []).find((field) => field.key === spec.itemsField)?.fields ?? [])
      : (source.fields ?? []);
  if (!fields.some((field) => field.key === spec[prop])) {
    findings.push({
      level: "error",
      file,
      message: `${elementLabel(element, index)}의 ${what} '${spec[prop]}'가 '${spec.dataSourceKey}'에 없습니다.`
    });
  }
}

// 가져갈 수 있는 값은 실제로 있는 조각이어야 한다. 없으면 눌러도 빈 것이 복사되고
// 아무도 말하지 않는다.
function checkCopyAction(findings, context) {
  const { file, element, index, dataSourceByKey } = context;
  const action = element.spec?.action;
  if (!isObject(action) || action.type !== "copy") {
    return;
  }
  const source = dataSourceByKey.get(action.copySourceKey);
  if (!source) {
    findings.push({
      level: "error",
      file,
      message: `${elementLabel(element, index)}가 가져가려는 출처 '${action.copySourceKey}'가 카탈로그에 없습니다.`
    });
    return;
  }
  if (!(source.fields ?? []).some((field) => field.key === action.copyField)) {
    findings.push({
      level: "error",
      file,
      message: `${elementLabel(element, index)}가 가져가려는 조각 '${action.copyField}'가 '${action.copySourceKey}'에 없습니다.`
    });
  }
}

// 받아 갈 파일도 실제로 있는 조각을 가리켜야 한다. copy와 같은 검사인데 대상이
// 다르다 - 저것은 화면에 그려진 값이고 이것은 서버가 가진 파일이다.
// 줄마다 가는 곳이 다른 이동. 데이터가 화면 id를 직접 주면 검증기가 확인할 수
// 없으므로, 데이터는 열쇠만 주고 갈 곳은 명세가 든다 - 그래서 여기서 그 화면들이
// 실제로 있는지 볼 수 있다.
// 보내고 나면 어디로 가는지. 비어 있으면 '머문다'는 뜻이고 note가 있으면 '아직
// 안 정했다'다. 둘을 함께 적으면 읽는 사람이 무슨 뜻인지 알 수 없다.
//
// 스키마(ajv)도 같은 것을 막지만 여기서도 본다 - 스키마는 파일을 통째로 읽을 때만
// 돌고, 이 검사는 명세 조각만 들고도 돈다.
// 보내고 나서 가는 화면이 인자를 필수로 받는데 아무도 주지 않으면, 그 화면은
// 열리자마자 '무엇의 상세인지 정하지 않고 열렸습니다'만 그린다. 다섯 자리가
// 그렇게 조용히 깨져 있었다 — onSuccess에 인자를 실을 자리가 아예 없었기 때문이다.
// 겹쳐 뜨는 화면은 보는 사람을 따로 말하지 않는다 - 뒤에 남는 화면이 이미
// 말했고, 둘이 갈리면 무엇이 맞는지 아무도 모른다.
function checkOverlayViewer(findings, file, spec) {
  if (isObject(spec.overlay) && typeof spec.viewer === "string") {
    findings.push({
      level: "error",
      file,
      message: `겹쳐 뜨는 화면은 보는 사람(viewer)을 따로 말하지 않습니다. 뒤에 남는 화면 '${spec.overlay.screenId}'이 이미 말합니다.`
    });
  }
}

// 셸의 메뉴도 같다. 겹쳐 뜨는 화면은 뒤에 남는 화면을 그리게 하고, 그 화면이
// 셸을 그린다 - 겹치는 쪽이 적어 두면 아무도 읽지 않는 값이 명세에 남는다.
// 열 곳 모두 그렇게 살고 있었고, 둘이 갈리면 무엇이 맞는지 아무도 모른다.
function checkOverlayNavigation(findings, file, spec) {
  if (isObject(spec.overlay) && typeof spec.activeNavigationScreenId === "string") {
    findings.push({
      level: "error",
      file,
      message: `겹쳐 뜨는 화면은 셸의 메뉴(activeNavigationScreenId)를 따로 말하지 않습니다. 뒤에 남는 화면 '${spec.overlay.screenId}'이 이미 말합니다.`
    });
  }
}

/**
 * 보낸 것의 답에서 집는 조각(resultField)이 실제로 오는가.
 *
 * **이 검사가 없던 동안 resultField는 아무 데도 가리키지 않는 이름이었다** — 오타를
 * 내도 조용했고, 그 자리는 열리지 않는 화면으로 데려간다.
 */
function checkResultFields(findings, context) {
  const { file, element, index, mutations } = context;
  const action = element?.spec?.action;
  if (action?.type !== "submit" || !isObject(action.onSuccess?.params)) {
    return;
  }
  const mutation = (mutations?.mutations ?? []).find(
    (entry) => entry.key === action.mutationKey
  );
  if (!mutation) {
    return;
  }
  const known = new Set((mutation.result ?? []).map((field) => field.key));
  for (const [name, argument] of Object.entries(action.onSuccess.params)) {
    const wanted = isObject(argument) ? argument.resultField : undefined;
    if (typeof wanted !== "string") {
      continue;
    }
    if (!known.has(wanted)) {
      findings.push({
        level: "error",
        file,
        message: `${elementLabel(element, index)}가 '${name}'에 넣으려는 '${wanted}'를 변이 '${action.mutationKey}'가 돌려주지 않습니다. mutations.json의 result에 적으세요.`
      });
    }
  }
}

function checkOnSuccessParams(findings, context) {
  const { file, element, index, screens } = context;
  const action = element.spec?.action;
  const onSuccess = action?.onSuccess;
  if (!isObject(onSuccess) || typeof onSuccess.navigate !== "string") {
    return;
  }
  const target = screens.find((screen) => screen.spec?.screenId === onSuccess.navigate);
  if (!target) {
    return;
  }
  const given = new Set(Object.keys(isObject(onSuccess.params) ? onSuccess.params : {}));
  for (const param of Array.isArray(target.spec?.params) ? target.spec.params : []) {
    if (param?.optional === true || given.has(param?.key)) {
      continue;
    }
    findings.push({
      level: "error",
      file,
      message: `${elementLabel(element, index)}가 보내고 나서 '${onSuccess.navigate}'로 가는데 그 화면이 필수로 받는 인자 '${param?.key}'를 아무도 주지 않습니다.`
    });
  }
}

function checkOnSuccessNote(findings, context) {
  const { file, element, index } = context;
  const onSuccess = element.spec?.action?.onSuccess;
  if (!isObject(onSuccess)) {
    return;
  }
  if (typeof onSuccess.navigate === "string" && typeof onSuccess.note === "string") {
    findings.push({
      level: "error",
      file,
      message: `${elementLabel(element, index)}의 onSuccess가 갈 곳과 '아직 정해지지 않았다'를 함께 적었습니다. 갈 곳이 정해졌으면 적을 것이 없습니다.`
    });
  }
}

function checkBranchingTargets(findings, context) {
  const { file, element, index, screenIds } = context;
  for (const key of ["action", "itemAction", "emptyAction"]) {
    const action = element.spec?.[key];
    if (!isObject(action) || !Array.isArray(action.targets)) {
      continue;
    }
    for (const branch of action.targets) {
      if (!screenIds.has(branch.targetScreenId)) {
        findings.push({
          level: "warning",
          file,
          message: `${elementLabel(element, index)}의 갈림길이 가리킨 화면 '${branch.targetScreenId}'의 명세가 없습니다.`
        });
      }
    }
  }
}

function checkDownloadAction(findings, context) {
  const { file, element, index, dataSourceByKey } = context;
  const action = element.spec?.action;
  if (!isObject(action) || action.type !== "download") {
    return;
  }
  const source = dataSourceByKey.get(action.downloadSourceKey);
  if (!source) {
    findings.push({
      level: "error",
      file,
      message: `${elementLabel(element, index)}가 받아 가려는 출처 '${action.downloadSourceKey}'가 카탈로그에 없습니다.`
    });
    return;
  }
  if (!(source.fields ?? []).some((field) => field.key === action.downloadField)) {
    findings.push({
      level: "error",
      file,
      message: `${elementLabel(element, index)}가 받아 가려는 조각 '${action.downloadField}'가 '${action.downloadSourceKey}'에 없습니다.`
    });
  }
}

// 옮길 수 있는 목록은 **자리를 잃은 사람이 어디 모이는지**를 가리킨다. 그 곳이
// 실제로 있는 목록 출처가 아니면, 뺀 사람이 어디로 갔는지 아무도 답할 수 없다.
function checkItemMovePool(findings, context) {
  const { file, element, index, dataSourceByKey } = context;
  const move = element.spec?.itemMove;
  if (!isObject(move)) {
    return;
  }
  const pool = dataSourceByKey.get(move.poolSourceKey);
  if (!pool) {
    findings.push({
      level: "error",
      file,
      message: `${elementLabel(element, index)}가 가리킨 미배정 출처 '${move.poolSourceKey}'가 카탈로그에 없습니다.`
    });
    return;
  }
  if (pool.shape !== "list") {
    findings.push({
      level: "error",
      file,
      message: `${elementLabel(element, index)}의 미배정 출처 '${move.poolSourceKey}'는 목록이어야 합니다. 자리 없는 사람이 여럿일 수 있습니다.`
    });
  }
}

// 안쪽 목록의 섹션 제목이 바깥 항목에서 온다면(titleField), 그 조각이 실제로
// 바깥 항목에 있어야 한다. 없으면 제목만 빈 채로 그려지고 아무도 말하지 않는다 —
// 열이 가리킨 조각을 보는 것과 같은 이유다.
function checkNestedListTitleField(findings, context) {
  const { file, element, index, dataSourceByKey } = context;
  const spec = element.spec;
  if (typeof spec?.titleField !== "string" || typeof spec.itemsField !== "string") {
    return;
  }
  const outer = isObject(context.inList) ? dataSourceByKey.get(context.inList.dataSourceKey) : null;
  if (!outer) {
    return;
  }
  if (!(outer.fields ?? []).some((field) => field.key === spec.titleField)) {
    findings.push({
      level: "error",
      file,
      message: `${elementLabel(element, index)}의 제목이 가리킨 조각 '${spec.titleField}'가 바깥 항목에 없습니다.`
    });
  }
}

// 표로 그려지는 목록의 열 머리.
//
// 열 머리는 그려지는 글이라 명세가 갖는데, 그 열에 무엇이 오는지는 데이터 출처의
// 조각 이름이다. 둘이 어긋나면 표는 그려지고 칸만 빈다 — 조용한 어긋남이라 여기서
// 본다. 한 조각이 두 열에 오면 어느 칸에 그릴지 화면이 정하게 되므로 그것도 막는다.
function checkListColumns(findings, context) {
  const { file, element, index, dataSources, dataSourceByKey } = context;
  const spec = element.spec;
  const columns = spec.columns;

  if (!Array.isArray(columns) || !isObject(dataSources)) {
    return;
  }

  // 항목이 조각에서 오면 열도 그 조각의 fields로 견줘야 한다. 조각을 어디서 찾는지가
  // 둘로 갈린다 — 출처를 함께 적었으면 그 출처의 응답 안이고, 아니면 바깥 항목이다.
  if (typeof spec.itemsField === "string") {
    const outer =
      typeof spec.dataSourceKey === "string"
        ? dataSourceByKey.get(spec.dataSourceKey)
        : isObject(context.inList)
          ? dataSourceByKey.get(context.inList.dataSourceKey)
          : null;
    if (!outer) {
      return;
    }
    const nested = (outer.fields ?? []).find((field) => field.key === spec.itemsField);
    if (!nested || !Array.isArray(nested.fields)) {
      // 출처를 함께 적은 꼴은 checkDataSource가 이미 말한다 — 두 번 말하지 않는다.
      if (typeof spec.dataSourceKey !== "string") {
        findings.push({
          level: "error",
          file,
          message: `${elementLabel(element, index)}가 가리킨 조각 '${spec.itemsField}'가 바깥 항목에 없거나 fields를 갖지 않습니다. 안쪽 목록의 항목은 그 조각에서 옵니다.`
        });
      }
      return;
    }
    const knownInner = new Set(nested.fields.map((field) => field.key));
    columns.forEach((column, at) => {
      for (const name of [...(column?.fields ?? []), column?.toneField].filter(
        (candidate) => typeof candidate === "string"
      )) {
        if (!knownInner.has(name)) {
          findings.push({
            level: "error",
            file,
            message: `${elementLabel(element, index)}의 ${at + 1}번째 열이 가리킨 조각 '${name}'가 '${spec.itemsField}'에 없습니다.`
          });
        }
      }
    });
    return;
  }

  const source = dataSourceByKey.get(spec.dataSourceKey);
  if (!source) {
    return;
  }

  // 묶음으로 오는 목록에서는 열이 묶음 **안**의 항목을 말한다. 바깥 행은 묶음
  // 자신이고, 그것을 가리키는 것은 group.headerFields다. 여기서 바깥 조각으로
  // 견주면 열이 전부 '없는 조각'으로 보인다.
  const itemsField =
    isObject(spec.group) && typeof spec.group.itemsField === "string"
      ? (source.fields ?? []).find((field) => field.key === spec.group.itemsField)
      : null;
  if (isObject(spec.group) && !itemsField) {
    findings.push({
      level: "error",
      file,
      message: `${elementLabel(element, index)}의 묶음 조각 '${spec.group.itemsField}'가 데이터 출처 '${spec.dataSourceKey}'에 없습니다.`
    });
    return;
  }
  if (itemsField && !Array.isArray(itemsField.fields)) {
    findings.push({
      level: "error",
      file,
      message: `${elementLabel(element, index)}의 묶음 조각 '${spec.group.itemsField}'에 fields가 없습니다. 묶음에 든 항목이 무엇으로 이루어지는지 알 수 없습니다.`
    });
    return;
  }

  const fieldsOfItem = itemsField ? itemsField.fields : (source.fields ?? []);
  const known = new Set(fieldsOfItem.map((field) => field.key));
  const seen = new Map();
  // 머리글이 그려지지 않는 목록은 label이 없다. 그때도 어느 열인지 말할 수 있어야
  // 오류가 쓸모 있으므로 자리로 부른다.
  const nameOf = (column, at) =>
    typeof column?.label === "string" ? `'${column.label}'` : `${at + 1}번째`;

  columns.forEach((column, at) => {
    for (const field of column?.fields ?? []) {
      if (!known.has(field)) {
        findings.push({
          level: "error",
          file,
          message: `${elementLabel(element, index)}의 ${nameOf(column, at)} 열이 가리킨 조각 '${field}'가 데이터 출처 '${spec.dataSourceKey}'에 없습니다.`
        });
        continue;
      }
      const owner = seen.get(field);
      if (owner !== undefined) {
        findings.push({
          level: "error",
          file,
          message: `${elementLabel(element, index)}의 조각 '${field}'가 ${owner} 열과 ${nameOf(column, at)} 열 둘에 옵니다. 한 조각은 한 열에만 올 수 있습니다.`
        });
        continue;
      }
      seen.set(field, nameOf(column, at));
    }
  });

  // 색 이름은 그려지는 글이 아니다. 딱지의 글은 fields가, 그 색은 toneField가
  // 가리킨다 — 둘을 한 열에 섞으면 색 이름이 사람에게 그대로 보인다.
  columns.forEach((column, at) => {
    const toneField = column?.toneField;
    if (typeof toneField !== "string") {
      return;
    }
    if (!known.has(toneField)) {
      findings.push({
        level: "error",
        file,
        message: `${elementLabel(element, index)}의 ${nameOf(column, at)} 열이 가리킨 색 이름 조각 '${toneField}'가 데이터 출처 '${spec.dataSourceKey}'에 없습니다.`
      });
      return;
    }
    if (seen.has(toneField)) {
      findings.push({
        level: "error",
        file,
        message: `${elementLabel(element, index)}의 조각 '${toneField}'가 색 이름이면서 ${seen.get(toneField)} 열에 그려집니다. 색 이름은 어느 열에도 오지 않습니다.`
      });
    }
  });

  // 묶음의 머리는 바깥 행의 조각을 그린다. 열과 가리키는 곳이 반대다.
  const outer = new Set((source.fields ?? []).map((field) => field.key));
  const headerFields = isObject(spec.group) ? spec.group.headerFields : undefined;
  (Array.isArray(headerFields) ? headerFields : []).forEach((column, at) => {
    for (const name of [...(column?.fields ?? []), column?.toneField].filter(
      (candidate) => typeof candidate === "string"
    )) {
      if (!outer.has(name)) {
        findings.push({
          level: "error",
          file,
          message: `${elementLabel(element, index)}의 묶음 머리 ${nameOf(column, at)} 조각 '${name}'가 데이터 출처 '${spec.dataSourceKey}'에 없습니다. 머리는 묶음 자신을 가리킵니다.`
        });
      }
    }
    if (typeof column?.fieldKey === "string") {
      findings.push({
        level: "error",
        file,
        message: `${elementLabel(element, index)}의 묶음 머리에 고치는 칸(fieldKey)이 있습니다. 묶음의 머리는 읽는 자리입니다.`
      });
    }
  });
}

// 쪽으로 나뉜 목록.
//
// 목록은 한 쪽만큼만 받아 오므로 총 몇 건인지·몇 쪽인지를 자기가 말할 수 없다.
// 그 둘을 아는 출처가 따로 있고, 셋이 어긋나면 쪽 버튼이 그려지긴 하는데 늘 한
// 쪽뿐이거나 없는 쪽으로 넘어간다 — 조용한 어긋남이라 여기서 본다.
function checkListPaging(findings, context) {
  const { file, element, index, dataSources, dataSourceByKey } = context;
  const spec = element.spec;
  const paging = spec.paging;

  if (!isObject(paging)) {
    return;
  }

  if (!isObject(dataSources)) {
    findings.push({
      level: "warning",
      file,
      message: `data-sources.json이 없어 ${elementLabel(element, index)}의 쪽 출처 '${paging.dataSourceKey}'를 확인하지 못했습니다.`
    });
    return;
  }

  // 쪽 번호는 목록이 스스로 넘기는 인자다. 출처가 그것을 받지 않으면 쪽을 넘겨도
  // 같은 것이 돌아온다.
  const listSource = dataSourceByKey.get(spec.dataSourceKey);
  if (listSource && !paramKeys(listSource).has(paging.pageParam)) {
    findings.push({
      level: "error",
      file,
      message: `${elementLabel(element, index)}의 쪽 인자 '${paging.pageParam}'가 데이터 출처 '${spec.dataSourceKey}'에 선언돼 있지 않습니다.`
    });
  }
  if (isObject(spec.params) && paging.pageParam in spec.params) {
    findings.push({
      level: "error",
      file,
      message: `${elementLabel(element, index)}가 쪽 인자 '${paging.pageParam}'를 params에도 적었습니다. 쪽 번호는 목록 자신이 갖습니다.`
    });
  }

  const source = dataSourceByKey.get(paging.dataSourceKey);
  if (!source) {
    findings.push({
      level: "error",
      file,
      message: `${elementLabel(element, index)}의 쪽 출처 '${paging.dataSourceKey}'가 카탈로그에 없습니다.`
    });
    return;
  }
  if (source.shape !== "object") {
    findings.push({
      level: "error",
      file,
      message: `${elementLabel(element, index)}의 쪽 출처 '${paging.dataSourceKey}'는 shape가 'object'여야 하는데 '${source.shape}'입니다.`
    });
    return;
  }

  checkArgumentMap(findings, context, paging.params, paging.dataSourceKey);

  const known = new Set((source.fields ?? []).map((field) => field.key));
  for (const [what, field] of [
    ["총 건수", paging.totalNoteField],
    ["쪽 수", paging.pageCountField]
  ]) {
    if (typeof field === "string" && !known.has(field)) {
      findings.push({
        level: "error",
        file,
        message: `${elementLabel(element, index)}의 ${what} 조각 '${field}'가 쪽 출처 '${paging.dataSourceKey}'에 없습니다.`
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
  const {
    file,
    element,
    index,
    dataSourceByKey,
    fieldKeys,
    screenParams,
    screenParamsById,
    requiredParamsById,
    mutationByKey
  } = context;
  const spec = element.spec;

  const actions = [
    { at: "action", action: spec.action },
    { at: "itemAction", action: spec.itemAction },
    // 비었을 때 권하는 단추도 인자를 넘긴다. 그 자리에는 **눌린 줄이 없으므로**
    // itemField를 가리키면 아래에서 오류가 난다(rowFields === null).
    { at: "emptyAction", action: spec.emptyAction }
  ].filter(({ action }) => isObject(action));

  for (const { at, action } of actions) {
    const params = action.params;
    const target = action.targetScreenId;
    const targetParams = screenParamsById?.get(target) ?? null;
    const targetRequired = requiredParamsById?.get(target) ?? null;
    const label = elementLabel(element, index);

    // **보내는 자리도 인자를 받는다.** 오랫동안 인자는 '다음 화면에 넘기는 것'뿐인 줄
    // 알고 제출에는 막아 두었는데, 변이도 자리에 인자가 박혀 있다
    // (`/api/ops/meetings/{meetingId}/hosts/{memberId}`). 막아 둔 탓에 **누구에게 주는지
    // 말할 길이 없었고**, 21곳 중 20곳은 화면 인자와 이름이 우연히 같아 도는 중이었다.
    // **없는 것도 본다.** 처음에는 params가 있을 때만 봤는데, 그러면 아예 안 적은
    // 자리가 조용하다 — 그것이 바로 이 검사가 잡으려던 모양이다(누구에게 주는지
    // 말하지 않던 진행 권한 부여가 그랬다).
    if (action.type === "submit") {
      const mutation = mutationByKey?.get(action.mutationKey) ?? null;
      if (mutation) {
        checkArgumentValues(findings, context, params, {
          declared: paramKeys(mutation),
          where: `제출 계약 '${action.mutationKey}'`
        });
        checkRequiredParams(findings, file, mutation, params, `${label}의 제출 '${action.mutationKey}'`);
      }
      continue;
    }

    if (isObject(params) && action.type !== "navigate") {
      findings.push({
        level: "error",
        file,
        message: `${label}의 ${at}이 이동하지 않는데 인자를 넘깁니다(type=${action.type}). 받을 화면이 없습니다.`
      });
      continue;
    }

    // 항목의 조각은 눌린 행이 있는 자리에서만 가리킬 것이 있다.
    // 눌린 줄이 무엇인지. **묶인 목록에서는 묶음이 아니라 그 안의 항목이다** —
    // 회의 목록은 행사별 묶음으로 오고 눌리는 것은 묶음 안의 회의 한 건이다.
    // 겉의 조각만 보면 항목의 조각을 가리켰을 때 '없다'고 잘못 말한다.
    const listSource = dataSourceByKey.get(spec.dataSourceKey);
    const groupedItemsField = spec.group?.itemsField;
    const rowSourceFields =
      typeof groupedItemsField === "string"
        ? ((listSource?.fields ?? []).find((f) => f?.key === groupedItemsField)?.fields ?? [])
        : (listSource?.fields ?? []);
    const rowFields =
      at === "itemAction" && spec.type === "itemList"
        ? new Set(rowSourceFields.map((f) => f?.key))
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
      // 이 요소가 읽는 출처의 조각. 그 출처에 없으면 넘어가는 값이 빈 채로 간다.
      if (typeof argument.sourceField === "string") {
        const own = dataSourceByKey.get(spec.dataSourceKey);
        if (!own) {
          findings.push({
            level: "error",
            file,
            message: `${label}의 이동 인자 '${paramName}'가 이 요소가 읽는 출처의 조각을 가리키는데 이 요소에는 출처가 없습니다.`
          });
        } else if (!(own.fields ?? []).some((f) => f?.key === argument.sourceField)) {
          findings.push({
            level: "error",
            file,
            message: `${label}의 이동 인자 '${paramName}'가 가리킨 조각 '${argument.sourceField}'가 데이터 출처 '${spec.dataSourceKey}'에 없습니다.`
          });
        }
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
    if (action.type === "navigate" && targetRequired) {
      const given = new Set(Object.keys(isObject(params) ? params : {}));
      const missing = [...targetRequired].filter((name) => !given.has(name));
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

  // 개수도 걸러서 오는 것이라 넘기는 인자가 있다. 조회 인자와 같은 것이므로
  // 같은 판정을 쓴다.
  checkArgumentMap(findings, context, counts.params, counts.dataSourceKey);

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
  // 폼의 값을 되비추는 요약. 가리킨 칸이 없으면 요약만 조용히 빈다.
  for (const item of Array.isArray(element.spec.items) ? element.spec.items : []) {
    if (typeof item?.fieldKey === "string" && !fieldKeys.has(item.fieldKey)) {
      findings.push({
        level: "error",
        file,
        message: `${elementLabel(element, index)}의 '${item.label ?? item.fieldKey}'가 참조한 fieldKey '${item.fieldKey}'가 화면에 없습니다.`
      });
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
  permissions = null,
  permissionsFile = "permissions.json",
  propertyOrderByType = null
} = {}) {
  const findings = [];
  checkPermissions(findings, permissions, permissionsFile);
  const authorizeGroups = [
    [dataSources?.sources, "데이터 출처", "data-sources.json"],
    [optionSources?.sources, "선택지 출처", "option-sources.json"],
    [mutations?.mutations, "변이", mutationsFile]
  ];
  checkAuthorize(findings, permissions, authorizeGroups);
  checkSecretDeclared(findings, permissions, authorizeGroups);
  checkViewerReach(findings, screens, authorizeGroups);
  const screenIds = new Set(
    screens
      .map((screen) => screen?.spec?.screenId)
      .filter((screenId) => typeof screenId === "string")
  );
  // 화면마다 '받는 인자'. 이동하는 쪽이 무엇을 넘겨야 하는지 여기서만 알 수 있다.
  //
  // 두 벌이다. **받을 수 있는 것**과 **반드시 받아야 하는 것**은 다르다 —
  // 없어도 화면이 열리는 인자는 넘기지 않아도 되지만, 넘기면 받아야 한다.
  // FIN-REQ-01은 요청 id가 있으면 고치고 없으면 새로 쓴다.
  const paramsOf = (screen, onlyRequired) =>
    new Set(
      (Array.isArray(screen.spec.params) ? screen.spec.params : [])
        .filter((param) => !onlyRequired || param?.optional !== true)
        .map((param) => param?.key)
        .filter((key) => typeof key === "string")
    );
  const named = screens.filter((screen) => typeof screen?.spec?.screenId === "string");
  const screenParamsById = new Map(
    named.map((screen) => [screen.spec.screenId, paramsOf(screen, false)])
  );
  const requiredParamsById = new Map(
    named.map((screen) => [screen.spec.screenId, paramsOf(screen, true)])
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
  const mutationByKey = new Map(mutationList.map((mutation) => [mutation.key, mutation]));

  const payloadFieldKeys = payloadFieldKeysByScope(screens);

  // 제출 계약이 참조하는 payload 스코프는 카탈로그에 있어야 한다.
  for (const mutation of mutationList) {
    if (typeof mutation?.payloadScope === "string" && !scopeKeys.has(mutation.payloadScope)) {
      findings.push({
        level: "error",
        file: mutationsFile,
        message: `제출 계약 '${mutation.key}'의 payloadScope '${mutation.payloadScope}'가 상태 스코프 카탈로그에 없습니다.`
      });
    }
    checkRepeat(findings, mutationsFile, mutation, payloadFieldKeys);
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

    // **명세가 그리라고 한 제목이 그림에 없으면 오류다.**
    //
    // 네 번 그랬다(OPS-MEET-03B·03C·05B·08). 넷 다 변형이고, 바탕은 제목을
    // 데이터에서 받는데(meta.titleFrom) 변형은 그 말을 빠뜨렸다 — 명세만 읽고
    // 화면을 만드는 사람은 '예정 회의 관리'라는 글을 제목으로 그리게 되고, 그
    // 글은 어느 프레임에도 없다.
    //
    // 변형만 본다. 바탕 화면은 그 자리를 요소로 등록하는 일이 없어(제목은 셸의
    // 것이다) 대조가 보지 않는 것은 같지만, 지금까지 틀린 것이 전부 변형이다 —
    // 변형은 '다른 부분만' 적으므로 빠뜨리기 쉬운 자리다.
    if (isObject(spec.variantOf) && !isObject(spec.meta?.titleFrom)) {
      const title = spec.meta?.title;
      const drawn = designs[spec.screenId];
      if (typeof title === "string" && isObject(drawn)) {
        if (!designDrawsText(drawn.design?.root ?? drawn.root ?? drawn, title)) {
          findings.push({
            level: "error",
            file,
            message: `제목 '${title}'을 그리라고 했는데 그림에 그 글이 없습니다. 제목이 데이터에서 오면 meta.titleFrom으로 말하고(바탕 화면이 그렇게 합니다), 그리는 글이 다르면 그림에 있는 글로 적으세요.`
          });
        }
      }
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
        //
        // 갈피 아래로 한 겹 더 들어가는 화면은 자기를 가리키는 갈피가 없다. 그때는
        // 어느 갈피 아래인지를 화면이 말하고, 켜지는 것은 그 갈피다.
        const activeTab = workspace.activeTabScreenId ?? spec.screenId;
        if (workspace.activeTabScreenId === spec.screenId) {
          findings.push({
            level: "error",
            file,
            message: `작업 공간 '${workspace.key}'의 activeTabScreenId가 이 화면 자신을 가리킵니다. 갈피면 적지 않고, 갈피가 아니면 다른 화면을 가리킵니다.`
          });
        }
        const here = (declared.tabs ?? []).filter((item) => item?.targetScreenId === activeTab);
        if (here.length === 0) {
          findings.push({
            level: "warning",
            file,
            message: `작업 공간 '${workspace.key}'의 갈피 중 '${activeTab}'을 가리키는 것이 없습니다. 갈피 줄이 지금 어디인지 표시하지 못합니다.`
          });
        } else if (here.length > 1) {
          findings.push({
            level: "error",
            file,
            message: `작업 공간 '${workspace.key}'의 갈피 ${here.length}개가 같은 화면 '${activeTab}'을 가리킵니다.`
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
        const declared = paramKeys(source);
        checkRequiredParams(findings, file, source, titleFrom.params, "화면 제목");
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

    const declaredScreenParams = new Set(
      (Array.isArray(spec.params) ? spec.params : [])
        .map((param) => param?.key)
        .filter((key) => typeof key === "string")
    );

    checkOverlayViewer(findings, file, spec);
    checkOverlayNavigation(findings, file, spec);

    // 셸의 어느 메뉴 아래인지. 갈피의 activeTabScreenId와 같은 축이고, 가리키는
    // 화면이 실제로 메뉴여야 켜진다.
    if (typeof spec.activeNavigationScreenId === "string") {
      if (spec.activeNavigationScreenId === spec.screenId) {
        findings.push({
          level: "error",
          file,
          message: `activeNavigationScreenId가 이 화면 자신을 가리킵니다. 메뉴가 가리키는 화면이면 적지 않습니다.`
        });
      } else if (isObject(shell) && Array.isArray(shell.navigation)) {
        const menu = shell.navigation.filter(
          (item) => item?.targetScreenId === spec.activeNavigationScreenId
        );
        if (menu.length === 0) {
          findings.push({
            level: "error",
            message: `activeNavigationScreenId '${spec.activeNavigationScreenId}'를 가리키는 셸 메뉴가 없습니다. 켜질 메뉴가 없으면 적을 뜻이 없습니다.`,
            file
          });
        }
      }
    }

    checkParamMissingNotes(findings, file, spec);
    checkBreadcrumb(findings, file, spec, {
      dataSources,
      dataSourceByKey,
      screenParams: declaredScreenParams
    });
    checkDraftFrom(findings, file, spec, {
      dataSources,
      dataSourceByKey,
      screenParams: declaredScreenParams
    });

    const flattened = allElementsOf(spec);
    const fieldKeys = new Set();
    const seenFieldKeys = new Set();
    const seenNodeIds = new Set();
    flattened.forEach(({ element }, index) => {
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

      // **고른 것도 화면의 값이다.** 누르면 그 항목이 칸에 담기므로(`choose`)
      // 그 칸은 입력 칸과 똑같이 다른 요소가 가리킬 수 있어야 한다. 여기 없으면
      // 가리키는 자리마다 '화면에 없는 칸'이라고 잘못 말한다.
      for (const at of ['action', 'itemAction', 'emptyAction']) {
        const action = isObject(spec_) ? spec_[at] : undefined;
        if (isObject(action) && action.type === 'choose' && typeof action.fieldKey === 'string') {
          fieldKeys.add(action.fieldKey);
        }
      }
    });

    const listsByFieldKey = new Map(
      flattened
        .map(({ element }) => element?.spec)
        .filter((candidate) => isObject(candidate) && candidate.type === "list")
        .map((candidate) => [candidate.fieldKey, candidate])
    );
    const groupedFieldKeys = new Set();
    flattened.forEach(({ element, inList }, index) => {
      const spec_ = element?.spec;
      if (!isObject(spec_)) {
        return;
      }
      const context = {
        file,
        element,
        index,
        inList,
        listsByFieldKey,
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
        mutationByKey,
        clearOnByScope,
        // 갈림길이 가리킨 화면이 실제로 있는지 보려면 화면 목록이 필요하다.
        screenIds,
        // 보내고 나서 가는 화면이 무엇을 필수로 받는지 보려면 그 명세가 필요하다.
        screens,
        screenScopeKey: spec.stateScopeKey,
        // 이 화면이 밖에서 받는 인자. 상세 화면만 갖는다.
        screenParams: new Set(
          (Array.isArray(spec.params) ? spec.params : [])
            .map((param) => param?.key)
            .filter((key) => typeof key === "string")
        ),
        screenParamsById,
        requiredParamsById,
        propertyOrderByType
      };
      checkPropertyOrder(findings, context);
      // 유형과 무관하다 — 어느 요소든 데이터가 허락할 때만 그려질 수 있다.
      checkDrawnWhen(findings, context);
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
        checkListItemFields(findings, context);
        checkCandidatesSource(findings, context);
      }
      if (spec_.type === "button") {
        checkSubmitAction(findings, context);
        checkResultFields(findings, context);
        // 집어 가는 것과 받아 가는 것은 **button의 동작**이다. 오래 itemList
        // 가지에 걸려 있어서 checkCopyAction은 실제 명세에서 한 번도 돈 적이
        // 없었다 - itemList에는 action이 없다(itemAction이다). 계약 검사도
        // 없어 아무도 몰랐다.
        checkCopyAction(findings, context);
        checkDownloadAction(findings, context);
      }
      if (spec_.type === "summary") {
        checkSummaryCompute(findings, context);
      }
      if (spec_.type === "steps") {
        checkSteps(findings, context);
      }
      if (spec_.type === "fieldSet") {
        checkFieldSet(findings, context);
      }
      if (
        spec_.type === "summary" ||
        spec_.type === "itemList" ||
        spec_.type === "steps" ||
        spec_.type === "fieldSet"
      ) {
        checkDataSource(findings, context);
        // 조회 인자는 목록만의 것이 아니다 — 상세 화면의 요약도 한 건을 집어 온다.
        checkQueryParams(findings, context);
      }
      if (spec_.type === "itemList") {
        checkListColumns(findings, context);
        checkNestedListTitleField(findings, context);
        checkItemMovePool(findings, context);
        checkRowToneField(findings, context);
        checkListPaging(findings, context);
      }
      if (spec_.type === "select") {
        checkOptionCounts(findings, context);
      }
      checkOnSuccessParams(findings, context);
      checkOnSuccessNote(findings, context);
      checkBranchingTargets(findings, context);
      checkFieldReferences(findings, context);
      checkNavigateParams(findings, context);

      // navigate의 targetScreenId와 submit 성공 후 이동은 같은 규칙으로 검사한다.
      for (const targetScreenId of [
        spec_.action?.targetScreenId,
        spec_.action?.onSuccess?.navigate,
        spec_.itemAction?.targetScreenId,
        spec_.selection?.action?.targetScreenId
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

        // 갈피가 공간의 상태에 따라 갈릴 때. **가르는 것은 열쇠이지 그려지는
        // 말이 아니다** — 그 열쇠가 상태 줄이 읽는 출처에 없으면, 갈래는 늘
        // 기본으로 떨어지고 아무도 그 사실을 모른다.
        if (typeof item?.targetField === "string") {
          const statusKey = workspace.status?.dataSourceKey;
          const statusSource = statusKey ? dataSourceByKey.get(statusKey) : undefined;
          if (!statusSource) {
            findings.push({
              level: "error",
              file: shellFile,
              message: `작업 공간 '${workspace.key}'의 갈피 '${item.label}'이 상태로 갈리는데 이 공간에는 상태 줄이 없습니다.`
            });
          } else if (!(statusSource.fields ?? []).some((f) => f?.key === item.targetField)) {
            findings.push({
              level: "error",
              file: shellFile,
              message: `작업 공간 '${workspace.key}'의 갈피 '${item.label}'이 가리킨 조각 '${item.targetField}'가 상태 줄의 출처 '${statusKey}'에 없습니다.`
            });
          }
          if (typeof targetScreenId !== "string") {
            findings.push({
              level: "error",
              file: shellFile,
              message: `작업 공간 '${workspace.key}'의 갈피 '${item.label}'이 상태로 갈리는데 기본 화면(targetScreenId)이 없습니다. 갈피는 늘 갈 곳이 있어야 합니다.`
            });
          }
          for (const target of item.targets ?? []) {
            if (typeof target?.targetScreenId !== "string") {
              continue;
            }
            if (!screenIds.has(target.targetScreenId)) {
              findings.push({
                level: "warning",
                file: shellFile,
                message: `작업 공간 '${workspace.key}'의 갈피 '${item.label}'이 '${target.value}'일 때 가리키는 화면 '${target.targetScreenId}'의 명세 파일이 아직 없습니다.`
              });
            }
          }
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
