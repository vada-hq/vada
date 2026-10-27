import { expect, test } from 'vitest'
import { expenseSummary } from '@/test-support/expense-fixtures'
import { expenseAmount, filterExpenses, copyExpenseRow } from './expense-filter'

const period = { id: 'p1', name: '1학기', startsOn: '2026-01-01', endsOn: '2026-06-30' }
const expenses = [
  expenseSummary('linked', { paidOn: '2026-07-01', amount: 300, vendor: '문구점' }),
  expenseSummary('cash', { paidOn: '2026-06-30', amount: 70 }),
  expenseSummary('other', { paidOn: '2026-06-30', amount: 40 }),
  expenseSummary('cancelled', { paidOn: '2026-06-30', cancelled: true }),
]
const allocations = [
  { expenseId: 'linked', budgetItemId: 'b1', purpose: '소모품', periodId: 'p1', amount: 100 },
  { expenseId: 'linked', budgetItemId: 'b2', purpose: '식비', periodId: 'p2', amount: 200 },
  { expenseId: 'other', budgetItemId: 'b2', purpose: '식비', periodId: 'p2', amount: 40 },
]
const filters = { period, eventId: '', budgetItemId: '', evidence: '', search: '' }

test('항목에 든 지출은 항목 기간, 항목 없는 지출만 결제일로 거르고 취소는 뺀다', () => {
  const found = filterExpenses(expenses, allocations, filters)
  expect(found.map(row => row.id)).toEqual(['linked', 'cash'])
  expect(found.reduce((sum, row) => sum + expenseAmount(row, allocations, filters), 0)).toBe(170)
  expect(filterExpenses(expenses, allocations, { ...filters, period: null })).toHaveLength(4)
})

test('행사·항목·증빙·사용처와 내역을 함께 거르며 0건을 돌려준다', () => {
  const row = expenseSummary('linked', { event: { id: 'e1', name: '축제' }, evidenceCount: 0 })
  expect(
    filterExpenses([row], allocations, {
      ...filters,
      eventId: 'e1',
      budgetItemId: 'b1',
      evidence: 'missing',
      search: '포스터',
    }),
  ).toEqual([row])
  expect(filterExpenses([row], allocations, { ...filters, search: '없는 사용처' })).toEqual([])
  expect(filterExpenses([row], allocations, { ...filters, evidence: 'present' })).toEqual([])
  expect(filterExpenses([row], allocations, { ...filters, eventId: 'e2' })).toEqual([])
})

test('행 복사는 학교 과목을 추측하지 않으며 탭과 줄바꿈을 한 칸으로 정리한다', () => {
  const row = expenseSummary('x', {
    description: '=SUM(A1)\t인쇄\n내역',
    event: { id: 'e', name: '축제\t행사' },
  })
  expect(copyExpenseRow(row)).toBe("확인 필요\t축제 행사\t'=SUM(A1) 인쇄 내역")
})
