import type { DataRow } from '../data-sources/catalog'
import type { QueryParams } from './types'

// 조회 인자를 실제 값으로 바꾼다.
//
// 예전에는 화면마다 이 세 줄을 손으로 적었다(TASK-01의 열, MY-01의 탭). 세 번째
// 출처(screenParam)가 생기면서 갈릴 자리가 늘었으므로 한 곳으로 모은다.
//
// - value: 명세가 정한 고정값(칸반 열의 status)
// - fieldKey: 화면 안의 필드 값(검색어·탭)
// - screenParam: 화면이 밖에서 받은 인자(어느 업무의 상세인지)
// - itemField: 눌린 항목의 조각(칸반 카드가 넘기는 업무 번호)
//
// 앞의 셋은 조회할 때도 이동할 때도 쓰지만 itemField는 이동할 때만이다 —
// 조회하는 시점에는 아직 항목이 없다. 검증기가 그 자리를 막는다.
//
// 가리키는 곳에 값이 없으면 빈 문자열이다 — 조용히 다른 것을 집어 오지 않는다.
export function resolveParams(
  params: QueryParams | undefined,
  sources: {
    // 값이 아직 없는 필드는 null로 남는다(스코프 초안). 가리키는 곳에 값이 없으면
    // 빈 문자열이라는 규칙이 그대로 적용된다.
    fields?: Record<string, string | null>
    screenParams?: Record<string, string>
    row?: DataRow
    /**
     * **방금 보낸 것의 답.** 앞의 셋은 전부 보내기 전에 있는 값이라, 만든 것의
     * id처럼 응답에만 있는 값을 가리킬 자리가 없었다.
     */
    result?: DataRow
  },
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(params ?? {}).map(([name, argument]) => {
      if (argument.value !== undefined) {
        return [name, argument.value]
      }
      if (argument.screenParam !== undefined) {
        return [name, sources.screenParams?.[argument.screenParam] ?? '']
      }
      if (argument.fieldKey !== undefined) {
        return [name, sources.fields?.[argument.fieldKey] ?? '']
      }
      if (argument.itemField !== undefined) {
        const value = sources.row?.[argument.itemField]
        return [name, value === undefined ? '' : String(value)]
      }
      // 방금 보낸 것의 답. 만든 것의 상세로 가려면 그 id가 필요한데 그 값은
      // 응답에만 있다.
      if (argument.resultField !== undefined) {
        const value = sources.result?.[argument.resultField]
        return [name, value === undefined ? '' : String(value)]
      }
      // 이 요소가 읽는 출처의 조각. itemField와 갈리는 것은 '어느 줄이냐'가
      // 있느냐다 - 저것은 눌린 항목이고 이것은 이미 집어 온 한 건이다.
      if (argument.sourceField !== undefined) {
        const value = sources.row?.[argument.sourceField]
        return [name, value === undefined ? '' : String(value)]
      }
      return [name, '']
    }),
  )
}
