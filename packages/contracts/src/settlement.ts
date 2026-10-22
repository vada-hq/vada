// 행사 정산 읽기(기능 008). 돈은 모두 정수 원이다.

// 남은 것 목록은 종류마다 이만큼만 준다. 수(count)는 전체다.
export const SETTLEMENT_TARGET_LIMIT = 50

export const SETTLEMENT_REMAINING_KINDS = [
  'pending_items',
  'unpaid_items',
  'no_evidence',
  'no_reason',
  'unreimbursed',
  'refund_pending',
] as const
export type SettlementRemainingKind = (typeof SETTLEMENT_REMAINING_KINDS)[number]

export type SettlementTarget =
  | { type: 'request'; id: string; title: string }
  | { type: 'expense'; id: string; vendor: string; amount: number }

// count는 품목·지출·신청의 수다. 환불 대기는 신청자 정보가 없어 수만 있다(targets는 빈 배열).
export interface SettlementRemaining {
  kind: SettlementRemainingKind
  count: number
  targets: SettlementTarget[]
}

export interface SettlementBudgetItem {
  id: string
  type: 'expense' | 'income'
  purpose: string
  amount: number
  // 지출 항목은 쓴 돈, 수입 항목은 들어온 돈
  used: number
}

export interface SettlementApproval {
  outcome: 'completed' | 'completion_cancelled'
  by: { id: string; name: string } | null
  // ISO
  at: string
  reason: string | null
}

export interface EventSettlement {
  budget: { expense: number; income: number; items: SettlementBudgetItem[] }
  actual: {
    // 취소하지 않은 이 행사의 지출 합
    expense: number
    // 취소하지 않은 입금 − 환불
    fee: number
    // 이 행사의 수입 예산 항목을 고른, 취소하지 않은 수입 합(참가비 수입은 항목이 없어 들지 않는다)
    income: number
    depositCount: number
    refundPendingCount: number
  }
  // 지출 예산 − 실제 지출
  difference: number
  remaining: SettlementRemaining[]
  settled: boolean
  completed: boolean
  // 오래된 것부터 모두
  approvals: SettlementApproval[]
}

export interface SettlementResponse {
  settlement: EventSettlement
}
