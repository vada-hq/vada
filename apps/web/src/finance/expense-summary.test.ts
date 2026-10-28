import { expect, test } from 'vitest'
import { expenseSummary } from '@/test-support/expense-fixtures'
import { summarizeExpenses } from './expense-summary'
import { chipsOf } from './expense-view'
import { filterExpenses } from './expense-filter'

const filters = { period: null, eventId: '', budgetItemId: '', evidence: '', search: '' }
const expenses = [
  expenseSummary('a', { amount: 300, evidenceCount: 0 }),
  expenseSummary('b', { amount: 100, evidenceCount: 0, cancelled: true }),
  expenseSummary('c', { amount: 70, paidBy: { id: 'member', name: '운영진' } }),
]

test('합계와 증빙 없음은 취소를 빼고 건수는 취소를 포함하며 칩의 판정과 같다', () => {
  expect(summarizeExpenses(expenses, [], filters)).toEqual({
    amount: 370,
    count: 3,
    missingEvidence: 1,
  })
  expect(summarizeExpenses(expenses, [], filters).missingEvidence).toBe(
    expenses.filter(expense => chipsOf(expense).some(chip => chip.label === '증빙 없음')).length,
  )
  expect(summarizeExpenses([], [], filters)).toEqual({ amount: 0, count: 0, missingEvidence: 0 })
})

test('합계는 기간·예산 항목에 나눈 확정 금액을 쓰고 취소 배분은 더하지 않는다', () => {
  const allocations = [
    { expenseId: 'a', budgetItemId: 'i1', purpose: '홍보', periodId: 'p1', amount: 100 },
    { expenseId: 'a', budgetItemId: 'i2', purpose: '인쇄', periodId: 'p2', amount: 200 },
    { expenseId: 'b', budgetItemId: 'i1', purpose: '홍보', periodId: 'p1', amount: 100 },
  ]
  const period = { id: 'p1', name: '1학기', startsOn: '2026-01-01', endsOn: '2026-06-30' }
  for (const [selected, amount] of [
    [{ ...filters, period }, 100],
    [{ ...filters, budgetItemId: 'i2' }, 200],
    [{ ...filters, period, budgetItemId: 'i2' }, 0],
  ] as const) {
    const found = filterExpenses(expenses, allocations, selected)
    expect(summarizeExpenses(found, allocations, selected).amount).toBe(amount)
  }
})
