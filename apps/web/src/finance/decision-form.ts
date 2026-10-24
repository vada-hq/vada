import { DecideLineItemsSchema, type BudgetItemView } from '@vada/contracts'
import { withContract, type FieldErrors } from '@/lib/use-form-check'
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

export type DecisionAction = 'approve' | 'reject'
export type DecisionEntry = { id: string; action: DecisionAction; row: RowValues; chosen: string }

// 칸 이름은 '줄 id.칸'이다(amount, budgetItemId, reason).
function emptyFields({ id, action, row, chosen }: DecisionEntry): FieldErrors {
  if (action === 'reject')
    return { [`${id}.reason`]: row.reason.trim() === '' ? '반려 사유를 입력해 주세요' : undefined }
  return {
    [`${id}.amount`]: row.amount.trim() === '' ? '금액을 입력해 주세요' : undefined,
    [`${id}.budgetItemId`]: chosen === '' ? '예산 항목을 골라 주세요' : undefined,
  }
}

// 줄 하나를 계약에 대 본 문제(금액 1원 이상, 사유 길이). 경로를 '줄 id.칸'으로 바꿔 withContract가 읽게 한다.
function contractIssues({ id, action, row, chosen }: DecisionEntry) {
  const decision =
    action === 'approve' ? approvalOf(id, row.amount, chosen) : rejectionOf(id, row.reason)
  const parsed = DecideLineItemsSchema.safeParse({ decisions: [decision] })
  return (parsed.error?.issues ?? []).map(issue => ({
    code: issue.code,
    path: [id, ...issue.path.slice(2)],
  }))
}

// 누를 때 확인: 비었으면 그 말을, 계약이 받지 않으면 계약의 문제를 칸 아래에 보인다. 길이 숫자는 적지 않는다.
export function decisionErrors(entries: DecisionEntry[]): FieldErrors {
  const own: FieldErrors = Object.assign({}, ...entries.map(emptyFields))
  const issues = entries.flatMap(contractIssues)
  return withContract(own, { success: issues.length === 0, error: { issues } })
}
