import assert from 'node:assert/strict'
import { test } from 'node:test'
import { drizzle } from 'drizzle-orm/pglite'
import { EVENT_LIST_LIMIT } from '@vada/contracts'
import { actorOf } from '../access/actor.js'
import { clockNow, createRecord } from '../records/records.js'
import { NOON } from '../test-support/events.js'
import { withSettlement } from '../test-support/settlement.js'
import { eventCardsOf } from './cards.js'

test(
  '카드 목록의 쿼리 수는 행사 하나와 200개에서 같다',
  withSettlement(async t => {
    const actor = (await actorOf(t.db, 's-president', t.council.councilId, NOON))!
    const queries: string[] = []
    const db = drizzle(t.pg, { logger: { logQuery: query => void queries.push(query) } })
    const first = await t.event()
    assert.equal((await eventCardsOf(db, actor, NOON)).events[0]?.id, first)
    const singleCount = queries.length
    await t.db.transaction(async tx => {
      for (let i = 1; i < EVENT_LIST_LIMIT; i++)
        await createRecord(tx, {
          kind: 'event',
          councilId: t.council.councilId,
          actor: actor.memberId,
          values: { name: `행사 ${i}` },
        })
    })
    queries.length = 0
    assert.equal((await eventCardsOf(db, actor, NOON)).events.length, EVENT_LIST_LIMIT)
    assert.equal(queries.length, singleCount)
  }),
)

test(
  '여러 카드의 셈은 단건 정산과 같고 취소·마지막 결재·학생회 경계를 지킨다',
  withSettlement(async t => {
    const first = await t.event({ name: '첫 행사' })
    const second = await t.event({ name: '둘째 행사' })
    const empty = await t.event({ name: '빈 행사' })
    const pending = await t.requestWithItem(first)
    await t.make(t.council, 'line_item', {
      requestId: pending.request,
      name: '둘째 품목',
      quantity: 1,
    })
    const unpaid = await t.requestWithItem(first)
    await t.approve(unpaid.line)
    await t.pay(await t.expense({ eventId: first, cancelledAt: clockNow }), unpaid.line)
    await t.expense({
      eventId: first,
      reason: null,
      paidBy: t.council.people.planningMember.memberId,
    })
    const form = await t.form(first)
    await t.deposit(await t.registration(form, { cancelledAt: clockNow }))
    await t.deposit(await t.registration(form))
    await t.deposit(await t.registration(form, { cancelledAt: clockNow }), {
      cancelledAt: clockNow,
    })
    await t.deposit(await t.registration(form, { cancelledAt: clockNow }), {
      refundedAt: clockNow,
      refundAmount: '5000',
    })

    const restored = await t.requestWithItem(second)
    await t.approve(restored.line, 'rejected')
    await t.pg.query('UPDATE approval SET acted_at = $1 WHERE target_id = $2', [
      new Date('2026-10-01T00:00:00Z'),
      restored.line,
    ])
    await t.approve(restored.line)
    const paid = await t.expense({ eventId: second })
    await t.evidence(paid)
    await t.pay(paid, restored.line)
    await t.requestWithItem(second)
    const blankReason = await t.expense({
      eventId: second,
      paidBy: t.council.people.planningMember.memberId,
      reimbursedAt: clockNow,
    })
    await t.pg.query("UPDATE expense SET reason = '  ' WHERE id = $1", [blankReason])
    await t.evidence(blankReason)
    for (const outcome of ['rejected', 'cancelled'] as const) {
      const ignored = await t.requestWithItem(second)
      await t.approve(ignored.line, outcome)
    }
    await t.requestWithItem(second, { cancelledAt: clockNow })
    await t.requestWithItem(null)
    await t.expense({ reason: null })

    // 결재 대기·지출·환불 대기 모두 다른 학생회에서 같은 행사로 연결해 경계를 검증한다.
    const foreign = await t.event({}, t.other)
    const foreignRequest = await t.requestWithItem(foreign, {}, t.other)
    const foreignExpense = await t.expense({ eventId: foreign, reason: null }, t.other)
    const foreignForm = await t.form(foreign, t.other)
    const foreignRegistration = await t.registration(
      foreignForm,
      { cancelledAt: clockNow },
      t.other,
    )
    await t.make(t.other, 'deposit', {
      registrationId: foreignRegistration,
      amount: '5000',
      confirmedAt: clockNow,
    })
    await t.pg.query('UPDATE request SET event_id = $1 WHERE id = $2', [
      first,
      foreignRequest.request,
    ])
    await t.pg.query('UPDATE expense SET event_id = $1 WHERE id = $2', [first, foreignExpense])
    await t.pg.query('UPDATE registration_form SET event_id = $1 WHERE id = $2', [
      first,
      foreignForm,
    ])

    const actor = (await actorOf(t.db, 's-president', t.council.councilId, NOON))!
    const cards = (await eventCardsOf(t.db, actor, NOON)).events
    assert.equal(cards.length, 3)
    for (const [id, expected] of [
      [first, 7],
      [second, 2],
      [empty, 0],
    ] as const) {
      const settlement = await t.settlement(id)
      assert.equal(cards.find(card => card.id === id)?.remaining, expected)
      assert.equal(
        cards.find(card => card.id === id)?.remaining,
        settlement.remaining.reduce((sum, item) => sum + item.count, 0),
      )
    }
  }),
)

test(
  '행사가 없으면 카드 집계를 읽지 않는다',
  withSettlement(async t => {
    const actor = (await actorOf(t.db, 's-president', t.council.councilId, NOON))!
    const queries: string[] = []
    const db = drizzle(t.pg, { logger: { logQuery: query => void queries.push(query) } })
    assert.deepEqual(await eventCardsOf(db, actor, NOON), { events: [], truncated: false })
    assert.equal(
      queries.some(query => /from "(?:expense|line_item|registration)"/.test(query)),
      false,
    )
  }),
)
