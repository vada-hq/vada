// 명세 검증에서 공유하는 값 해석. 카탈로그나 검증 실행기에 의존하지 않는다.
export function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

// 인자의 이름들. 카탈로그의 인자는 이름·필수·값의 종류·설명을 갖는 묶음이고,
// 여기서 보는 것은 그중 이름뿐이다 — 꺼내는 자리를 흩으면 모양이 또 바뀔 때 갈린다.
export function paramKeys(source) {
  const params = Array.isArray(source?.params) ? source.params : [];
  return new Set(params.map((param) => param?.key));
}

export function elementLabel(element, index) {
  const spec = element?.spec;
  const name = spec?.fieldKey ?? spec?.label ?? element?.source?.nodeId;
  return name ? `elements[${index}](${name})` : `elements[${index}]`;
}
