import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { BudgetResponse } from '@vada/contracts'
import { errorOf, twoPeriods, writesOf } from '../test-support/closing.js'
import { withSettlement } from '../test-support/settlement.js'

test(
  '다음 기간을 미리 만들고 단일·여러 행을 그 기간에만 편성한다',
  withSettlement(async t => {
    const base = `/api/organizations/${t.council.councilId}`
    const current = await t.budgetOf()
    const made = await t.api.post(
      `${base}/fiscal-periods`,
      {
        name: '2027년 1학기',
        startsOn: '2027-03-01',
        endsOn: '2027-08-31',
      },
      's-financeMember',
    )
    assert.equal(made.status, 201)
    const { period } = (await made.json()) as BudgetResponse
    assert.ok(period)
    for (const [path, body] of [
      ['/budget-items', { purpose: '비품', amount: 1000 }],
      ['/budget-items/batch', { items: [{ purpose: '식비', amount: 2000 }] }],
    ] as const) {
      const response = await t.api.post(
        `${base}${path}?period=${period.id}`,
        body,
        's-financeMember',
      )
      assert.equal(response.status, 201)
      assert.equal(((await response.json()) as BudgetResponse).period?.id, period.id)
    }
    const read = async (id: string) =>
      (await (
        await t.api.get(`${base}/budget?period=${id}`, 's-financeMember')
      ).json()) as BudgetResponse
    assert.equal((await read(current.period)).items.length, 0)
    assert.equal((await read(period.id)).items.length, 2)
    const theirs = await t.budgetOf(t.other)
    const body = { purpose: '비품', amount: 1000 }
    assert.equal(
      (await t.api.post(`${base}/budget-items?period=${theirs.period}`, body, 's-financeMember'))
        .status,
      404,
    )
    assert.equal(
      (await t.api.post(`${base}/budget-items?period=bad`, body, 's-financeMember')).status,
      400,
    )
    assert.equal(
      (await t.api.post(`${base}/budget-items?period=${period.id}`, body, 's-president')).status,
      403,
    )
    assert.equal((await t.api.post(`${base}/budget-items?period=${period.id}`, body)).status, 401)
  }),
)

test(
  '공개한 기간에는 ?period=로 단일·여러 행을 더해도 409 PERIOD_CLOSED이고 아무것도 쓰지 않는다',
  withSettlement(async t => {
    const { first, firstBudget } = await twoPeriods(t)
    const closing = await t.make(t.council, 'account_closing', { fiscalPeriodId: first })
    await t.pg.query('UPDATE account_closing SET published_at = now() WHERE id = $1', [closing])
    const base = `/api/organizations/${t.council.councilId}`
    for (const [path, body] of [
      ['/budget-items', { purpose: '비품', amount: 1000 }],
      ['/budget-items/batch', { items: [{ purpose: '식비', amount: 2000 }] }],
    ] as const) {
      const before = await writesOf(t)
      const response = await t.api.post(`${base}${path}?period=${first}`, body, 's-financeMember')
      assert.equal(response.status, 409, path)
      assert.equal(await errorOf(response), 'PERIOD_CLOSED', path)
      assert.equal(await writesOf(t), before, `${path}: 기록이 남았다`)
    }
    const items = await t.pg.query('SELECT 1 FROM budget_item WHERE budget_id = $1', [firstBudget])
    assert.equal(items.rowCount, 0)
  }),
)
