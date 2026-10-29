import type { SettlementRemainingKind, SettlementTarget } from '@vada/contracts'
import { wonLabel } from '../finance/purchase-view'

// 남은 것 종류의 이름. 정산 기준(DEC-39, DEC-40, DEC-55)의 여섯이다.
export const REMAINING_LABEL: Record<SettlementRemainingKind, string> = {
  pending_items: '결재를 기다리는 품목',
  unpaid_items: '승인했지만 결제하지 않은 품목',
  no_evidence: '증빙이 없는 지출',
  no_reason: '사유가 없는 지출',
  unreimbursed: '환급 전 지출',
  refund_pending: '환불 대기 신청',
}

export function targetLabel(target: SettlementTarget) {
  return target.type === 'request' ? target.title : `${target.vendor} · ${wonLabel(target.amount)}`
}
