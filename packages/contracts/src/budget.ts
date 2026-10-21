import { z } from 'zod'
import { text } from './input.js'
import { koreanDate } from './korean-time.js'

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

// 지출 예산 항목만 더한다. 수입 항목은 기능 007이다.
export const CreateBudgetItemSchema = z.strictObject({
  purpose: text(BUDGET_PURPOSE_MAX),
  amount: z.number().int().min(0).max(WON_MAX),
})
export type CreateBudgetItem = z.infer<typeof CreateBudgetItemSchema>

export interface FiscalPeriodView {
  id: string
  name: string
  startsOn: string
  endsOn: string
}
export interface BudgetItemView {
  id: string
  purpose: string
  amount: number
}
// 기간이 없으면 period가 null이고, 화면이 채워 둘 이름과 날짜(지금 기수)를 suggested로 준다.
export interface BudgetResponse {
  period: FiscalPeriodView | null
  items: BudgetItemView[]
  suggested: { name: string; startsOn: string; endsOn: string } | null
}
