import { DecideLineItemsSchema, type BudgetItemView } from '@vada/contracts'
import { withContract, type FieldErrors } from '@/lib/use-form-check'
import { wonOf } from '@/lib/won-input'

// 품목마다 고른 검토 결과. null이면 아직 고르지 않은 것(미검토)이다.
export type Choice = 'approve' | 'reject' | null

// 결재 줄 하나의 입력값. budgetItemId가 null이면 아직 고르지 않은 것이라 마지막에 고른 항목을 보인다.
export type RowValues = {
  amount: string
  budgetItemId: string | null
  reason: string
  choice: Choice
}
export const emptyRow = (): RowValues => ({
  amount: '',
  budgetItemId: null,
  reason: '',
  choice: null,
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

const approvalOf = (lineItemId: string, amount: string, budgetItemId: string) => ({
  lineItemId,
  outcome: 'approved',
  amount: wonOf(amount),
  budgetItemId,
})
const rejectionOf = (lineItemId: string, reason: string) => ({
  lineItemId,
  outcome: 'rejected',
  reason,
})

export type Tally = { approve: number; reject: number; unreviewed: number }

export function tallyOf(choices: readonly Choice[]): Tally {
  const count = (choice: Choice) => choices.filter(value => value === choice).length
  return { approve: count('approve'), reject: count('reject'), unreviewed: count(null) }
}

// 수 세기 '승인 N · 반려 N · 미검토 N'의 앞 둘. 미검토는 누른 뒤 빨갛게 알리므로 화면이 따로 그린다.
export const decidedText = (tally: Tally) => `승인 ${tally.approve} · 반려 ${tally.reject}`

// 보내기 버튼 이름은 고른 조합을 따른다(와이어프레임 FIN-REV-01, DEC-92).
export function submitLabelOf(tally: Tally) {
  if (tally.unreviewed > 0) return '최종 처리'
  if (tally.reject === 0) return '승인 완료 처리'
  return tally.approve === 0 ? '반려 처리' : '부분 승인 처리'
}

export type DecisionEntry = { id: string; row: RowValues; chosen: string }

// 칸 이름은 '줄 id.칸'이다(choice, amount, budgetItemId, reason).
function emptyFields({ id, row, chosen }: DecisionEntry): FieldErrors {
  if (row.choice === null) return { [`${id}.choice`]: '승인이나 반려를 골라 주세요' }
  if (row.choice === 'reject')
    return { [`${id}.reason`]: row.reason.trim() === '' ? '반려 사유를 입력해 주세요' : undefined }
  return {
    [`${id}.amount`]: row.amount.trim() === '' ? '금액을 입력해 주세요' : undefined,
    [`${id}.budgetItemId`]: chosen === '' ? '예산 항목을 골라 주세요' : undefined,
  }
}

// 고른 결과대로 보낼 결재 하나. 고르지 않은 줄은 없다.
export function decisionOf({ id, row, chosen }: DecisionEntry) {
  if (row.choice === 'approve') return approvalOf(id, row.amount, chosen)
  return row.choice === 'reject' ? rejectionOf(id, row.reason) : null
}

// 계약의 경로 ['decisions', 순번, 칸]에서 칸 앞까지의 길이.
const DECISIONS_PATH_LENGTH = 2

// 줄 하나를 계약에 대 본 문제(금액 1원 이상, 사유 길이). 경로를 '줄 id.칸'으로 바꿔 withContract가 읽게 한다.
function contractIssues(entry: DecisionEntry) {
  const decision = decisionOf(entry)
  if (decision === null) return []
  const parsed = DecideLineItemsSchema.safeParse({ decisions: [decision] })
  return (parsed.error?.issues ?? []).map(issue => ({
    code: issue.code,
    path: [entry.id, ...issue.path.slice(DECISIONS_PATH_LENGTH)],
  }))
}

// 누를 때 확인: 비었으면 그 말을, 계약이 받지 않으면 계약의 문제를 칸 아래에 보인다. 길이 숫자는 적지 않는다.
export function decisionErrors(entries: DecisionEntry[]): FieldErrors {
  const own: FieldErrors = Object.fromEntries(
    entries.flatMap(entry => Object.entries(emptyFields(entry))),
  )
  const issues = entries.flatMap(contractIssues)
  return withContract(own, { success: issues.length === 0, error: { issues } })
}
