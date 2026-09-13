import { elementLabel, isObject, paramKeys } from "./spec-validation-values.mjs";


/**
 * **두 번 보내지면 어떻게 되는가**를 적어 둔 것이 실제로 판정 가능한가.
 *
 * `naturalKey`는 '이미 있는지 데이터가 답한다'는 뜻이다. 그런데 그 열쇠가 실제로 오는
 * 값이 아니면 받는 쪽은 가릴 것이 없다 — 적어만 두고 판정할 수 없는 계약이 된다.
 *
 * 열쇠는 둘 중 하나에서 온다. **이 자리의 인자**(경로가 실어 온 토큰)이거나
 * **보내는 값의 칸**(폼에 적은 학번)이다.
 */
export function checkRepeat(findings, file, mutation, fieldKeysByScope) {
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
export function payloadFieldKeysByScope(screens) {
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


export function checkSubmitAction(findings, context) {
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


/**
 * 보낸 것의 답에서 집는 조각(resultField)이 실제로 오는가.
 *
 * **이 검사가 없던 동안 resultField는 아무 데도 가리키지 않는 이름이었다** — 오타를
 * 내도 조용했고, 그 자리는 열리지 않는 화면으로 데려간다.
 */
export function checkResultFields(findings, context) {
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


export function checkOnSuccessNote(findings, context) {
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
