import {
  checkArgumentMap,
  checkArgumentValues,
  checkRequiredParams
} from "./source-parameters.mjs";
import {
  checkBreadcrumb,
  checkDataSource,
  checkDraftFrom,
  checkDrawnWhen,
  checkFieldSet,
  checkQueryParams,
  checkSteps,
  collectScreenTitleSourceFindings
} from "./source-validation.mjs";
import {
  checkCandidatesSource,
  checkItemMovePool,
  checkListColumns,
  checkListItemFields,
  checkListPaging,
  checkListReferences,
  checkNestedListTitleField,
  checkRowToneField
} from "./list-validation.mjs";
import { checkOptionCounts, checkOptionsSource } from "./option-validation.mjs";
import {
  collectDesignTitleFindings,
  collectScreenDesignFindings
} from "./design-validation.mjs";
export { collectDesignNodeIds } from "./design-validation.mjs";
import { collectPermissionFindings } from "./permission-validation.mjs";
import { elementLabel, FIELD_ELEMENT_TYPES, isObject, paramKeys } from "./spec-validation-values.mjs";
import { allElementsOf } from "./element-walk.mjs";

import { DRAFT_SIGNALS } from "./screen-draft.mjs";

/**
 * **한 이름이 두 벌을 가리키면 어느 쪽도 참이 아니다.**
 *
 * 읽는 쪽과 검사하는 쪽이 서로 다른 것을 고른다 — 데이터 출처는 `.find`로 **첫 것**을,
 * 검증기는 `Map`으로 **마지막 것**을 고르고, 선택지와 변이는 또 마지막 것이다. 그러면
 * 명세가 말하는 모양과 화면이 그리는 값이 조용히 갈린다.
 *
 * **초안에서도 오류다.** 같은 열쇠가 둘인 것이 옳은 때는 없다 — 아직 안 정한 것은
 * 열쇠를 둘로 만드는 것이 아니라 하나를 안 만드는 것이다.
 */
function checkCatalogKeysUnique(findings, groups) {
  for (const [items, what, file] of groups) {
    const seen = new Set();
    for (const item of Array.isArray(items) ? items : []) {
      const key = item?.key;
      if (typeof key !== "string") continue;
      if (seen.has(key)) {
        findings.push({
          level: "error",
          file,
          message: `${what} '${key}'가 두 번 적혀 있습니다. 읽는 쪽은 첫 것을, 검사하는 쪽은 마지막 것을 고릅니다.`
        });
        continue;
      }
      seen.add(key);
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
  const authorizeGroups = [
    [dataSources?.sources, "데이터 출처", "data-sources.json"],
    [optionSources?.sources, "선택지 출처", "option-sources.json"],
    [mutations?.mutations, "변이", mutationsFile]
  ];
  findings.push(...collectPermissionFindings({
    permissions, permissionsFile, screens, groups: authorizeGroups
  }));
  checkCatalogKeysUnique(findings, [
    ...authorizeGroups,
    [stateScopes?.scopes, "상태 스코프", "state-scopes.json"],
    [permissions?.areas, "권한 영역", permissionsFile],
    [permissions?.conditions, "권한 조건", permissionsFile]
  ]);
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

    findings.push(...collectDesignTitleFindings({
      file, spec, designEntry: designs[spec.screenId]
    }));

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

    findings.push(...collectScreenTitleSourceFindings({
      file, spec, dataSources, dataSourceByKey
    }));

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

    findings.push(...collectScreenDesignFindings({
      screen, designEntry: designs[spec.screenId], shell
    }));
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
