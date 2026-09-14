// 이미 등록된 화면과 대조해 추출 정확도를 측정한다.
// 인덱스가 아니라 nodeId로 짝지어야 한 요소가 밀려도 나머지가 왜곡되지 않는다.
export function compareWithSpec(draftElements, specElements) {
  const identity = (element) =>
    element?.spec?.type === "group" ? element.spec.title : element?.spec?.label;
  const describe = (element) =>
    element ? `${element.source.nodeId} ${element.spec.type} ${identity(element) ?? ""}`.trim() : "—";

  const draftByNode = new Map(draftElements.map((element) => [element.source.nodeId, element]));
  // 그림에 없는데 사람이 두기로 정한 요소는 **추출기가 뽑을 수 없다** — 뽑아 올
  // 노드가 없다. 재현율의 분모에 넣으면 추출기가 못 한 일로 세어져, 사람이 그런
  // 요소를 하나 더할 때마다 눈금이 까닭 없이 내려간다.
  const rows = specElements.filter((actual) => actual?.source !== undefined).map((actual) => {
    const draft = draftByNode.get(actual.source.nodeId) ?? null;
    return {
      nodeId: actual.source.nodeId,
      matched: draft !== null,
      typeMatch: draft?.spec?.type === actual.spec.type,
      labelMatch: identity(draft) === identity(actual),
      draft: describe(draft),
      actual: describe(actual)
    };
  });

  const specNodeIds = new Set(
    specElements
      .map((element) => element?.source?.nodeId)
      .filter((nodeId) => typeof nodeId === "string")
  );
  for (const draft of draftElements) {
    if (!specNodeIds.has(draft.source.nodeId)) {
      rows.push({
        nodeId: draft.source.nodeId,
        matched: false,
        typeMatch: false,
        labelMatch: false,
        draft: describe(draft),
        actual: "— (등록되지 않은 요소를 뽑음)"
      });
    }
  }
  return rows;
}
