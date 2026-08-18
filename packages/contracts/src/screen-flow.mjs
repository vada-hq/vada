// 화면 간 이동을 화면 명세에서 **유도한다**.
//
// 이동 지도를 별도 파일로 선언하지 않는 것이 핵심이다. 그래프는 이미 각
// 버튼의 action에 100% 들어 있고, 따로 적으면 두 번째 원본이 생겨 둘이
// 어긋나도 아무도 모른다(2026-08-19에 schemaByType 이중화로 실제로 당했다).
//
// 그래서 이 모듈은 검사기가 아니라 **보고기**다. 진입점 없음·막다른 화면은
// 결함일 수도 아닐 수도 있어서(뒤로 가기가 있으면 순환이 정상이다) 판정하지
// 않고 관측만 내놓는다. 오류로 막을 근거가 생기면 그때 검증기로 옮긴다.

function isObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function collectTargets(action) {
  if (!isObject(action)) {
    return [];
  }

  // navigate는 targetScreenId, submit은 onSuccess.navigate로 이동한다.
  return [action.targetScreenId, action.onSuccess?.navigate].filter(
    (target) => typeof target === "string" && target
  );
}

export function collectScreenFlow(screens = []) {
  const screenIds = [];
  const edges = [];

  for (const screen of screens) {
    const spec = screen?.spec;
    if (!isObject(spec) || typeof spec.screenId !== "string") {
      continue;
    }

    screenIds.push(spec.screenId);

    for (const element of Array.isArray(spec.elements) ? spec.elements : []) {
      const elementSpec = element?.spec;
      if (!isObject(elementSpec)) {
        continue;
      }

      for (const to of collectTargets(elementSpec.action)) {
        edges.push({
          from: spec.screenId,
          to,
          label: typeof elementSpec.label === "string" ? elementSpec.label : "",
          actionType: elementSpec.action.type
        });
      }
    }
  }

  const known = new Set(screenIds);
  const incoming = new Set(edges.map((edge) => edge.to));
  const outgoing = new Set(edges.map((edge) => edge.from));

  const missingTargets = [
    ...new Set(edges.map((edge) => edge.to).filter((to) => !known.has(to)))
  ];
  const entryCandidates = screenIds.filter((screenId) => !incoming.has(screenId));
  const deadEnds = screenIds.filter((screenId) => !outgoing.has(screenId));

  return {
    screenIds,
    edges,
    missingTargets,
    entryCandidates,
    deadEnds,
    components: collectComponents(screenIds, edges)
  };
}

// 이동 방향을 무시하고 이어진 덩어리를 센다. 덩어리가 둘 이상이면 어느
// 한쪽은 앱을 켜서 도달할 방법이 없다는 뜻이다.
function collectComponents(screenIds, edges) {
  const neighbors = new Map(screenIds.map((screenId) => [screenId, new Set()]));

  for (const edge of edges) {
    if (!neighbors.has(edge.from) || !neighbors.has(edge.to)) {
      continue; // 명세 없는 대상은 missingTargets가 따로 보고한다
    }
    neighbors.get(edge.from).add(edge.to);
    neighbors.get(edge.to).add(edge.from);
  }

  const seen = new Set();
  const components = [];

  for (const screenId of screenIds) {
    if (seen.has(screenId)) {
      continue;
    }

    const group = [];
    const queue = [screenId];
    seen.add(screenId);

    while (queue.length > 0) {
      const current = queue.shift();
      group.push(current);
      for (const next of neighbors.get(current)) {
        if (!seen.has(next)) {
          seen.add(next);
          queue.push(next);
        }
      }
    }

    components.push(group.sort());
  }

  return components;
}
