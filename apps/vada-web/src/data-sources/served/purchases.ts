import type { Served } from './area'

/**
 * 구매 요청의 흐름(FIN-REQ-01 · REQ-02 · SUP-01의 읽기와 쓰기). **아직 비어 있다** —
 * 자리를 미리 열어 둔 것이다.
 *
 * 재정의 겉면(`finance.ts`)과 가른다. 요청 한 건이 검토·구매·증빙·정산을 지나는 길이 여기다.
 */
export const purchases: Served = {
  reads: [],
  writes: [],
}
