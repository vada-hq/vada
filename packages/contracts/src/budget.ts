import { z } from 'zod'
import type { ExpensePerson } from './expenses.js'
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
export type BudgetGroup = 'income' | 'event' | 'operating'
export type BudgetPeriodAction = 'created' | 'updated'

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
export type CreateBudgetPeriodRequest = z.infer<typeof CreateBudgetPeriodSchema>
export type SaveBudgetPlanRequest = z.infer<typeof SaveBudgetPlanSchema>

export interface BudgetPeriodSummary { id: string; name: string; startsOn: string; endsOn: string; operating: { id: string; name: string }[] }
// 시작일이 늦은 순. 지출 대화상자가 결제일이 든 기간의 운영 줄을 고를 때도 쓴다.
export interface BudgetPeriodsResponse { periods: BudgetPeriodSummary[] }
export interface BudgetIncomeLine { id: string; name: string; amount: number }
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
  changes: Record<string, unknown>
  createdAt: string
}
export interface BudgetTotals {
  // 수입 줄의 합
  income: number
  // 행사 예산(미정은 0)과 운영 줄의 합. undecided는 예산이 미정인 행사 수다.
  budget: number
  undecided: number
  // 행사 줄 + 운영 줄 + 운영 항목을 고르지 않은 상시 운영 지출
  spent: number
  planned: number
  plannedUnknown: number
  // 예산 − 실제 지출 − 지출 예정
  remaining: number
}
export interface BudgetPlanResponse {
  period: { id: string; name: string; startsOn: string; endsOn: string; version: number }
  incomes: BudgetIncomeLine[]
  events: BudgetEventLine[]
  operating: BudgetOperatingLine[]
  // 결제일이 기간 안인 상시 운영 지출 가운데 운영 항목이 없는 것
  unassigned: { spent: number; count: number }
  totals: BudgetTotals
  // 최근에 만든 순으로 300개까지
  candidates: BudgetCandidate[]
  // 학생회 전체: 지출이 있는데 기간에 넣지 않은 행사 수, 결제일이 어느 기간에도 들지 않는 상시 운영 지출 수
  notices: { eventsWithSpending: number; operatingOutside: number }
  // 최근 100개, 오래된 순
  history: BudgetHistoryEntry[]
}
