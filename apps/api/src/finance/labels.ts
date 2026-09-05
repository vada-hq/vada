import { moment } from '../time.ts'

// 재정 화면 넷이 함께 쓰는 **완성된 글과 색**.
//
// 화면 넷이 같은 요청을 단계별로 본다(FIN-REV-01 · FIN-PROC-01 · FIN-EVID-01 ·
// MY-REQ-01). 그 넷이 같은 사실을 저마다의 말로 옮기면 같은 요청이 화면마다 다른
// 상태로 보인다 — 그래서 옮기는 규칙을 여기 한 곳에 둔다. 표에 담긴 것은
// `purchase`이고 '구매 진행 중'은 여기서 붙는다.

export type PurchaseStage = 'draft' | 'review' | 'purchase' | 'proof' | 'settled'

export interface Tone {
  label: string
  tone: string
}

/**
 * 요청이 지금 무엇을 기다리는지.
 *
 * **말은 명세가 자리마다 예로 들어 둔 것이다** — 검토는 '검토 대기'(MY-REQ-01),
 * 구매는 '구매 진행 중'(FIN-PROC-01), 증빙은 '증빙 정리 중'(FIN-EVID-01),
 * 보완은 '보완 요청'(FIN-REV-01)이다.
 */
const STAGE: Record<PurchaseStage, Tone> = {
  draft: { label: '작성 중', tone: 'gray' },
  review: { label: '검토 대기', tone: 'blue' },
  purchase: { label: '구매 진행 중', tone: 'blue' },
  proof: { label: '증빙 정리 중', tone: 'blue' },
  settled: { label: '처리 완료', tone: 'green' },
}

/**
 * **보완은 단계가 아니다.** 보완이 걸린 요청도 검토 중이고, 걸렸다는 사실은
 * `supplementRequestedAt`이 말한다(`db/schema.ts`가 그렇게 못 박았다).
 */
const SUPPLEMENT: Tone = { label: '보완 요청', tone: 'yellow' }

export function statusOf(stage: PurchaseStage, supplementRequestedAt: Date | null): Tone {
  return stage === 'review' && supplementRequestedAt !== null ? SUPPLEMENT : STAGE[stage]
}

/**
 * MY-REQ-01의 상태별 개수가 이 요청을 어느 칸에 넣는가.
 *
 * **다섯 칸이 서로 겹치지 않는다** — 명세가 '요청 하나는 단계 하나와 상태 하나를
 * 함께 갖는다'고 적었다. 그래서 낸 요청 하나는 반드시 한 칸에만 든다.
 *
 * 어느 단계가 어느 칸인지는 **칸마다 붙은 설명이 그대로 참이 되게** 골랐다:
 * 검토를 기다리는 것은 `review`, 보완이 필요한 것은 보완이 걸린 것, 구매가 진행
 * 중인 것은 `purchase`(FIN-PROC-01이 그 단계를 '구매 진행 중'이라 부른다),
 * 처리가 끝난 것은 `settled`. 남는 `proof`는 **승인이 끝난** 요청이다 — 검토를
 * 통과했기에 결제와 증빙을 정리하고 있다.
 *
 * 아직 안 낸 요청(`draft`)은 어느 칸에도 들지 않는다. 머리글이 '내가 **제출한**
 * 구매 요청'이라 적었다.
 */
export type CountKey =
  | 'reviewCount'
  | 'supplementCount'
  | 'approvedCount'
  | 'purchasingCount'
  | 'doneCount'

export const COUNT_KEYS: readonly CountKey[] = [
  'reviewCount',
  'supplementCount',
  'approvedCount',
  'purchasingCount',
  'doneCount',
]

export function countKeyOf(
  stage: PurchaseStage,
  supplementRequestedAt: Date | null,
): CountKey | null {
  switch (stage) {
    case 'draft':
      return null
    case 'review':
      return supplementRequestedAt === null ? 'reviewCount' : 'supplementCount'
    case 'purchase':
      return 'purchasingCount'
    case 'proof':
      return 'approvedCount'
    case 'settled':
      return 'doneCount'
  }
}

/**
 * 돈을 사람이 읽는 글로. **자릿점과 단위는 값이 아니라 글이다** — 표에는 수만 있고
 * 화폐 표기는 조직·지역의 것이라 읽을 때 붙인다.
 */
export function won(amount: number): string {
  return `${amount.toLocaleString('ko-KR')}원`
}

/** `2026-03-15` — 재정 화면들이 날짜를 그리는 꼴. */
export function dayOf(when: Date | null): string | null {
  return when === null ? null : moment(when).slice(0, 10)
}

/** 정해지지 않은 것은 **그 사실을 말로** 준다. 빈 글을 주면 화면이 그 자리에 무엇이든 그린다. */
export function orNote(value: string | null | undefined, note: string): string {
  return value === null || value === undefined || value.trim() === '' ? note : value
}

/** 비어 있는 조각은 빼고 잇는다. 가운뎃점만 남은 글을 주지 않는다. */
export function joinParts(parts: Array<string | null>): string {
  return parts.filter((part): part is string => part !== null && part.trim() !== '').join(' · ')
}

/**
 * 수량. **세는 말까지 붙어서 온다** — 무엇을 무엇으로 세는지는 조직의 표기다.
 * 세는 말이 없으면 수만 준다(지어내면 '개'가 조직의 말이 된다).
 */
export function quantityNote(quantity: number | null, unit: string | null): string {
  if (quantity === null) return '수량 미정'
  return unit === null || unit.trim() === '' ? String(quantity) : `${quantity}${unit}`
}

/** 요청액. 수량과 단가 중 하나라도 없으면 셀 수 없다. */
export function requestedAmount(quantity: number | null, unitPrice: number | null): number | null {
  return quantity === null || unitPrice === null ? null : quantity * unitPrice
}

/** 자리를 비운 채로 온다는 표시. 명세가 '—'로 못 박았다(FIN-PROC-01). */
export const BLANK = '—'
