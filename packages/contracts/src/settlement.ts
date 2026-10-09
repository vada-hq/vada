import { z } from 'zod'
import type { ExpensePerson, ExpenseSummary } from './expenses.js'
import { text } from './input.js'
import { PURCHASE_INTEGER_MAX } from './purchases.js'

export const SETTLEMENT_REASON_MAX = 200
export const EVENT_FINANCE_HISTORY_MAX = 100
export type EventFinanceAction = 'budget_set' | 'settled' | 'reopened'

// 행사 재정 행이 없으면 버전 0이다. 첫 변경이 버전 1로 행을 만든다.
const version = z.number().int().min(0).max(PURCHASE_INTEGER_MAX)
// null이면 예산 미정이다.
export const SetEventBudgetSchema = z.strictObject({ version, budget: z.number().int().min(0).max(PURCHASE_INTEGER_MAX).nullable() })
export const SettleEventSchema = z.strictObject({ version })
export const ReopenSettlementSchema = z.strictObject({ version, reason: text(SETTLEMENT_REASON_MAX) })
export type SetEventBudgetRequest = z.infer<typeof SetEventBudgetSchema>
export type SettleEventRequest = z.infer<typeof SettleEventSchema>
export type ReopenSettlementRequest = z.infer<typeof ReopenSettlementSchema>

export interface EventFinanceHistoryEntry {
  id: string
  action: EventFinanceAction
  actor: ExpensePerson
  // budget_set: { from, to }, settled: { budget, spent, expenseCount }
  changes: Record<string, unknown>
  // 다시 열 때만 있다.
  reason: string | null
  createdAt: string
}
export interface EventFinance {
  eventId: string
  // null이면 미정이다.
  budget: number | null
  // 취소하지 않은 지출 합.
  spent: number
  // 지출에 연결되지 않은 승인 품목의 수량 × 예상 단가 합. 금액을 모르는 품목은 빼고 plannedUnknown에 센다.
  planned: number
  plannedUnknown: number
  // 예산 − 실제 지출 − 지출 예정. 예산이 미정이면 null이다.
  remaining: number | null
  // 취소하지 않은 지출 수.
  expenseCount: number
  // 정산 조건 셋. 모두 0이어야 정산할 수 있다.
  missingEvidence: number
  pendingRequests: number
  unrecordedItems: number
  settled: { by: ExpensePerson; at: string } | null
  version: number
  // 최근 100개, 오래된 순.
  history: EventFinanceHistoryEntry[]
}
export interface EventFinanceResponse {
  finance: EventFinance
  // 이 행사의 지출. 결제일 최근 순으로 300개까지, 취소한 것도 "취소됨"으로 준다.
  expenses: ExpenseSummary[]
  truncated: boolean
}
