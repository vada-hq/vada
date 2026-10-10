import { z } from 'zod'
import type { ExpensePerson } from './expenses.js'
import type { IncomeSummary } from './incomes.js'
import { text, token } from './input.js'
import { PURCHASE_INTEGER_MAX, purchaseDate } from './purchases.js'

export const BUDGET_PERIOD_NAME_MAX = 30
export const BUDGET_LINE_NAME_MAX = 30
export const BUDGET_INCOME_LINES_MAX = 30
export const BUDGET_OPERATING_LINES_MAX = 50
export const BUDGET_EVENTS_MAX = 100
export const BUDGET_PERIODS_MAX = 100
export const BUDGET_CANDIDATES_MAX = 300
export const BUDGET_HISTORY_MAX = 100
export const BUDGET_REOPEN_REASON_MAX = 200
export type BudgetGroup = 'income' | 'event' | 'operating'
export type BudgetPeriodAction = 'created' | 'updated' | 'closed' | 'reopened'

const id = token(64)
const amount = z.number().int().min(0).max(PURCHASE_INTEGER_MAX)
// 회계 기간의 날짜. 지출 결제일과 같은 범위만 받는다.
const day = purchaseDate.refine(value => value >= '2000-01-01' && value <= '2999-12-31')
const period = { name: text(BUDGET_PERIOD_NAME_MAX), startsOn: day, endsOn: day }
const ordered = (value: { startsOn: string; endsOn: string }) => value.startsOn <= value.endsOn
const distinct = (values: string[]) => new Set(values).size === values.length
// 수입·운영 줄. id가 null이면 새 줄이다. 이름은 묶음 안에서 겹치지 않는다(text가 앞뒤 공백을 지운 값으로 비교한다).
const lines = (max: number) => z.array(z.strictObject({ id: id.nullable(), name: text(BUDGET_LINE_NAME_MAX), amount })).max(max)
  .refine(list => distinct(list.map(line => line.name)))
// 행사 줄. version은 그 행사 재정의 버전이고 행이 없으면 0이다. budget은 금액을 바꿀 때만 보내고 null이면 미정이다.
// budget을 보내지 않으면 서버는 그 행사의 예산·버전을 보지 않고 그대로 둔다(다른 곳에서 바뀐 줄 때문에 막히지 않게).
const eventLines = z.array(z.strictObject({ eventId: id, version: z.number().int().min(0).max(PURCHASE_INTEGER_MAX), budget: amount.nullable().optional() }))
  .max(BUDGET_EVENTS_MAX).refine(list => distinct(list.map(line => line.eventId)))

export const CreateBudgetPeriodSchema = z.strictObject(period).refine(ordered)
// 편성 전체를 보낸다. 배열 순서가 화면 순서이고, 보내지 않은 기존 줄은 지우며, 보내지 않은 행사는 기간에서 뺀다.
export const SaveBudgetPlanSchema = z.strictObject({
  version: z.number().int().min(1).max(PURCHASE_INTEGER_MAX),
  ...period,
  incomes: lines(BUDGET_INCOME_LINES_MAX),
  operating: lines(BUDGET_OPERATING_LINES_MAX),
  events: eventLines,
}).refine(ordered).refine(value => distinct([...value.incomes, ...value.operating].flatMap(line => line.id === null ? [] : [line.id])))
const version = z.number().int().min(1).max(PURCHASE_INTEGER_MAX)
// 기간 마감. 남은 돈이 있으면 다음 기간의 이 수입 줄로 넘긴다. 고르지 않으면 null이다.
export const ClosePeriodSchema = z.strictObject({ version, carryoverLineId: id.nullable() })
export const ReopenPeriodSchema = z.strictObject({ version, reason: text(BUDGET_REOPEN_REASON_MAX) })
export type CreateBudgetPeriodRequest = z.infer<typeof CreateBudgetPeriodSchema>
export type SaveBudgetPlanRequest = z.infer<typeof SaveBudgetPlanSchema>
export type ClosePeriodRequest = z.infer<typeof ClosePeriodSchema>
export type ReopenPeriodRequest = z.infer<typeof ReopenPeriodSchema>

// closed: 마감한 기간이면 true. 지출 대화상자와 기간 고르기가 쓴다.
export interface BudgetPeriodSummary { id: string; name: string; startsOn: string; endsOn: string; closed: boolean; operating: { id: string; name: string }[] }
// 시작일이 늦은 순. 지출 대화상자가 결제일이 든 기간의 운영 줄을 고를 때도 쓴다.
export interface BudgetPeriodsResponse { periods: BudgetPeriodSummary[] }
// received: 이 줄을 고른 수입 가운데 취소하지 않은 것의 합, incomeCount: 그 수. 0이 아니면 지울 수 없다.
export interface BudgetIncomeLine { id: string; name: string; amount: number; received: number; incomeCount: number }
// 숫자는 행사 재정 탭과 같은 정의다. version은 편성 저장에 다시 보낸다.
export interface BudgetEventLine {
  eventId: string
  name: string
  budget: number | null
  spent: number
  planned: number
  plannedUnknown: number
  remaining: number | null
  settled: boolean
  version: number
  // 취소하지 않은 참가비 수입이 있으면 true다. 기간에서 뺄 수 없다.
  feeIncome: boolean
}
// expenseCount: 이 항목을 고른 지출 가운데 취소하지 않은 것의 수. 0이 아니면 지울 수 없다.
export interface BudgetOperatingLine { id: string; name: string; amount: number; spent: number; remaining: number; expenseCount: number }
// 어느 기간에도 넣지 않은 행사.
export interface BudgetCandidate { eventId: string; name: string; budget: number | null; version: number; settled: boolean; spent: number }
// 편성 수정 한 번의 변경 한 줄. added는 to만, removed는 from만 있다. 행사 줄의 null은 미정이다.
export interface BudgetChange {
  group: BudgetGroup
  action: 'added' | 'removed' | 'changed'
  name: string
  previousName?: string
  from?: number | null
  to?: number | null
}
export interface BudgetHistoryEntry {
  id: string
  action: BudgetPeriodAction
  actor: ExpensePerson
  // created: { name, startsOn, endsOn }, updated: { name?, startsOn?, endsOn?: { from, to }, lines?: BudgetChange[] }
  // closed: { received, spent, balance, carryover: { period, amount, line } | null }(period·line은 이름)
  changes: Record<string, unknown>
  // 다시 열 때만 있다.
  reason: string | null
  createdAt: string
}
// 마감 조건과 마감 뒤 상태. 정산하지 않은 행사와 남은 돈은 events[].settled·totals.balance를 쓴다.
export interface BudgetClosing {
  // 한국 날짜로 끝일이 지났는가
  ended: boolean
  // 마감하지 않은 앞 기간 가운데 가장 이른 것
  earlierOpen: { id: string; name: string } | null
  // 결제일이 이 기간 안인 상시 운영 지출(취소하지 않은 것) 가운데 증빙이 없는 것의 수
  missingEvidence: number
  // 시작일이 이 기간 끝일보다 뒤인 가장 이른 기간. 이월금이 들어갈 곳이고, incomes는 그 기간의 수입 줄(편성 순서)이다.
  next: { id: string; name: string; startsOn: string; closed: boolean; incomes: { id: string; name: string }[] } | null
  // 이 기간이 넘긴 취소하지 않은 이월금
  carriedOver: { period: { id: string; name: string }; amount: number } | null
}
export interface BudgetTotals {
  // 수입 줄의 합
  income: number
  // 이 기간의 취소하지 않은 수입 합(실제 수입)
  received: number
  // 행사 예산(미정은 0)과 운영 줄의 합. undecided는 예산이 미정인 행사 수다.
  budget: number
  undecided: number
  // 행사 줄 + 운영 줄 + 운영 항목을 고르지 않은 상시 운영 지출
  spent: number
  planned: number
  plannedUnknown: number
  // 예산 − 실제 지출 − 지출 예정
  remaining: number
  // 남은 돈: 실제 수입 − 실제 지출. 지출 예정은 빼지 않는다.
  balance: number
}
export interface BudgetPlanResponse {
  // closed: 마감한 사람과 때. 열린 기간이면 null이다.
  period: { id: string; name: string; startsOn: string; endsOn: string; version: number; closed: { by: ExpensePerson; at: string } | null }
  closing: BudgetClosing
  incomes: BudgetIncomeLine[]
  events: BudgetEventLine[]
  operating: BudgetOperatingLine[]
  // 결제일이 기간 안인 상시 운영 지출 가운데 운영 항목이 없는 것
  unassigned: { spent: number; count: number }
  // 이 기간의 취소하지 않은 수입 가운데 수입 항목이 없는 것
  unassignedIncome: { received: number; count: number }
  totals: BudgetTotals
  // 최근에 만든 순으로 300개까지
  candidates: BudgetCandidate[]
  // 학생회 전체: 지출이나 받은 참가비가 있는데 기간에 넣지 않은 행사 수, 결제일이 어느 기간에도 들지 않는 상시 운영 지출 수
  notices: { eventsWithMoney: number; operatingOutside: number }
  // 최근 100개, 오래된 순
  history: BudgetHistoryEntry[]
  // 이 기간의 수입. 취소한 것도 준다. 받은 날 최근 순으로 300건까지이고, 넘으면 incomeRecordsTruncated가 true다.
  incomeRecords: IncomeSummary[]
  incomeRecordsTruncated: boolean
}
