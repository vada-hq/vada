// 화면의 요소를 훑는 **한 곳**.
//
// 왜 따로 있는가. `itemFields`가 생긴 뒤로 화면의 요소는 평평하지 않다 — 목록
// 하나가 안쪽에 요소를 여럿 담는다. 그런데 그것을 읽는 곳이 다섯이었고
// (스키마 재검증 · 검증 규칙 · 버튼 판정 · 흐름 · 출처 추적) **넷이 최상위만
// 훑고 있었다.**
//
// 무엇이 새어 나갔는지는 재현으로 확인했다.
// · 중첩 input에 없는 inputType과 불리언 자리에 글을 넣어도 검증 0건
// · FIN-REQ-01의 필수 10개 중 판정기가 보는 것은 3개
// · FIN-REV-01은 판정기가 보는 필수가 0개라 늘 통과
// · 흐름 보고서가 itemAction 9건을 놓침
//
// **한 곳이 늘 때마다 다섯 곳이 따로 늘어야 하는 구조가 원인이다.** 여기 모아
// 두면 요소가 담기는 새 자리가 생겨도 고칠 곳이 하나다.

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/**
 * 화면의 모든 요소를 그려지는 순서대로. 안쪽 요소는 바로 뒤에 따라온다.
 *
 * 각 줄은 `{ element, inList, path }`다.
 * · inList — 이 요소를 담은 목록의 spec. 최상위면 null이다. 항목 안에서만 뜻이
 *   있는 규칙이 있어서 들고 다닌다(compute의 product는 한 항목 안의 셈이다).
 * · path — 사람에게 어디인지 말할 때 쓴다. 예: `elements[3].itemFields[1]`
 */
export function allElementsOf(spec) {
  const out = [];
  const elements = Array.isArray(spec?.elements) ? spec.elements : [];

  elements.forEach((element, index) => {
    out.push({ element, inList: null, path: `elements[${index}]` });

    // 요소를 담는 자리는 지금 itemFields 하나다. 늘면 여기만 고친다.
    const nested = isObject(element?.spec) ? element.spec.itemFields : undefined;
    if (!Array.isArray(nested)) {
      return;
    }
    nested.forEach((child, at) => {
      out.push({
        element: child,
        inList: element.spec,
        path: `elements[${index}].itemFields[${at}]`
      });
    });
  });

  return out;
}

/**
 * 화면의 모든 동작. 요소 하나가 동작을 여럿 가질 수 있다.
 *
 * 지금까지 흐름 보고서는 `spec.action`만 봤다. 그런데 목록의 항목을 누르는 것도
 * (itemAction), 고른 것들에 하는 일도(selection.action) 화면을 옮긴다 —
 * **실제 번들의 이동 30건 중 9건이 그 자리에 있었고 보고서에 없었다.**
 */
export function allActionsOf(spec) {
  const out = [];

  for (const { element, path } of allElementsOf(spec)) {
    const elementSpec = element?.spec;
    if (!isObject(elementSpec)) {
      continue;
    }
    const label =
      typeof elementSpec.label === "string"
        ? elementSpec.label
        : typeof elementSpec.title === "string"
          ? elementSpec.title
          : "";

    const candidates = [
      ["action", elementSpec.action],
      ["itemAction", elementSpec.itemAction],
      ["selection.action", elementSpec.selection?.action]
    ];
    for (const [at, action] of candidates) {
      if (isObject(action)) {
        out.push({ action, element, label, path: `${path}.${at}` });
      }
    }
  }

  return out;
}
