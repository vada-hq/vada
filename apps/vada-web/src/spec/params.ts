import type { QueryParams } from './types'

// 조회 인자를 실제 값으로 바꾼다.
//
// 예전에는 화면마다 이 세 줄을 손으로 적었다(TASK-01의 열, MY-01의 탭). 세 번째
// 출처(screenParam)가 생기면서 갈릴 자리가 늘었으므로 한 곳으로 모은다.
//
// - value: 명세가 정한 고정값(칸반 열의 status)
// - fieldKey: 화면 안의 필드 값(검색어·탭)
// - screenParam: 화면이 밖에서 받은 인자(어느 업무의 상세인지)
//
// 가리키는 곳에 값이 없으면 빈 문자열이다 — 조용히 다른 것을 집어 오지 않는다.
export function resolveParams(
  params: QueryParams | undefined,
  sources: { fields?: Record<string, string>; screenParams?: Record<string, string> },
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
      return [name, '']
    }),
  )
}
