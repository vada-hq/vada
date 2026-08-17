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

export function getRequiredFieldCandidates(elements) {
  const candidates = [];

  for (const element of Array.isArray(elements) ? elements : []) {
    const spec = getElementSpec(element);
    const fieldKey = spec?.fieldKey?.trim();

    if (
      !VALUE_FIELD_TYPES.has(spec?.type) ||
      spec.required !== true ||
      !fieldKey
    ) {
      continue;
    }

    candidates.push({
      fieldKey,
      label: typeof spec.label === "string" ? spec.label : fieldKey,
      enabledWhen: Array.isArray(spec.enabledWhen)
        ? spec.enabledWhen.map((condition) => ({ ...condition }))
        : []
    });
  }

  return candidates;
}

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

function assertSupportedAction(action) {
  if (action?.type !== "navigate") {
    throw new TypeError(`지원하지 않는 버튼 action입니다: ${action?.type ?? "없음"}`);
  }

  const hasExecuteWhen = action.executeWhen !== undefined;
  const hasOnExecutionBlocked = action.onExecutionBlocked !== undefined;

  if (hasExecuteWhen !== hasOnExecutionBlocked) {
    throw new TypeError(
      "executeWhen과 onExecutionBlocked는 함께 명시해야 합니다."
    );
  }

  if (!hasExecuteWhen) {
    return false;
  }

  if (
    action.executeWhen?.type !== "allRequiredFieldsHaveValue" ||
    action.executeWhen?.scope !== "screen"
  ) {
    throw new TypeError("지원하지 않는 버튼 실행 조건입니다.");
  }

  if (
    action.onExecutionBlocked?.type !== "showMissingRequiredFields" ||
    action.onExecutionBlocked?.focus !== "firstMissingField"
  ) {
    throw new TypeError("지원하지 않는 버튼 실행 차단 동작입니다.");
  }

  return true;
}

export function evaluateButtonExecution({ action, elements, values = {} }) {
  const gated = assertSupportedAction(action);

  if (!gated) {
    return {
      allowed: true,
      applicableFieldKeys: [],
      missingFieldKeys: [],
      onExecutionBlocked: null
    };
  }

  const applicableCandidates = getRequiredFieldCandidates(elements).filter(
    (candidate) => isCandidateApplicable(candidate, values)
  );
  const missingFieldKeys = applicableCandidates
    .filter((candidate) => !hasFieldValue(values[candidate.fieldKey]))
    .map((candidate) => candidate.fieldKey);
  const allowed = missingFieldKeys.length === 0;

  return {
    allowed,
    applicableFieldKeys: applicableCandidates.map(
      (candidate) => candidate.fieldKey
    ),
    missingFieldKeys,
    onExecutionBlocked: allowed
      ? null
      : { ...action.onExecutionBlocked }
  };
}
