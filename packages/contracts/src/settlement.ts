import { z } from 'zod'
import type { ExpensePerson, ExpenseSummary } from './expenses.js'
import { text, token } from './input.js'
import { PURCHASE_INTEGER_MAX } from './purchases.js'

export const SETTLEMENT_REASON_MAX = 200
export const EVENT_FINANCE_HISTORY_MAX = 100
export type EventFinanceAction = 'budget_set' | 'settled' | 'reopened'

// 행사 재정 행이 없으면 버전 0이다. 첫 변경이 버전 1로 행을 만든다.
const version = z.number().int().min(0).max(PURCHASE_INTEGER_MAX)
// null이면 예산 미정이다.
export const SetEventBudgetSchema = z.strictObject({ version, budget: z.number().int().min(0).max(PURCHASE_INTEGER_MAX).nullable() })
// 정산. 받은 참가비가 있으면 행사가 든 기간의 이 수입 줄로 넣는다. 고르지 않으면 null이고, 받은 참가비가 없으면 보지 않는다.
export const SettleEventSchema = z.strictObject({ version, feeIncomeLineId: token(64).nullable() })
export const ReopenSettlementSchema = z.strictObject({ version, reason: text(SETTLEMENT_REASON_MAX) })
export type SetEventBudgetRequest = z.infer<typeof SetEventBudgetSchema>
export type SettleEventRequest = z.infer<typeof SettleEventSchema>
export type ReopenSettlementRequest = z.infer<typeof ReopenSettlementSchema>

export interface EventFinanceHistoryEntry {
  id: string
  action: EventFinanceAction
  actor: ExpensePerson
  // budget_set: { from, to }, settled: { budget, spent, expenseCount, fee: { amount, count, period, line } | null }
  // fee는 정산이 넣은 참가비 수입이다(period·line은 이름). M3b-2 전에 정산한 기록에는 없다.
  changes: Record<string, unknown>
  // 다시 열 때만 있다.
  reason: string | null
  createdAt: string
}
// 받은 참가비: 입금을 확인한 신청의 확인 금액 합(취소했거나 정보를 지운 신청도 센다), count: 그 수,
// unpaid: 정보를 지우지 않은 신청 가운데 낼 돈이 있고 확인 전인 것의 수(참가자 탭의 "입금 전")
export interface EventFees { received: number; count: number; unpaid: number }
// 정산이 넣은 참가비 수입(취소하지 않은 것)
export interface EventFeeIncome { id: string; amount: number; period: { id: string; name: string }; line: { id: string; name: string } | null }
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
  // 행사가 든 회계 기간이 마감됐으면 true다. 정산을 다시 열 수 없다.
  periodClosed: boolean
  // 참가 신청이 없거나, 참가비를 받지 않고(참가비 0원, 납부자 참가비 없음) 입금 확인도 없으면 null이다.
  fees: EventFees | null
  // 행사가 든 회계 기간과 그 기간의 수입 줄(편성 순서). 기간에 넣지 않았으면 null이다. 정산이 참가비 수입을 넣는 곳이다.
  period: { id: string; name: string; incomes: { id: string; name: string }[] } | null
  feeIncome: EventFeeIncome | null
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
