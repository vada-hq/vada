import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { MeetingDetail, MeetingResponse } from '@vada/contracts'
import { createApp } from '../app.js'
import { createRateLimiter } from '../http/rate-limit.js'
import { caller, ORIGIN, testSession } from '../test-support/http.js'
import { withSettlement, type SettlementKit } from '../test-support/settlement.js'
import { createMeetingRoutes } from './routes.js'
import { INPUT, NOW, open, errorOf } from './test-support/http.js'

const unlimited = () => createRateLimiter({ limit: 1000, windowMs: 10_000 })
const openMinutes = (t: SettlementKit) =>
  open(t, { writeLimiter: unlimited(), notesLimiter: unlimited() })
function writes(meeting: MeetingDetail) {
  const agenda = meeting.agenda[0]!
  const decision = agenda.decisions[0]!
  return [
    [`/${meeting.id}/agenda`, { title: '추가' }],
    [`/${meeting.id}/agenda/${agenda.id}`, { notes: '내용', baseVersionNo: agenda.versionNo }],
    [`/${meeting.id}/agenda/${agenda.id}/cancel`, {}],
    [`/${meeting.id}/agenda/${agenda.id}/decisions`, { content: '새 결정' }],
    [
      `/${meeting.id}/decisions/${decision.id}`,
      { content: '결정 수정', baseVersionNo: decision.versionNo },
    ],
    [`/${meeting.id}/decisions/${decision.id}/cancel`, {}],
  ] as const
}
async function decided(h: ReturnType<typeof open>, value: object = INPUT) {
  const made = await h.create(value)
  assert.equal(
    (await h.post(`/${made.id}/agenda/${made.agenda[0]!.id}/decisions`, { content: '결정' }))
      .status,
    201,
  )
  return h.detail(made.id)
}

test(
  '참가자 아닌 부원은 여섯 쓰기 모두 403이지만 논의와 결정을 전부 읽는다',
  withSettlement(async t => {
    const h = openMinutes(t)
    const made = await decided(h)
    assert.equal(
      (
        await h.post(`/${made.id}/agenda/${made.agenda[0]!.id}`, {
          notes: '모두 읽는 글',
          baseVersionNo: 1,
        })
      ).status,
      200,
    )
    for (const [path, body] of writes(made)) {
      const denied = await h.post(path, body, 's-plain')
      assert.equal(denied.status, 403, path)
      assert.equal(await errorOf(denied), 'FORBIDDEN')
      assert.equal((await h.api.post(`${h.base}${path}`, body)).status, 401)
    }
    const read = await h.detail(made.id, 's-plain')
    assert.deepEqual(read.actions, [])
    assert.equal(read.agenda[0]!.notes, '모두 읽는 글')
    assert.equal(read.agenda[0]!.decisions[0]!.content, '결정')
  }),
)

test(
  '만든 사람과 참가하지 않은 주관 부서장은 쓴다',
  withSettlement(async t => {
    const h = openMinutes(t)
    const made = await h.create({ ...INPUT, hostDepartmentId: t.council.departments.planning })
    for (const user of ['s-president', 's-vicePresident', 's-planningHead', 's-planningViceHead'])
      assert.equal((await h.post(`/${made.id}/agenda`, { title: user }, user)).status, 201)
    const own = await h.create(INPUT, 's-planningHead')
    await t.pg.query('DELETE FROM meeting_attendee WHERE meeting_id = $1', [own.id])
    assert.equal(
      (await h.post(`/${own.id}/agenda`, { title: '만든 사람' }, 's-planningHead')).status,
      201,
    )
  }),
)

test(
  '다른 학생회 회의와 다른 회의의 안건·결정은 모든 주소에서 404다',
  withSettlement(async t => {
    const h = openMinutes(t)
    const own = await decided(h)
    const another = await decided(h)
    for (const [path, body] of writes(another).slice(1))
      assert.equal((await h.post(path.replace(another.id, own.id), body)).status, 404, path)
    const foreignId = await t.make(t.other, 'meeting', { title: '바깥', heldAt: NOW })
    for (const [path, body] of writes(own))
      assert.equal((await h.post(path.replace(own.id, foreignId), body)).status, 404, path)
    const foreignAgenda = await t.make(t.other, 'agenda_item', {
      meetingId: foreignId,
      position: 1,
      title: '바깥 안건',
    })
    const foreignDecision = await t.make(t.other, 'decision', {
      originId: foreignAgenda,
      originKind: 'agenda_item',
      content: '바깥 결정',
      decidedBy: t.other.people.president.memberId,
      decidedAt: NOW,
    })
    for (const [path, body] of writes(own).slice(1)) {
      const crossed = path
        .replace(own.agenda[0]!.id, foreignAgenda)
        .replace(own.agenda[0]!.decisions[0]!.id, foreignDecision)
      assert.equal((await h.post(crossed, body)).status, 404, crossed)
    }
  }),
)

test(
  '취소·확정·그만두기 중에는 모든 쓰기를 409로 막는다',
  withSettlement(async t => {
    const h = openMinutes(t)
    const cancelled = await decided(h)
    const confirmed = await decided(h)
    const closing = await decided(h)
    assert.equal((await h.post(`/${cancelled.id}/cancel`, { reason: '취소' })).status, 200)
    await t.pg.query(
      'UPDATE record SET confirmed_at = $2, confirmed_by = created_by WHERE id = $1',
      [confirmed.id, NOW.toISOString()],
    )
    assert.equal((await h.detail(confirmed.id)).actions.includes('meeting.minutes'), false)
    for (const [meeting, error] of [
      [cancelled, 'MEETING_CANCELLED'],
      [confirmed, 'RECORD_CONFIRMED'],
    ] as const)
      for (const [path, body] of writes(meeting)) {
        const response = await h.post(path, body)
        assert.equal(response.status, 409, path)
        assert.equal(await errorOf(response), error)
      }
    await t.pg.query('UPDATE council SET closing_requested_at = $2 WHERE id = $1', [
      t.council.councilId,
      NOW.toISOString(),
    ])
    for (const [path, body] of writes(closing)) {
      const response = await h.post(path, body)
      assert.equal(response.status, 409, path)
      assert.equal(await errorOf(response), 'COUNCIL_CLOSING')
    }
  }),
)

test(
  '논의 저장 한도는 다른 회의 쓰기 한도와 따로, 사람별로 건다',
  withSettlement(async t => {
    const initial = openMinutes(t)
    const made = await initial.create({ ...INPUT, attendeeIds: [t.council.people.plain.memberId] })
    const h = open(t, {
      writeLimiter: createRateLimiter({ limit: 1, windowMs: 10_000 }),
      notesLimiter: createRateLimiter({ limit: 1, windowMs: 10_000 }),
    })
    const path = `/${made.id}/agenda/${made.agenda[0]!.id}`
    assert.equal((await h.post(path, { notes: '첫 글', baseVersionNo: 1 })).status, 200)
    const limited = await h.post(path, { notes: '다음', baseVersionNo: 2 })
    assert.equal(limited.status, 429)
    assert.equal(await errorOf(limited), 'TOO_MANY_REQUESTS')
    assert.equal(
      (await h.post(path, { notes: '참가자 글', baseVersionNo: 2 }, 's-plain')).status,
      200,
    )
    assert.equal((await h.post(`/${made.id}/agenda`, { title: '안건' })).status, 201)
    assert.equal((await h.post(`/${made.id}/agenda`, { title: '한도' })).status, 429)
  }),
)

test(
  '회의·대상 행 잠금과 판 비교·쓰기는 한 거래 안에서 순서를 지킨다',
  withSettlement(async t => {
    const h = openMinutes(t)
    const made = await decided(h)
    const queries: string[] = []
    const db = t.drizzle({
      logger: {
        logQuery: query => {
          queries.push(query)
        },
      },
    })
    const api = caller(
      createApp({
        auth: { handler: async () => new Response() },
        trustedOrigin: ORIGIN,
        meetings: createMeetingRoutes(db, testSession, { clock: () => NOW }),
      }),
    )
    for (const [path, body] of [writes(made)[1], writes(made)[4]]) {
      queries.length = 0
      const response = await api.post(`${h.base}${path}`, body, 's-president')
      assert.equal(response.status, 200)
      const meetingLock = queries.findIndex(
        q => q.includes('from "meeting"') && q.includes('for no key update'),
      )
      const targetTable = path.includes('/decisions/') ? 'decision' : 'agenda_item'
      const targetLock = queries.findIndex(
        q => q.includes(`from "${targetTable}"`) && q.includes('for no key update'),
      )
      const version = queries.findIndex(q => q.includes('from "record_version"'))
      const write = queries.findIndex(q => q.startsWith(`update "${targetTable}"`))
      assert.ok(
        meetingLock > 0 && targetLock > meetingLock && version > targetLock && write > version,
      )
      const data = (await response.json()) as MeetingResponse
      assert.ok(data.meeting.agenda[0]!.versionNo >= 1)
    }
  }),
)
