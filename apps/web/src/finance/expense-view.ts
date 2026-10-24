import { EVIDENCE_TYPE_LABEL, METHOD_LABEL, type ExpenseSummary } from '@vada/contracts'

export { EVIDENCE_TYPE_LABEL, METHOD_LABEL }

// 목록 카드와 상세가 같이 보이는 상태 칩. 취소된 지출은 환급 전과 증빙 없음을 말하지 않는다.
export type ExpenseChip = { label: string; tone: 'neutral' | 'warning' | 'success' }
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
  if (expense.evidenceCount === 0) chips.push({ label: '증빙 없음', tone: 'warning' })
  return chips
}

export const paidByLabel = (expense: ExpenseSummary) =>
  expense.paidBy ? `먼저 낸 사람 ${expense.paidBy.name}` : '학생회 돈'
