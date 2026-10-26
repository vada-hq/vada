import { expect, test } from 'vitest'
import type { BudgetItemView } from '@vada/contracts'
import { eventItemsFirst, overagesOf, usageLineOf } from './decision-budget'

const item = (id: string, available: number, event: string | null = null): BudgetItemView => ({
  id,
  purpose: `항목 ${id}`,
  amount: available,
  type: 'expense',
  event: event ? { id: event, name: `행사 ${event}` } : null,
  selectable: true,
  deletable: true,
  history: [],
  actual: 0,
  committed: 0,
  available,
})

test('같은 항목에 승인하는 금액을 모두 더해 사용 가능을 넘는 만큼이 초과다', () => {
  const items = [item('a', 50_000), item('b', 10_000)]
  const over = overagesOf(
    [
      { choice: 'approve', amount: '30,000', budgetItemId: 'a' },
      { choice: 'approve', amount: '30000', budgetItemId: 'a' },
      { choice: 'approve', amount: '10000', budgetItemId: 'b' },
      // 반려와 안 고른 줄, 금액이 숫자가 아닌 줄은 세지 않는다.
      { choice: 'reject', amount: '99999', budgetItemId: 'b' },
      { choice: null, amount: '99999', budgetItemId: 'b' },
      { choice: 'approve', amount: '만 원', budgetItemId: 'b' },
    ],
    items,
  )
  expect(over).toEqual([{ id: 'a', purpose: '항목 a', available: 50_000, after: -10_000 }])
})

test('이미 음수인 항목에 승인하면 승인 금액 그대로가 더 넘는다', () => {
  const over = overagesOf(
    [{ choice: 'approve', amount: '5000', budgetItemId: 'a' }],
    [item('a', -2000)],
  )
  expect(over).toEqual([{ id: 'a', purpose: '항목 a', available: -2000, after: -7000 }])
})

test('항목 옆 줄은 사용 가능과, 넘으면 초과액이다', () => {
  expect(usageLineOf(item('a', 50_000), [])).toEqual({ available: '50,000원', over: null })
  expect(
    usageLineOf(item('a', 50_000), [
      { id: 'a', purpose: '항목 a', available: 50_000, after: -10_000 },
    ]),
  ).toEqual({ available: '50,000원', over: '10,000원' })
  expect(usageLineOf(item('a', -2000), [])).toEqual({ available: '-2,000원', over: null })
  // 이미 넘은 항목은 이번 승인 뒤의 초과액 전체다.
  expect(
    usageLineOf(item('a', -2000), [{ id: 'a', purpose: '항목 a', available: -2000, after: -7000 }]),
  ).toEqual({ available: '-2,000원', over: '7,000원' })
})

test('요청 행사의 항목이 먼저이고 그 아래 행사 없는 항목이다', () => {
  const items = [item('none', 1), item('spring', 1, 'spring'), item('none2', 1)]
  expect(eventItemsFirst(items, 'spring').map(i => i.id)).toEqual(['spring', 'none', 'none2'])
  // 행사가 없는 요청은 받은 차례 그대로다.
  expect(eventItemsFirst(items, null).map(i => i.id)).toEqual(['none', 'spring', 'none2'])
})
