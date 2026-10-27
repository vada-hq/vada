import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { FinanceCommitmentsResponse, FinanceOverviewResponse } from '@vada/contracts'
import { withSettlement } from '../test-support/settlement.js'

test(
  '예정 내역은 일부 결제의 잔액·취소 지출을 약정과 같이 세고 전액 결제·취소·다른 학생회는 뺀다',
  withSettlement(async t => {
    const { period, budget } = await t.budgetOf()
    const item = await t.budgetItem(budget, { purpose: '식비' })
    const make = async (outcome: 'approved' | 'cancelled' = 'approved') => {
      const made = await t.requestWithItem(null)
      await t.pg.query('UPDATE line_item SET amount = 30000, budget_item_id = $1 WHERE id = $2', [
        item,
        made.line,
      ])
      await t.approve(made.line, outcome)
      return made
    }
    const partial = await make()
    const paid = await t.expense({ amount: '10000' })
    await t.pay(paid, partial.line, '10000')
    const cancelledPayment = await t.expense({ amount: '5000', cancelledAt: new Date() })
    await t.pay(cancelledPayment, partial.line, '5000')
    const full = await make()
    await t.pay(await t.expense({ amount: '30000' }), full.line, '30000')
    await make('cancelled')
    await t.requestWithItem(null, {}, t.other)
    const base = `/api/organizations/${t.council.councilId}`
    const path = `${base}/finance-commitments?period=${period}`
    const response = await t.api.get(path, 's-plain')
    assert.equal(response.status, 200)
    const { items } = (await response.json()) as FinanceCommitmentsResponse
    assert.equal(items.length, 1)
    assert.equal(items[0]?.id, partial.line)
    assert.equal(items[0]?.amount, 20000)
    const { overview } = (await (
      await t.api.get(`${base}/finance-overview?period=${period}`, 's-plain')
    ).json()) as FinanceOverviewResponse
    assert.equal(items.length, overview?.committedCount)
    assert.equal(
      items.reduce((sum, row) => sum + row.amount, 0),
      overview?.committed,
    )
    assert.equal((await t.api.get(path)).status, 401)
    assert.equal((await t.api.get(path, 'o-president')).status, 403)
    assert.equal(
      (await t.api.get(`${base}/finance-commitments?period=nope`, 's-plain')).status,
      400,
    )
    assert.equal(
      (await t.api.get(`${base}/finance-commitments?extra=value`, 's-plain')).status,
      400,
    )
    const otherPeriod = (await t.budgetOf(t.other)).period
    assert.equal(
      (await t.api.get(`${base}/finance-commitments?period=${otherPeriod}`, 's-plain')).status,
      404,
    )
  }),
)
