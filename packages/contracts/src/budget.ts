import { z } from 'zod'
import { text } from './input.js'
import { koreanDate } from './korean-time.js'
import type { PurchasePerson } from './purchases.js'
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

// 예산 항목의 이름과 금액. 금액은 1원 이상이다(DEC-92: 0원 항목은 막는다). 더하기와 고치기가 같이 쓴다.
export const budgetItemPurpose = text(BUDGET_PURPOSE_MAX)
export const budgetItemAmount = z.number().int().min(1).max(WON_MAX)

// 예산 항목의 담당 부서(선택). 돈은 재정부가 쥐고, 맡은 부서는 부장 홈에서 그 항목의 한도를 본다(대표 10/30).
// 같은 학생회의 부서여야 한다(아니면 409 DEPARTMENT_INVALID). 비우면(null) 맡은 부서가 없다.
export const budgetItemDepartmentId = recordIdInput.nullable()

// 더할 때 종류와 행사(선택)를 고르고, 더한 뒤에는 바꾸지 않는다(DEC-68). 담당 부서는 더할 때 고르고 고치기에서 바꾼다.
export const CreateBudgetItemSchema = z.strictObject({
  purpose: budgetItemPurpose,
  amount: budgetItemAmount,
  type: z.enum(BUDGET_ITEM_TYPES).default('expense'),
  eventId: recordIdInput.nullable().default(null),
  departmentId: budgetItemDepartmentId.default(null),
})
export type CreateBudgetItem = z.infer<typeof CreateBudgetItemSchema>

// 예산 읽기의 기간(선택). 없으면 오늘이 든 기간이다. 끝난 기간에 늦게 적는 수입이 그 기간의 수입 항목을 고른다(DEC-70).
export const BudgetQuerySchema = z.strictObject({ period: recordIdInput.optional() })

// 요청이나 지출의 행사와 예산 항목의 행사가 둘 다 있으면 같아야 한다(DEC-81, RULE-40). 한쪽이 없으면 맞다.
// 승인, 직접 지출, 결재·지출 화면의 항목 고르기가 이 술어 하나를 쓴다. 표를 넘는 규칙이라 DB 제약은 없다.
export const eventsAgree = (recordEventId: string | null, itemEventId: string | null) =>
  recordEventId === null || itemEventId === null || recordEventId === itemEventId

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
// 예산 항목의 쓴 돈과 남은 돈(DEC-15, DEC-92). 저장하지 않고 서버의 예산 셈 한 곳이 센다. 종류(type)로 갈린다.
// 지출 항목: actual은 실제 지출, committed는 지출 예정(약정: 승인한 품목마다 승인 금액에서 결제한 금액을 뺀 남은 금액(0 이상)의 합),
// available은 사용 가능 = 배정 − 실제 지출 − 지출 예정(넘게 승인했거나 썼으면 음수). 수입 항목: actual은 들어온 돈이고 나머지 둘은 없다.
export type BudgetItemUsage =
  | { type: 'expense'; actual: number; committed: number; available: number }
  | { type: 'income'; actual: number; committed: null; available: null }

// 예산 항목의 판 하나: 그때의 이름과 금액, 바꾼 사람, 고칠 때 받은 사유(DEC-34). 앞 판과 견주어 무엇이 바뀌었는지는 화면이 센다.
export interface BudgetItemVersion {
  versionNo: number
  at: string
  by: PurchasePerson | null
  purpose: string
  amount: number
  reason: string | null
}

export type BudgetItemView = BudgetItemUsage & {
  id: string
  purpose: string
  amount: number
  event: EventRef | null
  // 담당 부서(없으면 null)
  department: { id: string; name: string } | null
  // 결재·지출·수입에서 고를 수 있는가. 완료한 행사의 항목이면 false다(RULE-11). 서버가 정책에서 정한다.
  selectable: boolean
  // 지울 수 있는가. 결재·지출·수입·요청이 가리킨 적 없고 만든 뒤 고친 적도 없을 때만이다(DEC-92, 이력을 지우지 않게).
  deletable: boolean
  history: BudgetItemVersion[]
}
// 기간이 없으면 period가 null이고 항목도 없다.
export interface BudgetResponse {
  period: FiscalPeriodView | null
  items: BudgetItemView[]
}
