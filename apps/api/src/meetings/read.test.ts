import assert from 'node:assert/strict'
import { test } from 'node:test'
import { MEETING_LIST_LIMIT } from '@vada/contracts'
import { withSettlement } from '../test-support/settlement.js'
import { INPUT, NOW, open } from './test-support/http.js'

test(
  '모든 운영진은 목록·상세를 보고 권한에 따라 같은 actions를 받는다',
  withSettlement(async t => {
    const h = open(t)
    const made = await h.create({
      ...INPUT,
      hostDepartmentId: t.council.departments.planning,
      attendeeIds: [t.council.people.planningMember.memberId],
    })
    for (const [user, actions] of [
      ['s-president', ['meeting.edit', 'meeting.cancel', 'meeting.write']],
      ['s-vicePresident', ['meeting.edit', 'meeting.cancel', 'meeting.write']],
      ['s-planningHead', ['meeting.edit', 'meeting.cancel', 'meeting.write']],
      ['s-planningViceHead', ['meeting.edit', 'meeting.cancel', 'meeting.write']],
      ['s-planningMember', ['meeting.write']],
      ['s-financeMember', []],
      ['s-plain', []],
    ] as const) {
      assert.deepEqual((await h.detail(made.id, user)).actions, actions, user)
      assert.deepEqual((await h.list('', user)).meetings[0]!.actions, actions, user)
    }
    assert.equal((await h.api.get(h.base)).status, 401)
    assert.equal((await h.get('', 'o-president')).status, 403)
    const own = await h.create(INPUT, 's-planningHead')
    assert.equal((await h.detail(own.id, 's-planningHead')).relation, 'manager')
    assert.deepEqual((await h.detail(own.id, 's-planningViceHead')).actions, [])
  }),
)

test(
  '쓰기 잠금은 학생회 확인 뒤, 회의 판과 상태 확인보다 먼저다',
  withSettlement(async t => {
    const h = open(t)
    const made = await h.create()
    const queries: string[] = []
    const db = t.drizzle({
      logger: {
        logQuery: query => {
          queries.push(query)
        },
      },
    })
    const { createMeetingRoutes } = await import('./routes.js')
    const { createApp } = await import('../app.js')
    const { caller, ORIGIN, testSession } = await import('../test-support/http.js')
    const api = caller(
      createApp({
        auth: { handler: async () => new Response() },
        trustedOrigin: ORIGIN,
        meetings: createMeetingRoutes(db, testSession, { clock: () => NOW }),
      }),
    )
    assert.equal(
      (await api.post(`${h.base}/${made.id}`, { baseVersionNo: 1, title: '변경' }, 's-president'))
        .status,
      200,
    )
    const councilLock = queries.findIndex(
      query => query.includes('"council"') && query.includes('for no key update'),
    )
    const meetingLock = queries.findIndex(
      query => query.includes('"meeting"') && query.includes('for no key update'),
    )
    const version = queries.findIndex(query => query.includes('from "record_version"'))
    assert.ok(councilLock >= 0)
    assert.ok(meetingLock > councilLock)
    assert.ok(version > meetingLock)
    assert.ok(queries[meetingLock]!.includes('"council_id"'))
  }),
)

test(
  '주입 시계의 시작·끝 경계, 취소·확정 우선과 한국 자정 범위를 지킨다',
  withSettlement(async t => {
    const h = open(t)
    const made = await h.create()
    for (const [at, status] of [
      ['2026-10-29T04:59:59Z', 'scheduled'],
      ['2026-10-29T05:00:00Z', 'in_progress'],
      ['2026-10-29T05:59:59Z', 'in_progress'],
      ['2026-10-29T06:00:00Z', 'wrapping_up'],
    ] as const) {
      h.setNow(new Date(at))
      assert.equal((await h.list()).meetings[0]!.status, status)
    }
    h.setNow(NOW)
    const before = await h.create({
      ...INPUT,
      heldAt: '2026-10-28T23:59',
      endsAt: '2026-10-29T00:10',
    })
    const midnight = await h.create({
      ...INPUT,
      heldAt: '2026-10-29T00:00',
      endsAt: '2026-10-29T00:10',
    })
    await h.create({ ...INPUT, heldAt: '2026-10-30T00:00', endsAt: '2026-10-30T00:10' })
    assert.deepEqual(
      new Set((await h.list('?from=2026-10-29&to=2026-10-29')).meetings.map(row => row.id)),
      new Set([made.id, midnight.id]),
    )
    assert.deepEqual(
      (await h.list('?from=2026-10-28&to=2026-10-28')).meetings.map(row => row.id),
      [before.id],
    )
    await t.pg.query(
      'UPDATE record SET confirmed_at = $2, confirmed_by = created_by WHERE id = $1',
      [made.id, NOW.toISOString()],
    )
    assert.equal((await h.detail(made.id)).status, 'done')
    await t.pg.query('UPDATE meeting SET cancelled_at = $2, cancel_reason = $3 WHERE id = $1', [
      made.id,
      NOW.toISOString(),
      '취소',
    ])
    assert.equal((await h.detail(made.id)).status, 'cancelled')
    const legacy = await t.make(t.council, 'meeting', {
      title: '옛 회의',
      heldAt: new Date('2026-10-28T00:00:00Z'),
    })
    const detail = await h.detail(legacy)
    assert.equal(detail.endsAt, null)
    assert.equal(detail.place, null)
  }),
)

test(
  '내 회의는 참가자·만든 사람·주관 부서장·회장단이며 완료·취소만 뺀다',
  withSettlement(async t => {
    const h = open(t)
    const attended = await h.create({ ...INPUT, attendeeIds: [t.council.people.plain.memberId] })
    const hosted = await h.create({ ...INPUT, hostDepartmentId: t.council.departments.planning })
    const created = await h.create(INPUT, 's-planningHead')
    const wrapping = await h.create({
      ...INPUT,
      attendeeIds: [t.council.people.plain.memberId],
      heldAt: '2026-10-28T14:00',
      endsAt: '2026-10-28T15:00',
    })
    const done = await h.create({ ...INPUT, attendeeIds: [t.council.people.plain.memberId] })
    await t.pg.query(
      'UPDATE record SET confirmed_at = $2, confirmed_by = created_by WHERE id = $1',
      [done.id, NOW.toISOString()],
    )
    const cancelled = await h.create({ ...INPUT, attendeeIds: [t.council.people.plain.memberId] })
    await h.post(`/${cancelled.id}/cancel`, { reason: '취소' })
    for (const [user, expected] of [
      ['s-plain', [attended.id, wrapping.id]],
      ['s-planningHead', [hosted.id, created.id]],
      ['s-planningViceHead', [hosted.id]],
      ['s-president', [attended.id, hosted.id, created.id, wrapping.id]],
    ] as const)
      assert.deepEqual(
        new Set((await h.list('?view=mine', user)).meetings.map(row => row.id)),
        new Set(expected),
        user,
      )
  }),
)

test(
  '집계는 살아 있는 안건·참가자·논의 내용을 세고 event 필터는 학생회를 지킨다',
  withSettlement(async t => {
    const h = open(t)
    const eventId = await t.event()
    const made = await h.create({
      ...INPUT,
      eventId,
      attendeeIds: [t.council.people.plain.memberId],
      agenda: [{ title: '살림' }, { title: '빼기' }],
    })
    await t.pg.query('UPDATE agenda_item SET cancelled_at = $2 WHERE id = $1', [
      made.agenda[1]!.id,
      NOW.toISOString(),
    ])
    let row = (await h.list(`?event=${eventId}`, 's-plain')).meetings[0]!
    assert.equal(row.attendeeCount, 2)
    assert.equal(row.agendaCount, 1)
    assert.equal(row.minutesStatus, 'none')
    assert.equal(row.relation, 'attendee')
    await t.pg.query('UPDATE agenda_item SET notes = $2 WHERE id = $1', [
      made.agenda[0]!.id,
      '논의',
    ])
    row = (await h.list(`?event=${eventId}`)).meetings[0]!
    assert.equal(row.minutesStatus, 'draft')
    assert.equal((await h.get(`?event=${await t.event({}, t.other)}`)).status, 404)
    assert.equal((await h.get(`/options?event=${await t.event({}, t.other)}`)).status, 404)
    for (const query of [
      '?view=mine&view=council',
      '?extra=x',
      '?from=2026-02-30',
      '?from=2026-10-30&to=2026-10-29',
    ])
      assert.equal((await h.get(query)).status, 400)
  }),
)

test(
  '상한은 SQL에서 내 회의를 거른 뒤 적용하고 쿼리 수는 회의 수와 무관하다',
  withSettlement(async t => {
    const h = open(t)
    const attended = await h.create({ ...INPUT, attendeeIds: [t.council.people.plain.memberId] })
    await t.pg.query(
      `WITH made AS (
    INSERT INTO record (kind, council_id, created_by)
    SELECT 'meeting', $1::uuid, $2::uuid FROM generate_series(1, $3::int) RETURNING id
  ) INSERT INTO meeting (id, title, held_at) SELECT id, '상한 시험', $4::timestamptz FROM made`,
      [
        t.council.councilId,
        t.council.people.president.memberId,
        MEETING_LIST_LIMIT + 1,
        NOW.toISOString(),
      ],
    )
    const all = await h.list()
    assert.equal(all.meetings.length, MEETING_LIST_LIMIT)
    assert.equal(all.truncated, true)
    const mine = await h.list('?view=mine', 's-plain')
    assert.equal(mine.truncated, false)
    assert.deepEqual(
      mine.meetings.map(row => row.id),
      [attended.id],
    )
    const queries: string[] = []
    const db = t.drizzle({
      logger: {
        logQuery: query => {
          queries.push(query)
        },
      },
    })
    const { meetingListOf } = await import('./queries.js')
    const { actorOf } = await import('../access/actor.js')
    const actor = (await actorOf(db, 's-president', t.council.councilId, NOW))!
    queries.length = 0
    await db.transaction(tx => meetingListOf(tx, actor, { view: 'council' }, NOW))
    assert.ok(queries.filter(query => /^select/i.test(query)).length <= 2, queries.join('\n'))
  }),
)
