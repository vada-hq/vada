export const BUTTON_NAME_PATTERN = /^(Btn|Button)\b/u;
export const SEARCHABLE_WRAPPER_NAME = "ProfileSearchSelect";
// 디자인이 칸에 붙이는 이름들.
//
// **오랫동안 둘뿐이었다.** 그래서 `Text Area` 21곳 · `Checkbox` 21곳 ·
// `Number Input` 13곳 · `Switch` 1곳이 추출기에도 역방향 검사에도 **없는 것과
// 같았다** — 그림에 그려진 칸을 명세가 통째로 빠뜨려도 아무도 몰랐다는 뜻이고,
// OPS-MEET-05A/05B의 회의록 본문(그 화면에서 가장 큰 요소)이 실제로 그랬다.
//
// 이름을 손으로 드는 목록인 것은 어쩔 수 없다 — 디자인이 붙인 이름을 명세가
// 정할 수는 없다. 대신 **빠진 이름이 조용하지 않게** 한다: 역방향 검사가 이
// 목록에 있는 것만 보므로, 목록이 짧으면 검사가 눈을 감는다.
export const CONTROL_NAMES = new Set([
  "Text Input",
  "Number Input",
  "Text Area",
  "Dropdown",
  "Checkbox",
  "Switch"
]);
// 칸 이름이 **무엇을 받는 칸인지**를 말한다.
//
// 이름을 목록에 넣기만 하면 역방향 검사는 보지만 초안은 여전히 전부 `text`로 뽑는다 —
// 체크 상자를 글 칸으로 적어 놓고 사람이 고치기를 기다리는 것이라, 고치기를 잊으면
// 명세가 틀린 채로 남는다. 디자인이 아는 만큼은 초안이 들고 온다.
//
// `Dropdown`은 여기 없다. 그쪽은 고르는 칸이라 input이 아니고, 선택지 출처를 사람이
// 정해야 하므로 다른 갈래로 간다.
export const CONTROL_KINDS = {
  "Text Input": { inputType: "text", valueType: "string" },
  "Number Input": { inputType: "number", valueType: "number" },
  "Text Area": { inputType: "text", multiline: true, valueType: "string" },
  // 켜고 끄는 칸은 값이 참이냐 거짓이냐다. select로 적으면 뜻이 어긋난다 —
  // 목록에서 하나 고르는 것이 아니다.
  Checkbox: { inputType: "checkbox", valueType: "boolean" },
  Switch: { inputType: "checkbox", valueType: "boolean" }
};

export const DISABLED_CONTROL_FILL = "#F9FAFB";
export const ACTIVE_CONTROL_FILL = "#FFFFFF";

export function isButton(node) {
  return BUTTON_NAME_PATTERN.test(node?.name ?? "");
}

// 라벨 없이 홀로 선 컨트롤인가.
//
// 폼은 라벨이 컨트롤을 이름 붙이지만, 목록 화면의 검색칸·거르개는 라벨 없이
// 그려진 문구만 있다(EVT-00A 20:4153). 라벨 노드를 요구하면 이런 칸이 통째로
// 보이지 않는다 — 그것이 EVT-00A 초안에 버튼 4개만 나온 원인이다.
export function isBareControl(node) {
  return CONTROL_NAMES.has(node?.name ?? "");
}

export const DRAFT_SIGNALS = {
  BUTTON_NAME_PATTERN,
  CONTROL_NAMES,
  SEARCHABLE_WRAPPER_NAME,
  DISABLED_CONTROL_FILL,
  ACTIVE_CONTROL_FILL
};
