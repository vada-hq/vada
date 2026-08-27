const VALUE_FIELD_TYPES = new Set(["input", "select"]);

export function hasFieldValue(value) {
  if (value === null || value === undefined) {
    return false;
  }

  return typeof value !== "string" || value.trim().length > 0;
}

function getElementSpec(element) {
  return element?.spec ?? element;
}

// 이 화면에서 **채워야 하는 것**들. 명세가 아는 만큼만 말한다.//// 한동안 최상위 input/select만 봤다. 그래서 FIN-REQ-01은 필수 10개 중 3개만// 보였고, FIN-REV-01은 0개라 늘 통과했다 - 재현으로 확인했다. 되풀이되는 묶음// 안의 칸도 채워야 하는 칸이다.//// 갈래가 셋이다.// · 평평한 칸 - fieldKey 하나에 값 하나. 판정기가 스스로 답할 수 있다.// · 되풀이되는 묶음 안의 칸(inList) - 값이 항목마다 있다. 몇 개인지는 데이터가//   정하므로 **명세도 판정기도 모른다.**// · 칸 목록이 데이터에서 오는 묶음(fromSet) - 칸의 이름조차 데이터가 준다.//// 뒤의 둘은 화면이 답해야 한다. 판정기가 짐작하면 조용히 통과시키게 되고,// 그것이 바로 이 자리가 한동안 틀려 있던 방식이다.export function getRequiredFieldCandidates(elements, inList = null) {  const candidates = [];  for (const element of Array.isArray(elements) ? elements : []) {    const spec = getElementSpec(element);    const fieldKey = spec?.fieldKey?.trim();    // 칸 목록이 데이터에서 오는 묶음. 무엇을 채워야 하는지는 그릴 때 알게 된다.    if (spec?.type === "fieldSet" && spec.required === true && fieldKey) {      candidates.push({        fieldKey,        label: typeof spec.label === "string" ? spec.label : fieldKey,        enabledWhen: [],        inList: inList?.fieldKey ?? null,        fromSet: true      });    }    // 안쪽 요소도 화면의 요소와 같은 규칙을 받는다.    if (Array.isArray(spec?.itemFields)) {      candidates.push(...getRequiredFieldCandidates(spec.itemFields, spec));    }    if (      !VALUE_FIELD_TYPES.has(spec?.type) ||      spec.required !== true ||      !fieldKey    ) {      continue;    }    candidates.push({      fieldKey,      label: typeof spec.label === "string" ? spec.label : fieldKey,      enabledWhen: Array.isArray(spec.enabledWhen)        ? spec.enabledWhen.map((condition) => ({ ...condition }))        : [],      inList: inList?.fieldKey ?? null,      fromSet: false    });  }  return candidates;}
function isConditionSatisfied(condition, values) {
  if (condition?.operator !== "hasValue") {
    throw new TypeError(
      `지원하지 않는 활성화 조건입니다: ${condition?.operator ?? "없음"}`
    );
  }

  return hasFieldValue(values?.[condition.fieldKey]);
}

function isCandidateApplicable(candidate, values) {
  return candidate.enabledWhen.every((condition) =>
    isConditionSatisfied(condition, values)
  );
}

const SUPPORTED_ACTION_TYPES = new Set(["navigate", "submit"]);

function assertSupportedAction(action) {
  if (!SUPPORTED_ACTION_TYPES.has(action?.type)) {
    throw new TypeError(`지원하지 않는 버튼 action입니다: ${action?.type ?? "없음"}`);
  }

  // 실행 조건 판정은 action 종류와 무관하다. submit도 같은 필수값 규칙을 쓴다.

  const hasExecuteWhen = action.executeWhen !== undefined;
  const hasOnExecutionBlocked = action.onExecutionBlocked !== undefined;

  if (hasExecuteWhen !== hasOnExecutionBlocked) {
    throw new TypeError(
      "executeWhen과 onExecutionBlocked는 함께 명시해야 합니다."
    );
  }

  if (!hasExecuteWhen) {
    return null;
  }

  // 판정은 둘이다. 화면이 아는 것(필수 칸이 다 찼는가)과 화면이 모르는 것
  // (서버가 막았는가) - 무엇이 '다 됐다'인지는 조직의 규칙일 때가 있다.
  const gate = action.executeWhen?.type;
  if (gate === "allRequiredFieldsHaveValue") {
    if (action.executeWhen?.scope !== "screen") {
      throw new TypeError("지원하지 않는 버튼 실행 조건입니다.");
    }
    if (
      action.onExecutionBlocked?.type !== "showMissingRequiredFields" ||
      action.onExecutionBlocked?.focus !== "firstMissingField"
    ) {
      throw new TypeError("지원하지 않는 버튼 실행 차단 동작입니다.");
    }
    return gate;
  }
  if (gate === "sourceAllows") {
    if (
      typeof action.executeWhen?.dataSourceKey !== "string" ||
      typeof action.executeWhen?.blockedNoteField !== "string"
    ) {
      throw new TypeError("sourceAllows에는 출처와 막은 이유 조각이 필요합니다.");
    }
    if (action.onExecutionBlocked?.type !== "showBlockedNote") {
      throw new TypeError("지원하지 않는 버튼 실행 차단 동작입니다.");
    }
    return gate;
  }
  throw new TypeError("지원하지 않는 버튼 실행 조건입니다.");
}

// 버튼을 눌러도 되는가.
//
// **명세가 무엇을 봐야 하는지 알고, 그 값이 찼는지는 화면만 안다.** 되풀이되는
// 묶음 안의 칸은 항목마다 값이 있고 몇 개인지는 데이터가 정하며, 칸 목록이
// 데이터에서 오는 묶음은 칸 이름조차 그릴 때 알게 된다. 그래서 그 둘은 화면이
// isFilled로 답해야 하고, **답하지 않으면 던진다** - 짐작해서 통과시키면 그것이
// 바로 이 자리가 한동안 틀려 있던 방식이다(FIN-REV-01은 필수가 0개로 보였다).
export function evaluateButtonExecution({
  action,
  elements,
  values = {},
  isFilled,
  sourceBlockedNote
}) {
  const gate = assertSupportedAction(action);

  if (gate === null) {
    return {
      allowed: true,
      applicableFieldKeys: [],
      missingFieldKeys: [],
      onExecutionBlocked: null
    };
  }

  if (gate === "sourceAllows") {
    if (sourceBlockedNote === undefined) {
      throw new TypeError(
        "sourceAllows는 서버가 막았는지를 화면이 넘겨야 합니다(sourceBlockedNote)."
      );
    }
    const blocked = hasFieldValue(sourceBlockedNote);
    return {
      allowed: !blocked,
      applicableFieldKeys: [],
      missingFieldKeys: [],
      blockedNote: blocked ? sourceBlockedNote : null,
      onExecutionBlocked: blocked ? { ...action.onExecutionBlocked } : null
    };
  }

  const applicableCandidates = getRequiredFieldCandidates(elements).filter(
    (candidate) => isCandidateApplicable(candidate, values)
  );
  const missingFieldKeys = applicableCandidates
    .filter((candidate) => {
      // 판정기가 스스로 답할 수 없는 것. 화면이 답하지 않으면 조용히 통과하는
      // 대신 드러낸다.
      if (candidate.inList !== null || candidate.fromSet) {
        if (typeof isFilled !== "function") {
          throw new TypeError(
            `'${candidate.fieldKey}'는 되풀이되거나 데이터가 칸을 정하는 자리입니다. ` +
              "값이 찼는지를 화면이 isFilled로 답해야 합니다."
          );
        }
        return !isFilled(candidate);
      }
      return typeof isFilled === "function"
        ? !isFilled(candidate)
        : !hasFieldValue(values[candidate.fieldKey]);
    })
    .map((candidate) => candidate.fieldKey);
  const allowed = missingFieldKeys.length === 0;

  return {
    allowed,
    applicableFieldKeys: applicableCandidates.map(
      (candidate) => candidate.fieldKey
    ),
    missingFieldKeys,
    onExecutionBlocked: allowed ? null : { ...action.onExecutionBlocked }
  };
}
