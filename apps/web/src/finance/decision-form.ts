import { DecideLineItemsSchema, type BudgetItemView } from '@vada/contracts'
import { wonOf } from './budget-form'

// 결재 줄 하나의 입력값. budgetItemId가 null이면 아직 고르지 않은 것이라 마지막에 고른 항목을 보인다.
export type RowValues = {
  amount: string
  budgetItemId: string | null
  reason: string
  rejecting: boolean
}
export const emptyRow = (): RowValues => ({
  amount: '',
  budgetItemId: null,
  reason: '',
  rejecting: false,
})

// 마지막에 승인한 예산 항목은 학생회마다 이 화면을 쓰는 동안 기억한다(DEC-40: 결재자의 수고를 줄인다).
const lastApproved = new Map<string, string>()
export const rememberItem = (councilId: string, budgetItemId: string) =>
  void lastApproved.set(councilId, budgetItemId)
export const forgetRememberedItems = () => lastApproved.clear()

// 줄에 보일 항목. 고른(또는 기억한) 항목이 지금 목록에 없으면(기간이 바뀜) 비운다.
export function chosenItem(
  row: RowValues,
  councilId: string,
  items: readonly BudgetItemView[],
): string {
  const wanted = row.budgetItemId ?? lastApproved.get(councilId) ?? ''
  return items.some(item => item.id === wanted) ? wanted : ''
}

export const approvalOf = (lineItemId: string, amount: string, budgetItemId: string) => ({
  lineItemId,
  outcome: 'approved',
  amount: wonOf(amount),
  budgetItemId,
})
export const rejectionOf = (lineItemId: string, reason: string) => ({
  lineItemId,
  outcome: 'rejected',
  reason,
})

// 보낼 수 있는 결재인지는 계약이 판단한다(금액 1원 이상, 항목, 사유 길이와 공백).
export const decidable = (decisions: unknown[]) =>
  DecideLineItemsSchema.safeParse({ decisions }).success
