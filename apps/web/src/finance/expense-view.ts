import { EVIDENCE_TYPE_LABEL, METHOD_LABEL, type ExpenseSummary } from '@vada/contracts'

export { EVIDENCE_TYPE_LABEL, METHOD_LABEL }

// 목록 카드와 상세가 같이 보이는 상태 칩. 취소된 지출은 환급 전과 증빙 없음을 말하지 않는다.
export type ExpenseChip = { label: string; tone: 'neutral' | 'warning' | 'success' }
export const missingEvidence = (expense: ExpenseSummary) =>
  !expense.cancelled && expense.evidenceCount === 0

export function chipsOf(expense: ExpenseSummary): ExpenseChip[] {
  if (expense.cancelled) return [{ label: '취소됨', tone: 'neutral' }]
  const chips: ExpenseChip[] = []
  if (expense.paidBy) {
    chips.push(
      expense.reimbursed
        ? { label: '환급함', tone: 'success' }
        : { label: '환급 전', tone: 'warning' },
    )
  }
  if (missingEvidence(expense)) chips.push({ label: '증빙 없음', tone: 'warning' })
  return chips
}

// 표의 부서 칸과 카드가 같이 쓴다. 겸직이나 여러 요청이면 모두 잇는다.
export const departmentsLabel = (expense: ExpenseSummary) =>
  expense.departments.map(department => department.name).join(', ')

export const paidByLabel = (expense: ExpenseSummary) =>
  expense.paidBy ? `먼저 낸 사람 ${expense.paidBy.name}` : '학생회 돈'
