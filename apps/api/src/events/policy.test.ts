import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { EventDetail } from '@vada/contracts'
import { actorOf } from '../access/actor.js'
import { isSettled } from '../settlement/remaining.js'
import { decide, factsOf } from './policy.js'
import { MISSING, withSettlement, type SettlementKit } from '../test-support/settlement.js'

// 행사 정책(기능 012 조각 1): 화면에 주는 actions·blockers와 서버의 거절이 같은 판정에서 나온다(자주 잡힌 것 11·12).

const PRESIDENT = 's-president'
const OWNER = 's-planningMember'
const OTHER = 's-planningHead'

const detail = async (t: SettlementKit, id: string, user = PRESIDENT) =>
  ((await (await t.api.get(`${t.base}/${id}`, user)).json()) as { event: EventDetail }).event
const post = (t: SettlementKit, path: string, body: unknown, user = PRESIDENT) =>
  t.api.post(`${t.base}/${path}`, body, user)
const errorOf = async (response: Response) => ((await response.json()) as { error: string }).error

// 참가비 입금이 있는 끝난 행사 하나와 그 수입이 들어갈 회계 기간
async function feeEvent(t: SettlementKit) {
  const { period } = await t.budgetOf()
  const event = await t.event()
  await t.deposit(await t.registration(await t.form(event)), {
    confirmedAt: new Date('2026-10-21T03:00:00Z'),
  })
  return { event, period }
}

const publish = (t: SettlementKit, periodId: string) =>
  t.make(t.council, 'account_closing', {
    fiscalPeriodId: periodId,
    publishedAt: new Date('2026-10-25T00:00:00Z'),
  })

test(
  '막힌 완료의 blockers 코드는 완료 쓰기가 내는 코드와 같고, 책임자와 다른 운영진은 403이다',
  withSettlement(async t => {
    const upcoming = await t.event({ startsAt: new Date('2026-11-01T00:00:00Z') })
    const pending = await t.event()
    await t.requestWithItem(pending)
    for (const id of [upcoming, pending]) {
      const code = (await detail(t, id)).blockers['event.complete']
      assert.ok(code)
      assert.equal(await errorOf(await post(t, `${id}/complete`, {})), code)
      for (const user of [OWNER, OTHER])
        assert.equal((await post(t, `${id}/complete`, {}, user)).status, 403)
    }
    assert.equal(
      await errorOf(await post(t, `${upcoming}/cancel-completion`, { reason: 'x' })),
      'EVENT_NOT_COMPLETED',
    )
  }),
)

test(
  '끝 시각이 없으면 시작한 날(한국) 23:59:59까지 진행 중이다: ±1초에서 blockers와 완료가 함께 바뀐다',
  withSettlement(async t => {
    // 한국 2026-10-25 00:30 시작, 끝 없음. 끝나는 때는 2026-10-25T14:59:59Z(한국 23:59:59)다.
    const id = await t.event({ startsAt: new Date('2026-10-24T15:30:00Z') })
    t.setNow(new Date('2026-10-25T14:59:59.999Z'))
    assert.deepEqual((await detail(t, id)).blockers, { 'event.complete': 'EVENT_NOT_ENDED' })
    assert.equal(await errorOf(await post(t, `${id}/complete`, {})), 'EVENT_NOT_ENDED')
    t.setNow(new Date('2026-10-25T15:00:00Z'))
    const after = await detail(t, id)
    assert.deepEqual([after.actions, after.blockers], [['event.update', 'event.complete'], {}])
    assert.equal((await post(t, `${id}/complete`, {})).status, 200)
  }),
)

test(
  '참가비 수입 기간: 기간이 없으면 NO_FISCAL_PERIOD이고, 완료한 뒤 그 기간을 공개하면 완료 취소가 PERIOD_CLOSED이다',
  withSettlement(async t => {
    const none = await t.event()
    await t.deposit(await t.registration(await t.form(none)), {
      confirmedAt: new Date('2026-10-21T03:00:00Z'),
    })
    assert.deepEqual((await detail(t, none)).blockers, { 'event.complete': 'NO_FISCAL_PERIOD' })
    assert.equal(await errorOf(await post(t, `${none}/complete`, {})), 'NO_FISCAL_PERIOD')

    const { event, period } = await feeEvent(t)
    const before = await detail(t, event)
    assert.deepEqual([before.actions, before.blockers], [['event.update', 'event.complete'], {}])
    assert.equal((await post(t, `${event}/complete`, {})).status, 200)
    const done = await detail(t, event)
    assert.deepEqual([done.actions, done.blockers], [['event.cancel_completion'], {}])
    await publish(t, period)
    const locked = await detail(t, event)
    assert.deepEqual(
      [locked.actions, locked.blockers],
      [[], { 'event.cancel_completion': 'PERIOD_CLOSED' }],
    )
    assert.equal(
      await errorOf(await post(t, `${event}/cancel-completion`, { reason: '되돌림' })),
      'PERIOD_CLOSED',
    )
    const asOwner = await detail(t, event, OWNER)
    assert.deepEqual([asOwner.actions, asOwner.blockers], [[], {}])
  }),
)

test(
  '수입이 들어갈 기간을 공개했으면 완료 전에도 완료 동작이 없고 PERIOD_CLOSED로 거절된다',
  withSettlement(async t => {
    const { event, period } = await feeEvent(t)
    await publish(t, period)
    assert.deepEqual((await detail(t, event)).blockers, { 'event.complete': 'PERIOD_CLOSED' })
    assert.equal(await errorOf(await post(t, `${event}/complete`, {})), 'PERIOD_CLOSED')
  }),
)

test(
  '정산 끝(settled)은 끝났거나 완료한 행사에서만 참이다: 예정·진행 중 행사는 남은 것이 0이어도 거짓',
  withSettlement(async t => {
    const upcoming = await t.event({ startsAt: new Date('2026-11-01T00:00:00Z') })
    const ended = await t.event()
    assert.equal((await t.settlement(upcoming)).settled, false)
    assert.equal((await t.settlement(ended)).settled, true)
    assert.equal(isSettled('upcoming', []), false)
    assert.equal(isSettled('ongoing', []), false)
    assert.equal(isSettled('tbd', []), false)
    assert.equal(isSettled('ended', []), true)
    assert.equal(isSettled('completed', []), true)
    assert.equal(isSettled('ended', [{ kind: 'pending_items', count: 1, targets: [] }]), false)
  }),
)

test(
  '다른 학생회 행사는 404이고, 책임자 정하기 길은 없다',
  withSettlement(async t => {
    const foreign = await t.event({}, t.other)
    assert.equal((await t.api.get(`${t.base}/${foreign}`, PRESIDENT)).status, 404)
    assert.equal((await post(t, `${foreign}/complete`, {})).status, 404)
    assert.equal((await post(t, `${foreign}/cancel-completion`, { reason: 'x' })).status, 404)
    assert.equal((await post(t, `${MISSING}/complete`, {})).status, 404)
    const own = await t.event()
    assert.equal((await post(t, `${own}/owner`, { ownerId: null })).status, 404)
  }),
)

test(
  '읽지 않은 사실은 막는 쪽이다: 고치기만 읽은 사실로 완료·완료 취소를 판정하면 허용이 나오지 않는다',
  withSettlement(async t => {
    const pending = await t.event()
    await t.requestWithItem(pending)
    const done = await t.event()
    await t.completion(done, 'completed', new Date('2026-10-24T03:00:00Z'))
    const { people, councilId } = t.council
    const actor = await actorOf(
      t.db,
      people.president.userId,
      councilId,
      new Date('2026-10-25T03:00:00Z'),
    )
    assert.ok(actor)
    const read = async (id: string) => {
      return factsOf(
        t.db,
        actor,
        { id, name: 'x', ownerId: null, startsAt: new Date('2026-10-24T00:00:00Z'), endsAt: null },
        { now: new Date('2026-10-25T03:00:00Z'), actions: ['event.update'] },
      )
    }
    assert.notEqual(decide(actor, await read(pending), 'event.complete'), null)
    assert.notEqual(decide(actor, await read(done), 'event.cancel_completion'), null)
  }),
)
