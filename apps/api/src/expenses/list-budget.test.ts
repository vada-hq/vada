import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { ExpensesResponse } from '@vada/contracts'
import { withSettlement } from '../test-support/settlement.js'

test(
  '목록은 직접 지출과 결제 내역의 기간·항목·배분 금액을 주며 다른 학생회는 섞이지 않는다',
  withSettlement(async t => {
    const { period, budget } = await t.budgetOf()
    const item = await t.budgetItem(budget, { purpose: '식비' })
    const direct = await t.expense({ budgetItemId: item, amount: '3000' })
    const { line } = await t.requestWithItem(null)
    await t.pg.query('UPDATE line_item SET budget_item_id = $1 WHERE id = $2', [item, line])
    const paid = await t.expense({ amount: '5000' })
    await t.pay(paid, line, '5000')
    await t.expense({}, t.other)
    const response = await t.api.get(
      `/api/organizations/${t.council.councilId}/expenses`,
      's-plain',
    )
    assert.equal(response.status, 200)
    const data = (await response.json()) as ExpensesResponse
    assert.deepEqual(
      data.expenses.map(row => row.id).sort((a, b) => a.localeCompare(b)),
      [direct, paid].sort((a, b) => a.localeCompare(b)),
    )
    assert.deepEqual(
      data.allocations
        ?.map(row => [row.expenseId, row.budgetItemId, row.purpose, row.periodId, row.amount])
        .sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
      [
        [direct, item, '식비', period, 3000],
        [paid, item, '식비', period, 5000],
      ].sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
    )
  }),
)

test(
  '예산 항목이 없는 품목의 결제 내역도 항목·기간 없이 배분으로 준다(개요가 결제일로 세지 않는 지출)',
  withSettlement(async t => {
    const { line } = await t.requestWithItem(null)
    const paid = await t.expense({ amount: '7000' })
    await t.pay(paid, line, '7000')
    const response = await t.api.get(
      `/api/organizations/${t.council.councilId}/expenses`,
      's-plain',
    )
    const data = (await response.json()) as ExpensesResponse
    assert.deepEqual(
      data.allocations?.map(row => [row.expenseId, row.budgetItemId, row.periodId, row.amount]),
      [[paid, null, null, 7000]],
    )
  }),
)
