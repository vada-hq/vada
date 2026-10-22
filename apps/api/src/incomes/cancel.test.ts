import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { IncomeDetail, IncomesResponse } from '@vada/contracts'
import { MISSING, withSettlement, type SettlementKit } from '../test-support/settlement.js'

const FINANCE = 's-financeMember'
const errorOf = async (response: Response) => ((await response.json()) as { error: string }).error
const incomeOf = async (response: Response) =>
  ((await response.json()) as { income: IncomeDetail }).income
const root = (t: SettlementKit, councilId = t.council.councilId) =>
  `/api/organizations/${councilId}/incomes`
const cancel = (
  t: SettlementKit,
  id: string,
  user: string | null = FINANCE,
  reason = '잘못 적음',
) => t.api.post(`${root(t)}/${id}/cancel`, { reason }, user ?? undefined)
const raw = (t: SettlementKit, period: string, values: object = {}, owner = t.council) =>
  t.make(owner, 'income', {
    fiscalPeriodId: period,
    source: 'fee',
    amount: '5000',
    receivedOn: '2026-10-01',
    ...values,
  })
const cancelledAt = async (t: SettlementKit, id: string) =>
  (
    (await t.pg.query('SELECT cancelled_at FROM income WHERE id = $1', [id])).rows[0] as {
      cancelled_at: unknown
    }
  ).cancelled_at

test(
  '재정부가 수입을 취소한다: 사유가 판에 남고 판이 하나 늘며 취소 동작이 사라진다. 다시 취소하면 409',
  withSettlement(async t => {
    const { period } = await t.budgetOf()
    const created = await incomeOf(
      await t.api.post(
        root(t),
        { source: 'grant', amount: 70000, receivedOn: '2026-10-20' },
        FINANCE,
      ),
    )
    const response = await cancel(t, created.id, FINANCE, '금액을 잘못 적음')
    assert.equal(response.status, 200)
    const detail = await incomeOf(response)
    assert.equal(detail.cancelled, true)
    assert.deepEqual(detail.actions, [])
    assert.deepEqual(
      detail.history.map(version => [version.versionNo, version.changes, version.reason]),
      [
        [1, [{ field: 'created' }], null],
        [2, [{ field: 'cancelled' }], '금액을 잘못 적음'],
      ],
    )
    const again = await cancel(t, created.id)
    assert.equal(await errorOf(again), 'INCOME_CANCELLED')
    const versions = await t.pg.query(
      'SELECT count(*) AS n FROM record_version WHERE record_id = $1',
      [created.id],
    )
    assert.equal(Number((versions.rows[0] as { n: string }).n), 2)
    // 취소한 수입도 목록과 상세에서 읽는다
    const list = (await (
      await t.api.get(`${root(t)}?period=${period}`, 's-planningMember')
    ).json()) as IncomesResponse
    assert.deepEqual(
      list.incomes.map(item => [item.id, item.cancelled]),
      [[created.id, true]],
    )
  }),
)

test(
  '재정부가 아니면 취소는 403이고 로그인하지 않으면 401이다. 다른 학생회 수입은 404다',
  withSettlement(async t => {
    const { period } = await t.budgetOf()
    const id = await raw(t, period)
    for (const user of ['s-president', 's-planningMember', 'o-financeMember'])
      assert.equal((await cancel(t, id, user)).status, 403, user)
    assert.equal((await cancel(t, id, null)).status, 401)
    assert.equal(await cancelledAt(t, id), null)
    const theirs = await t.budgetOf(t.other)
    const theirId = await raw(t, theirs.period, {}, t.other)
    assert.equal((await cancel(t, theirId)).status, 404)
    assert.equal(await cancelledAt(t, theirId), null)
    for (const bad of [MISSING, 'not-an-id'])
      assert.equal(
        (await t.api.post(`${root(t)}/${bad}/cancel`, { reason: 'x' }, FINANCE)).status,
        404,
      )
    // 읽기도 다른 학생회 수입은 404다
    assert.equal((await t.api.get(`${root(t)}/${theirId}`, FINANCE)).status, 404)
  }),
)

test(
  '이월금과 참가비 수입은 이 경로로 취소하지 못한다(409 INCOME_AUTOMATIC). 이미 취소한 것도 같다',
  withSettlement(async t => {
    const { period } = await t.budgetOf()
    const carry = await raw(t, period, { source: 'carryover', description: '2026-1 이월금' })
    const fee = await raw(t, period, { source: 'participation_fee' })
    const gone = await raw(t, period, { source: 'participation_fee', cancelledAt: new Date() })
    for (const id of [carry, fee, gone]) {
      assert.equal(await errorOf(await cancel(t, id)), 'INCOME_AUTOMATIC')
      assert.deepEqual((await incomeOf(await t.api.get(`${root(t)}/${id}`, FINANCE))).actions, [])
    }
    assert.equal(await cancelledAt(t, carry), null)
    assert.equal(await cancelledAt(t, fee), null)
  }),
)

test(
  '완료한 행사의 수입 항목을 고른 수입은 취소가 409 EVENT_COMPLETED이고 동작에서 빠진다. 완료를 취소하면 다시 된다',
  withSettlement(async t => {
    const { period, budget } = await t.budgetOf()
    const event = await t.event()
    const item = await t.budgetItem(budget, { type: 'income', eventId: event })
    const id = await raw(t, period, { budgetItemId: item })
    assert.deepEqual((await incomeOf(await t.api.get(`${root(t)}/${id}`, FINANCE))).actions, [
      'income.cancel',
    ])
    await t.completion(event, 'completed', new Date('2026-10-24T03:00:00Z'))
    assert.equal(await errorOf(await cancel(t, id)), 'EVENT_COMPLETED')
    assert.equal(await cancelledAt(t, id), null)
    assert.deepEqual((await incomeOf(await t.api.get(`${root(t)}/${id}`, FINANCE))).actions, [])
    // 403이 먼저다
    assert.equal((await cancel(t, id, 's-president')).status, 403)
    await t.completion(event, 'completion_cancelled', new Date('2026-10-24T04:00:00Z'), '다시')
    assert.equal((await cancel(t, id)).status, 200)
  }),
)

test(
  '취소하면 그 수입 항목의 행사 정산 쓴 돈에서 빠진다',
  withSettlement(async t => {
    const { period, budget } = await t.budgetOf()
    const event = await t.event()
    const item = await t.budgetItem(budget, { type: 'income', eventId: event })
    const kept = await raw(t, period, { budgetItemId: item, amount: '3000' })
    const dropped = await raw(t, period, { budgetItemId: item, amount: '2000' })
    const usedOf = async () =>
      (await t.settlement(event)).budget.items.find(entry => entry.id === item)?.used
    assert.equal(await usedOf(), 5000)
    assert.equal((await cancel(t, dropped)).status, 200)
    assert.equal(await usedOf(), 3000)
    assert.equal(await cancelledAt(t, kept), null)
  }),
)

test(
  '수입 목록: 그 기간만, 받은 날 최근 순이며 취소한 것과 참가비·이월금도 준다. 모든 운영진이 읽는다',
  withSettlement(async t => {
    const { period, budget } = await t.budgetOf()
    const item = await t.budgetItem(budget, { type: 'income', purpose: '후원' })
    const old = await t.make(t.council, 'fiscal_period', {
      name: '2026-1',
      startsOn: '2026-01-01',
      endsOn: '2026-08-31',
    })
    await raw(t, old, { receivedOn: '2026-03-01' })
    const first = await raw(t, period, { receivedOn: '2026-10-01', description: '가' })
    const second = await raw(t, period, {
      receivedOn: '2026-10-20',
      source: 'participation_fee',
      cancelledAt: new Date(),
    })
    const third = await raw(t, period, {
      receivedOn: '2026-10-20',
      budgetItemId: item,
      description: '나',
    })
    for (const user of ['s-financeMember', 's-president', 's-planningMember']) {
      const response = await t.api.get(`${root(t)}?period=${period}`, user)
      assert.equal(response.status, 200, user)
      const list = (await response.json()) as IncomesResponse
      assert.equal(list.truncated, false)
      // 같은 날은 나중에 만든 것(번호가 큰 것)이 먼저다
      assert.deepEqual(
        list.incomes.map(entry => entry.id),
        [third, second, first],
        user,
      )
    }
    const list = (await (
      await t.api.get(`${root(t)}?period=${period}`, FINANCE)
    ).json()) as IncomesResponse
    assert.deepEqual(
      list.incomes.map(entry => [entry.source, entry.cancelled, entry.budgetItem?.purpose ?? null]),
      [
        ['fee', false, '후원'],
        ['participation_fee', true, null],
        ['fee', false, null],
      ],
    )
    assert.equal(list.incomes[0]?.createdBy?.name, 's president')
    assert.equal(list.incomes[0]?.amount, 5000)
  }),
)

test(
  '수입 읽기: 로그인하지 않으면 401, 다른 학생회 사람은 403, 기간을 빼거나 틀리면 400, 없는 기간은 404다',
  withSettlement(async t => {
    const { period } = await t.budgetOf()
    const id = await raw(t, period)
    const url = `${root(t)}?period=${period}`
    assert.equal((await t.api.get(url)).status, 401)
    assert.equal((await t.api.get(`${root(t)}/${id}`)).status, 401)
    assert.equal((await t.api.get(url, 'o-financeMember')).status, 403)
    assert.equal((await t.api.get(`${root(t)}/${id}`, 'o-financeMember')).status, 403)
    for (const query of [
      '',
      '?period=abc',
      `?period=${period}&period=${period}`,
      `?period=${period}&x=1`,
    ])
      assert.equal((await t.api.get(`${root(t)}${query}`, FINANCE)).status, 400, query)
    assert.equal((await t.api.get(`${root(t)}?period=${MISSING}`, FINANCE)).status, 404)
    assert.equal((await t.api.get(`${root(t)}/${MISSING}`, FINANCE)).status, 404)
    assert.equal((await t.api.get(`${root(t)}/not-an-id`, FINANCE)).status, 404)
  }),
)
