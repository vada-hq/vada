// 행사 정산 읽기(기능 008). 돈은 모두 정수 원이다.
import type { BudgetItemUsage } from './budget.js'
import type { EventSummary } from './events.js'

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

// 행사 '예산·정산'의 항목 줄. 쓴 돈과 남은 돈은 예산 탭과 같은 셈이다.
export interface SettlementBudgetItem extends BudgetItemUsage {
  id: string
  type: 'expense' | 'income'
  purpose: string
  amount: number
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

// 행사 하나의 정산 남은 것 수(행사 '돈' 탭의 항목 수 합)와 정산이 끝났는가. 홈 '정산할 행사'와 재정 '행사 정산' 탭이 같이 쓴다.
export interface EventSettlementRow {
  event: EventSummary
  settlement: { remaining: number; settled: boolean }
}

// 재정 '행사 정산' 탭(DEC-38)은 이만큼까지 주고 넘치면 truncated다.
export const EVENT_SETTLEMENTS_LIMIT = 50

// 지금 회계 기간의 행사: 끝났고 완료하지 않은 것(홈 '정산할 행사'와 같은 행사, 같은 차례) → 진행 중·예정·날짜 미정 → 완료(최근에 끝난 순).
// 기간이 없으면(period null) 기간으로 거르지 않는다.
export interface EventSettlementsResponse {
  period: { id: string; name: string } | null
  events: EventSettlementRow[]
  truncated: boolean
}
