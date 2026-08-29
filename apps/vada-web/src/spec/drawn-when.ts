import { readObjectSourceOrNull } from '../data-sources/catalog'
import { resolveParams } from './params'
import type { DataRow } from '../data-sources/catalog'
import type { ScreenElement } from './types'

/**
 * 이 요소를 그리는가.
 *
 * `drawnWhen`이 없으면 늘 그린다. 있으면 **그 출처의 그 조각이 참일 때만** 그린다.
 *
 * **판정을 화면이 짓지 않는다.** EXT-01B의 '다시 입력'은 이름이 명단과 다를 때만
 * 뜻이 있는데, 그 규칙을 화면이 들면(`label === '참가자 명단 불일치'`) 규칙이 화면에
 * 박힌다. 서버가 이미 답을 아는 자리다 — 역할 이름·권한 규칙을 명세가 들지 않는
 * 것과 같은 까닭이다.
 *
 * **참이 아니면 그리지 않는다.** 조각이 없거나 조회가 비면 거짓으로 본다 — 서버가
 * 허락한 적이 없는 것을 허락으로 읽지 않는다.
 */
export function drawsElement(
  element: ScreenElement,
  sources: { screenParams?: Record<string, string>; fields?: Record<string, string | null>; row?: DataRow },
): boolean {
  const when = element.drawnWhen
  if (when === undefined) {
    return true
  }
  const row = readObjectSourceOrNull(when.dataSourceKey, resolveParams(when.params, sources))
  return row !== null && row[when.field] === true
}
