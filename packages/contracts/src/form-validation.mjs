import {
  elementLabel,
  FIELD_ELEMENT_TYPES,
  isObject
} from "./spec-validation-values.mjs";


// 화면들이 선언한 상태 스코프별로, 그 스코프에 값을 쓰는 fieldKey 집합을 모은다.
// note는 다른 화면의 스코프를 읽으므로 화면 단위가 아니라 wireframe 단위로 봐야 한다.
export function collectFieldKeysByScope(screens) {
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


export function checkNoteFieldRefs(findings, context) {
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


export function checkGroupMembers(findings, context) {
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


// 화면이 스스로 셈하는 값.
//
// 셈이 가리키는 목록과 칸이 실제로 있어야 한다. 없으면 값은 조용히 0이 되고,
// 0원은 틀린 값처럼 보이지 않는다 — 아직 아무것도 안 넣은 것처럼 보인다.
export function checkSummaryCompute(findings, context) {
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


// 플러그인은 스키마 선언 순서로 화면 JSON을 쓴다. 손으로 쓴 파일의 순서가
// 다르면 Figma에서 저장할 때마다 순서만 바뀐 diff가 나오고, "저장 후 diff가
// 비어 있다"를 왕복 보존의 신호로 쓸 수 없게 된다. 값이 아니라 표현의 문제라
// 기계적으로 고칠 수 있고, 그래서 경고가 아니라 오류다.
export function checkPropertyOrder(findings, context) {
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


export function checkFieldReferences(findings, context) {
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
