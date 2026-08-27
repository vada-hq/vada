import { allElementsOf } from "./element-walk.mjs";
// 등록된 명세의 값 하나하나가 어디서 왔는지 가른다.
//
// 플러그인이 명세를 읽기 전용으로 보여줄 때, 값만 나열하면 사람이 확인할 것이
// 요소 수 × 속성 수만큼이다(HOME-01K는 11 × 15 ≈ 165개). 대부분은 기계가
// 디자인에서 유도했거나 다른 화면의 선례를 물려받은 것이라 확인할 필요가 없다.
// 남는 것 — 추정으로 채운 값 — 만 보면 된다.
//
// 판별은 추측이 아니라 재현이다. 추출기를 두 번 돌려서:
//   선례 없이 뽑은 값과 같다 → design    (디자인이 말해 준다)
//   선례를 주면 같아진다     → precedent (다른 화면이 이미 답했다)
//   둘 다 아니다             → authored  (사람이나 AI가 정했다 — 확인 대상)
import { draftScreenElements } from "./screen-draft.mjs";

function stableJson(value) {
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

function draftByNodeId(design, options) {
  const { elements } = draftScreenElements(design, options);
  return new Map(elements.map((element) => [element.source?.nodeId, element.spec]));
}

/**
 * @param {{screen: object, design: object, precedents?: object}} input
 * @returns {{byNodeId: Map<string, Record<string, "design"|"precedent"|"authored">>,
 *            counts: {design: number, precedent: number, authored: number, total: number}}}
 */
export function classifySpecProvenance({ screen, design, precedents }) {
  const stateScopeKey = screen?.stateScopeKey;
  const fromDesign = draftByNodeId(design, {});
  const fromPrecedent = precedents
    ? draftByNodeId(design, { precedents, stateScopeKey })
    : fromDesign;

  const byNodeId = new Map();
  const counts = { design: 0, precedent: 0, authored: 0, total: 0 };

  // 안쪽 요소도 사람이 적은 것이다. 최상위만 훑던 동안 194개 중 26개(13.4%)가
  // 출처 추적 밖에 있었다 - 그런데 plugin-role.md는 '보이지 않는 값을 어떻게
  // 확인하나'의 답으로 이것을 가리킨다.
  for (const { element } of allElementsOf(screen)) {
    const nodeId = element?.source?.nodeId;
    const spec = element?.spec ?? {};
    const designSpec = fromDesign.get(nodeId) ?? {};
    const precedentSpec = fromPrecedent.get(nodeId) ?? {};
    const sources = {};

    for (const [key, value] of Object.entries(spec)) {
      const actual = stableJson(value);
      let source = "authored";
      if (key in designSpec && stableJson(designSpec[key]) === actual) {
        source = "design";
      } else if (key in precedentSpec && stableJson(precedentSpec[key]) === actual) {
        source = "precedent";
      }
      sources[key] = source;
      counts[source] += 1;
      counts.total += 1;
    }

    byNodeId.set(nodeId, sources);
  }

  return { byNodeId, counts };
}
