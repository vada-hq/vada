import { expect, test } from 'vitest'
import { expenseSummary } from '@/test-support/expense-fixtures'
import { expenseAmount, expensePurposes, filterExpenses, copyExpenseRow } from './expense-filter'

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

test('예산 항목 이름은 같은 지출의 선택 범위에서만 중복 없이 잇고 항목이 없으면 비운다', () => {
  const rows = [
    ...allocations,
    { ...allocations[0]!, amount: 0 },
    { expenseId: 'linked', budgetItemId: null, purpose: null, periodId: null, amount: 0 },
  ]
  expect(expensePurposes(expenses[0]!, rows, { ...filters, period: null })).toBe('소모품, 식비')
  expect(expensePurposes(expenses[0]!, rows, filters)).toBe('소모품')
  expect(
    expensePurposes(expenses[0]!, rows, { ...filters, period: null, budgetItemId: 'b2' }),
  ).toBe('식비')
  expect(expensePurposes(expenses[0]!, rows, { ...filters, budgetItemId: 'b2' })).toBe('')
  expect(expensePurposes(expenses[1]!, rows, filters)).toBe('')
})

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

test('상시는 행사 없는 지출만 기존 기간·항목·증빙·검색 조건과 함께 거른다', () => {
  const rows = [
    expenseSummary('linked', { event: null, evidenceCount: 0 }),
    expenseSummary('cash', {
      paidOn: '2026-06-30',
      event: { id: 'e1', name: '축제' },
      evidenceCount: 0,
    }),
  ]
  const selected = {
    ...filters,
    eventId: 'none',
    budgetItemId: 'b1',
    evidence: 'missing',
    search: '포스터',
  }
  expect(filterExpenses(rows, allocations, selected)).toEqual([rows[0]])
  expect(filterExpenses(rows, allocations, { ...selected, evidence: 'present' })).toEqual([])
  expect(filterExpenses(rows, allocations, { ...selected, search: '없는 내역' })).toEqual([])
  expect(filterExpenses(rows, allocations, { ...filters, eventId: 'e1' })).toEqual([rows[1]])
  expect(filterExpenses(rows, allocations, { ...filters, eventId: '' })).toEqual(rows)
})

test('행 복사는 계정과목 칸 없이 행사·내역 두 칸이고 탭과 줄바꿈을 한 칸으로 정리한다', () => {
  const row = expenseSummary('x', {
    description: '=SUM(A1)\t인쇄\n내역',
    event: { id: 'e', name: '축제\t행사' },
  })
  expect(copyExpenseRow(row)).toBe("축제 행사\t'=SUM(A1) 인쇄 내역")
})

test('결제 내역은 있지만 예산 항목이 없는 지출은 개요처럼 기간을 고르면 결제일로도 넣지 않는다', () => {
  const lined = expenseSummary('lined', { paidOn: '2026-06-30', amount: 90 })
  const lines = [
    { expenseId: 'lined', budgetItemId: null, purpose: null, periodId: null, amount: 90 },
  ]
  expect(filterExpenses([lined], lines, filters)).toEqual([])
  expect(filterExpenses([lined], lines, { ...filters, period: null })).toEqual([lined])
  expect(expenseAmount(lined, lines, { ...filters, period: null })).toBe(90)
})

test('행 복사는 따옴표로 감싼 수식도 글로 붙게 칸을 감싸고 따옴표를 겹친다', () => {
  const row = expenseSummary('q', { description: '"=1+1"', event: null })
  expect(copyExpenseRow(row)).toBe(`\t"'""=1+1"""`)
})
