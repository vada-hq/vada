import type { EventSettlementRow, EventSummary } from '@vada/contracts'
import { rowLinkTarget } from '@/components/ui/row-link'
import { whenLabel } from '../events/event-view'

export type SettlementMark = { kind: 'settled' } | { kind: 'remaining'; count: number } | null

// 행사 정산 탭 줄의 남은 것. 끝났고 정산을 다 한 줄은 홈 '정산할 행사'와 같은 '완료 가능'이다.
// 남은 것이 0이면 수를 빼서 일이 남은 줄만 눈에 띄게 한다(완료한 줄은 상태 배지가 말한다).
export function settlementMark({ event, settlement }: EventSettlementRow): SettlementMark {
  if (event.status === 'ended' && settlement.settled) return { kind: 'settled' }
  return settlement.remaining > 0 ? { kind: 'remaining', count: settlement.remaining } : null
}

// 날짜 미정은 상태 배지('기획 중')가 말하지 않으므로 날짜 칸이 '일시 미정'을 말한다(DEC-93).
export const settlementDate = (event: EventSummary) => whenLabel(event)

// 이름 버튼. 표는 줄(tr)이 누르기를 받고 이 버튼은 키보드·화면 낭독기로 여는 길이다.
export const nameLinkClass =
  'h-auto max-w-full justify-start p-0 text-left text-sm font-semibold whitespace-normal text-gray-900 wrap-anywhere'
// 카드 줄 전체가 눌리는 이름 버튼(줄 상자는 rowLinkBox). 표에서는 쓰지 않는다: 표 줄의 position: relative는
// CSS 2.1이 정하지 않아 덮개가 줄 밖으로 커질 수 있다.
export const rowNameLinkClass = `${nameLinkClass} ${rowLinkTarget}`
