// 이 wireframe은 화면 이름에 screenId를 적는다.
//
//   운영 — 행사 · EVT-00A · 행사 목록 — 일반 구성원
//            ^^^^^^^^
//
// 플러그인은 어느 노드가 어느 화면인지를 pluginData에 따로 적어 두는데, 그것은
// 비공개라 REST가 읽지 못한다. 그런데 읽을 필요가 없다 — 이름이 이미 말하고 있다.
// 같은 것을 두 곳에 적으면 언젠가 갈린다.

// 가운뎃점으로 나뉜 칸 중 대문자로 시작하는 식별자 모양의 칸.
const SEGMENT = /·\s*([A-Z][A-Z0-9]*(?:-[A-Z0-9]+)*)\s*·/;

/** 화면 이름이 말하는 screenId. 없으면 null. */
export function screenIdFromFrameName(name) {
  const found = typeof name === "string" ? name.match(SEGMENT) : null;
  return found ? found[1] : null;
}

/** 이 이름이 이 screenId의 화면인가. 앞뒤가 낱말 경계여야 한다 — 'EVT-00'이 'EVT-00A'를 집지 않도록. */
export function frameNameIsScreen(name, screenId) {
  return screenIdFromFrameName(name) === screenId;
}
