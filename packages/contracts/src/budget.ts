import { z } from 'zod'
import { text } from './input.js'
import { koreanDate } from './korean-time.js'
import { recordIdInput } from './team.js'

// 회계 기간과 예산 항목(DEC-45). 값은 DB CHECK와 같다.
export const FISCAL_PERIOD_NAME_MAX = 20
export const BUDGET_PURPOSE_MAX = 100
// 돈 한 건의 상한(원). 줄 20개를 더해도 안전한 정수 안이다. 예산 항목, 승인 금액, 지출 금액이 같이 쓴다.
export const WON_MAX = 1_000_000_000

// 끝일은 시작일보다 뒤다(DB CHECK ends_on > starts_on).
export const CreateFiscalPeriodSchema = z
  .strictObject({
    name: text(FISCAL_PERIOD_NAME_MAX),
    startsOn: koreanDate,
    endsOn: koreanDate,
  })
  .refine(period => period.endsOn > period.startsOn)
export type CreateFiscalPeriod = z.infer<typeof CreateFiscalPeriodSchema>

// 예산 항목의 종류(DEC-45). 지출이 기본이고, 수입 항목은 결재와 지출에서 고를 수 없다.
export const BUDGET_ITEM_TYPES = ['expense', 'income'] as const
export type BudgetItemType = (typeof BUDGET_ITEM_TYPES)[number]

// 더할 때 종류와 행사(선택)를 고르고, 더한 뒤에는 바꾸지 않는다(DEC-68).
export const CreateBudgetItemSchema = z.strictObject({
  purpose: text(BUDGET_PURPOSE_MAX),
  amount: z.number().int().min(0).max(WON_MAX),
  type: z.enum(BUDGET_ITEM_TYPES).default('expense'),
  eventId: recordIdInput.nullable().default(null),
})
export type CreateBudgetItem = z.infer<typeof CreateBudgetItemSchema>

export interface FiscalPeriodView {
  id: string
  name: string
  startsOn: string
  endsOn: string
}
// 행사에 이은 기록이 보여 주는 행사 이름표
export interface EventRef {
  id: string
  name: string
}
export interface BudgetItemView {
  id: string
  purpose: string
  amount: number
  type: BudgetItemType
  event: EventRef | null
}
// 기간이 없으면 period가 null이고, 화면이 채워 둘 이름과 날짜(지금 기수)를 suggested로 준다.
export interface BudgetResponse {
  period: FiscalPeriodView | null
  items: BudgetItemView[]
  suggested: { name: string; startsOn: string; endsOn: string } | null
}
