import type { EventSettlementRow, EventSummary } from '@vada/contracts'
import { whenLabel } from '../events/event-view'

export type SettlementMark = { kind: 'settled' } | { kind: 'remaining'; count: number } | null

// 행사 정산 탭 줄의 남은 것. 끝났고 정산을 다 한 줄은 홈 '정산할 행사'와 같은 '완료 가능'이다.
// 남은 것이 0이면 수를 빼서 일이 남은 줄만 눈에 띄게 한다(완료한 줄은 상태 배지가 말한다).
export function settlementMark({ event, settlement }: EventSettlementRow): SettlementMark {
  if (event.status === 'ended' && settlement.settled) return { kind: 'settled' }
  return settlement.remaining > 0 ? { kind: 'remaining', count: settlement.remaining } : null
}

// 날짜 미정이면 상태 배지가 '날짜 미정'을 말하므로 날짜를 비운다.
export const settlementDate = (event: EventSummary) =>
  event.startsAt === null ? null : whenLabel(event)

// 줄 전체가 눌리는 이름 버튼. 초점 테두리도 글자가 아니라 줄 전체(가상 요소)에 둔다.
export const rowLinkClass =
  'h-auto max-w-full justify-start p-0 text-left text-sm font-semibold whitespace-normal text-gray-900 wrap-anywhere after:absolute after:inset-0 focus-visible:ring-0 focus-visible:after:ring-2 focus-visible:after:ring-ring/50'
