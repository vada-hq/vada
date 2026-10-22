import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { EventDetail } from '@vada/contracts'
import { MISSING, withSettlement, type SettlementKit } from '../test-support/settlement.js'

const PRESIDENT = 's-president'
const DAY = (value: string) => new Date(`${value}:00Z`)

const call = (t: SettlementKit, event: string, action: string, ...rest: [unknown, string?]) =>
  t.api.post(
    `/api/organizations/${t.council.councilId}/events/${event}/${action}`,
    rest[0],
    rest.length > 1 ? rest[1] : PRESIDENT,
  )
const errorOf = async (response: Response) => ((await response.json()) as { error: string }).error
const detailOf = async (response: Response) =>
  ((await response.json()) as { event: EventDetail }).event

// 참가비를 받는 행사 하나: 계좌 둘, 입금 셋(한 계좌 둘, 다른 계좌 하나)과 회계 기간
async function feeEvent(t: SettlementKit) {
  const { period } = await t.budgetOf()
  const account = async (name: string) =>
    t.make(t.council, 'account', {
      name,
      bank: '국민은행',
      accountNumber: `123-${name}`,
      holder: '학생회',
      type: name === 'a' ? 'main' : 'business',
    })
  const [a, b] = [await account('a'), await account('b')]
  const event = await t.event({ name: '봄 축제' })
  const formA = await t.form(event, t.council, {
    feeAccountId: a,
    payerFee: '5000',
    nonPayerFee: '5000',
  })
  const formB = await t.form(event, t.council, {
    feeAccountId: b,
    payerFee: '3000',
    nonPayerFee: '3000',
  })
  const r1 = await t.registration(formA)
  const r2 = await t.registration(formA)
  const r3 = await t.registration(formB)
  const d1 = await t.deposit(r1, { amount: '5000', confirmedAt: DAY('2026-10-20T03:00') })
  const d2 = await t.deposit(r2, {
    amount: '5000',
    confirmedAt: DAY('2026-10-22T03:00'),
    refundedAt: DAY('2026-10-23T03:00'),
    refundAmount: '2000',
  })
  const d3 = await t.deposit(r3, { amount: '3000', confirmedAt: DAY('2026-10-21T15:30') })
  await t.change('registration', r2, { cancelledAt: DAY('2026-10-22T05:00'), name: null })
  return { event, period, a, b, deposits: [d1, d2, d3] }
}

test(
  '완료: 회장단만, 참가비 수입이 계좌마다 하나 생기고 입금 기록이 그것을 잇는다',
  withSettlement(async t => {
    const f = await feeEvent(t)
    assert.equal((await call(t, f.event, 'complete', {}, 's-planningMember')).status, 403)
    assert.equal((await call(t, f.event, 'complete', {}, 's-financeMember')).status, 403)
    assert.equal((await call(t, f.event, 'complete', {}, '')).status, 401)
    assert.equal((await call(t, MISSING, 'complete', {})).status, 404)
    const response = await call(t, f.event, 'complete', { reason: '정산 끝' })
    assert.equal(response.status, 200)
    const detail = await detailOf(response)
    assert.equal(detail.status, 'completed')
    assert.deepEqual(
      detail.approvals.map(item => [item.outcome, item.reason]),
      [['completed', '정산 끝']],
    )
    assert.ok(!detail.actions.includes('event.update'))
    const incomes = (
      await t.pg.query(
        `SELECT account_id, amount::int AS amount, received_on::text AS on, description, source, budget_item_id
         FROM income ORDER BY amount DESC`,
      )
    ).rows as Record<string, unknown>[]
    assert.deepEqual(
      incomes.map(row => [row.account_id, row.amount, row.on, row.description, row.source]),
      [
        [f.a, 8000, '2026-10-22', '봄 축제 참가비', 'participation_fee'],
        [f.b, 3000, '2026-10-22', '봄 축제 참가비', 'participation_fee'],
      ],
    )
    assert.equal(incomes[0]?.budget_item_id, null)
    const linked = await t.pg.query(
      'SELECT count(*)::int AS n FROM deposit WHERE income_id IS NOT NULL',
    )
    assert.equal((linked.rows[0] as { n: number }).n, 3)
    assert.equal((await call(t, f.event, 'complete', {})).status, 409)
    assert.equal(await errorOf(await call(t, f.event, 'complete', {})), 'EVENT_COMPLETED')
  }),
)

test(
  '완료할 수 없을 때: 시작 전과 날짜 미정, 정산이 남음, 회계 기간 없음은 409이고 아무것도 생기지 않는다',
  withSettlement(async t => {
    const future = await t.event({ startsAt: new Date('2027-01-01T00:00:00Z') })
    assert.equal(await errorOf(await call(t, future, 'complete', {})), 'EVENT_NOT_STARTED')
    const tbd = await t.event({ startsAt: null })
    assert.equal(await errorOf(await call(t, tbd, 'complete', {})), 'EVENT_NOT_STARTED')
    const open = await t.event()
    await t.requestWithItem(open)
    assert.equal(await errorOf(await call(t, open, 'complete', {})), 'SETTLEMENT_PENDING')
    // 회계 기간이 없으면 수입을 만들지 못해 완료되지 않는다
    const f = await feeEvent(t)
    await t.pg.query("UPDATE fiscal_period SET starts_on = '2025-01-01', ends_on = '2025-02-01'")
    assert.equal(await errorOf(await call(t, f.event, 'complete', {})), 'NO_FISCAL_PERIOD')
    const counts = (
      await t.pg.query(
        `SELECT (SELECT count(*) FROM income)::int AS i,
                (SELECT count(*) FROM approval WHERE target_kind = 'event')::int AS a`,
      )
    ).rows[0]
    assert.deepEqual(counts, { i: 0, a: 0 })
  }),
)

test(
  '끝나지 않은 업무가 있어도 완료된다',
  withSettlement(async t => {
    const event = await t.event()
    await t.make(t.council, 'task', { title: '현수막', eventId: event })
    assert.equal((await call(t, event, 'complete', {})).status, 200)
  }),
)

test(
  '완료 취소: 사유가 꼭 있고 수입을 같은 사유로 취소하며, 다시 완료하면 새 수입이 생긴다',
  withSettlement(async t => {
    const f = await feeEvent(t)
    assert.equal(
      await errorOf(await call(t, f.event, 'cancel-completion', { reason: 'x' })),
      'EVENT_NOT_COMPLETED',
    )
    await call(t, f.event, 'complete', {})
    assert.equal((await call(t, f.event, 'cancel-completion', { reason: '  ' })).status, 400)
    assert.equal((await call(t, f.event, 'cancel-completion', {})).status, 400)
    assert.equal(
      (await call(t, f.event, 'cancel-completion', { reason: 'x' }, 's-financeMember')).status,
      403,
    )
    const response = await call(t, f.event, 'cancel-completion', { reason: '잘못 눌렀어요' })
    assert.equal(response.status, 200)
    assert.notEqual((await detailOf(response)).status, 'completed')
    const cancelled = await t.pg.query(
      'SELECT count(*)::int AS n FROM income WHERE cancelled_at IS NOT NULL',
    )
    assert.equal((cancelled.rows[0] as { n: number }).n, 2)
    const versions = await t.pg.query(
      `SELECT count(*)::int AS n FROM record_version v JOIN income i ON i.id = v.record_id
       WHERE v.reason = '잘못 눌렀어요'`,
    )
    assert.equal((versions.rows[0] as { n: number }).n, 2)
    assert.equal((await call(t, f.event, 'complete', {})).status, 200)
    const all = await t.pg.query(
      'SELECT count(*)::int AS n, count(*) FILTER (WHERE cancelled_at IS NULL)::int AS live FROM income',
    )
    assert.deepEqual(all.rows[0], { n: 4, live: 2 })
  }),
)

test(
  '다른 학생회 행사는 404이고, 입금이 없으면 수입을 만들지 않는다',
  withSettlement(async t => {
    const foreign = await t.event({}, t.other)
    assert.equal((await call(t, foreign, 'complete', {})).status, 404)
    const own = await t.event()
    assert.equal((await call(t, own, 'complete', {})).status, 200)
    const n = await t.pg.query('SELECT count(*)::int AS n FROM income')
    assert.equal((n.rows[0] as { n: number }).n, 0)
  }),
)

test(
  '목록 묶음: 완료한 행사는 끝남 자리로 가고, 완료를 취소한 진행 중 행사는 진행 중 자리로 돌아온다',
  withSettlement(async t => {
    const during = { endsAt: new Date('2026-10-30T00:00:00Z') }
    const reopened = await t.event({
      name: '되돌린 행사',
      startsAt: new Date('2026-10-20T00:00:00Z'),
      ...during,
    })
    const running = await t.event({
      name: '진행 행사',
      startsAt: new Date('2026-10-21T00:00:00Z'),
      ...during,
    })
    const done = await t.event({
      name: '완료한 행사',
      startsAt: new Date('2026-10-19T00:00:00Z'),
      ...during,
    })
    await t.completion(reopened, 'completed', DAY('2026-10-22T03:00'))
    await t.completion(reopened, 'completion_cancelled', DAY('2026-10-23T03:00'), '되돌림')
    await t.completion(done, 'completed', DAY('2026-10-22T03:00'))
    assert.ok(running)
    const response = await t.api.get(t.base, PRESIDENT)
    const { events } = (await response.json()) as { events: { name: string; status: string }[] }
    assert.deepEqual(
      events.map(item => [item.name, item.status]),
      [
        ['되돌린 행사', 'ongoing'],
        ['진행 행사', 'ongoing'],
        ['완료한 행사', 'completed'],
      ],
    )
  }),
)
