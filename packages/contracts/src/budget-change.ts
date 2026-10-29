import { z } from 'zod'
import {
  budgetItemAmount,
  budgetItemDepartmentId,
  budgetItemPurpose,
  CreateBudgetItemSchema,
} from './budget.js'
import { text } from './input.js'
import { PURCHASE_REASON_MAX } from './purchases.js'

// 예산 편성(DEC-92, 024 조각 6): 여러 행을 한 거래로 더하고, 항목마다 사유와 함께 고친다.
// budget.ts와 나눈 까닭: 사유 상한을 구매 요청 계약에서 읽는데, 그 계약이 budget.ts를 읽어 한 파일에 두면 서로를 읽는다.

// 한 번에 넣는 행의 상한. 학기 예산이나 행사 예산 하나를 한 창에서 짜기에 넉넉하다.
export const BUDGET_ROWS_MAX = 20

// 행마다 더하기와 같은 칸이다. 한 행이라도 틀리면 아무것도 넣지 않는다.
export const CreateBudgetItemsSchema = z.strictObject({
  items: z.array(CreateBudgetItemSchema).min(1).max(BUDGET_ROWS_MAX),
})
export type CreateBudgetItems = z.infer<typeof CreateBudgetItemsSchema>

// 고치기는 이름, 금액, 담당 부서를 바꾸고 사유는 꼭 받는다(판에 남는다). 종류와 행사는 바꾸지 않는다(DEC-68).
// 담당 부서를 빼고 보내면 그대로 두고, null이면 비운다(담당 부서 전의 고치기 본문도 그대로 받는다).
export const UpdateBudgetItemSchema = z.strictObject({
  purpose: budgetItemPurpose,
  amount: budgetItemAmount,
  departmentId: budgetItemDepartmentId.optional(),
  reason: text(PURCHASE_REASON_MAX),
})
export type UpdateBudgetItem = z.infer<typeof UpdateBudgetItemSchema>
