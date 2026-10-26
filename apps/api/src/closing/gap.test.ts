import assert from 'node:assert/strict'
import { test } from 'node:test'
import { errorOf, readClosing, twoPeriods } from '../test-support/closing.js'
import { withSettlement } from '../test-support/settlement.js'

test(
  '기간 사이 빈 날의 지출은 적을 수 있지만 어느 결산 합계에도 들지 않아 점검에 보인다',
  withSettlement(async t => {
    const { first, next } = await twoPeriods(t)
    await t.pg.query("UPDATE fiscal_period SET ends_on = '2026-08-30' WHERE id = $1", [first])
    await t.make(t.other, 'fiscal_period', {
      name: '다른 학생회 기간',
      startsOn: '2026-08-01',
      endsOn: '2026-09-30',
    })
    const base = `/api/organizations/${t.council.councilId}`
    const response = await t.api.post(
      `${base}/expenses`,
      {
        commandId: '11111111-1111-4111-8111-111111111111',
        vendor: '문구점',
        description: '빈 날 지출',
        paidOn: '2026-08-31',
        method: 'card',
        amount: 1234,
        reason: '행사 준비',
      },
      's-financeMember',
    )
    assert.equal(response.status, 201, await errorOf(response.clone()))
    const { expense } = (await response.json()) as { expense: { id: string } }
    await t.expense({
      paidAt: new Date('2026-08-31T03:00:00Z'),
      cancelledAt: new Date(),
      amount: '999',
    })
    await t.expense({ paidAt: new Date('2026-08-31T03:00:00Z'), amount: '1234' }, t.other)
    for (const period of [first, next]) {
      const closing = await readClosing(t, period)
      assert.equal(closing.expense.total, 0)
      const check = closing.checks.find(row => row.kind === 'no_period')
      assert.equal(check?.count, 1)
      assert.deepEqual(
        check?.targets.map(target => target.id),
        [expense.id],
      )
    }
  }),
)
