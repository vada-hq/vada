// 화면 폴더의 신원은 Figma 노드 id다.
//
// screenId를 잘못 지정한 채 저장하면 원본·자산·reference.png가 한꺼번에 다른 화면
// 것으로 바뀐다. reference.png는 시각 검증의 유일한 기준이라 어떤 검사도 이를
// 잡지 못한다(2026-08-18 결정, HANDOFF의 '화면 폴더 신원 계약').
//
// 브리지(원본을 HTTP로 받는 길)와 REST 내려받기(파일에 직접 쓰는 길) 둘 다 이
// 계약을 지켜야 한다. 두 곳에 적으면 언젠가 갈리므로 판정만 여기 둔다 — 어떤
// 오류로 알릴지는 부르는 쪽이 정한다.

/**
 * 이 폴더가 이미 다른 노드의 산출물인가.
 *
 * @param {string|null} knownNodeId 폴더가 이미 갖고 있는 노드 id(없으면 null)
 * @param {string} incomingNodeId 지금 저장하려는 노드 id
 * @returns {boolean} 덮어쓰면 안 되면 true
 */
export function conflictsWithScreenFolder(knownNodeId, incomingNodeId) {
  if (typeof incomingNodeId !== "string" || !incomingNodeId) {
    return false;
  }
  return typeof knownNodeId === "string" && knownNodeId !== incomingNodeId;
}

/**
 * 폴더가 이미 갖고 있는 노드 id. 원본이 먼저이고, 없으면 명세를 본다.
 * 원본은 번들에서 가장 먼저 저장되므로 여기서 막으면 나머지도 함께 보호된다.
 */
export function knownNodeIdOf({ raw, screen }) {
  const fromRaw = raw?.document?.id;
  if (typeof fromRaw === "string" && fromRaw) {
    return fromRaw;
  }
  const fromScreen = screen?.source?.nodeId;
  return typeof fromScreen === "string" && fromScreen ? fromScreen : null;
}

export function screenFolderConflictMessage({ screenId, knownNodeId, incomingNodeId }) {
  return `'${screenId}' 폴더는 Figma 노드 ${knownNodeId}의 산출물입니다. 지금 저장하려는 화면은 ${incomingNodeId}이라 덮어쓰지 않았습니다. 작업 화면의 screenId를 확인하세요.`;
}
