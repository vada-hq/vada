import type { ExpenseAllocation, ExpenseSummary, FiscalPeriodView } from '@vada/contracts'

export type ExpenseFilters = {
  period: FiscalPeriodView | null
  eventId: string
  budgetItemId: string
  evidence: string
  search: string
}

const allocationsFor = (rows: ExpenseAllocation[], filters: ExpenseFilters) =>
  rows.filter(
    row =>
      (!filters.period || row.periodId === filters.period.id) &&
      (!filters.budgetItemId || row.budgetItemId === filters.budgetItemId),
  )

// 여러 기간·항목에 나눈 결제는 지금 고른 범위에 배분된 확정 금액만 더한다.
export function expenseAmount(
  expense: ExpenseSummary,
  allocations: ExpenseAllocation[],
  filters: ExpenseFilters,
) {
  const rows = allocations.filter(row => row.expenseId === expense.id)
  if (rows.length === 0 || (!filters.period && !filters.budgetItemId)) return expense.amount
  return allocationsFor(rows, filters).reduce((sum, row) => sum + row.amount, 0)
}

function inBudget(
  expense: ExpenseSummary,
  allocations: ExpenseAllocation[],
  filters: ExpenseFilters,
) {
  const rows = allocations.filter(row => row.expenseId === expense.id)
  if (rows.length > 0) return allocationsFor(rows, filters).length > 0
  if (filters.budgetItemId) return false
  return (
    !filters.period ||
    (expense.paidOn >= filters.period.startsOn && expense.paidOn <= filters.period.endsOn)
  )
}

export function filterExpenses(
  expenses: ExpenseSummary[],
  allocations: ExpenseAllocation[],
  filters: ExpenseFilters,
) {
  const search = filters.search.trim().toLocaleLowerCase('ko')
  return expenses.filter(
    expense =>
      (!filters.period || !expense.cancelled) &&
      (!filters.eventId || expense.event?.id === filters.eventId) &&
      hasEvidence(expense, filters.evidence) &&
      `${expense.vendor} ${expense.description}`.toLocaleLowerCase('ko').includes(search) &&
      inBudget(expense, allocations, filters),
  )
}

function hasEvidence(expense: ExpenseSummary, filter: string) {
  if (filter === 'missing') return expense.evidenceCount === 0
  return filter !== 'present' || expense.evidenceCount > 0
}

// 계정과목은 두지 않으므로(DEC-70) 칸을 만들지 않고 행사·내역만 복사한다.
// 셀 경계와 수식 시작 문자를 정리해 학교 엑셀 양식에 글로 붙는다. 붙여넣기는 따옴표로 감싼 칸을 풀므로
// 앞 따옴표 뒤의 수식도 막고, 따옴표가 있는 칸은 감싸고 겹친다(OWASP CSV Injection).
const FORMULA_START = /^[\s"']*[=+@-]/
const cell = (value: string) => {
  const flat = value.replace(/[\t\r\n]+/g, ' ')
  const text = FORMULA_START.test(flat) ? `'${flat}` : flat
  return text.includes('"') ? `"${text.replaceAll('"', '""')}"` : text
}
export const copyExpenseRow = (expense: ExpenseSummary) =>
  [expense.event?.name ?? '', expense.description].map(cell).join('\t')
