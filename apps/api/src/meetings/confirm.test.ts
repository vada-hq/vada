import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { MeetingResponse } from '@vada/contracts'
import { createRateLimiter } from '../http/rate-limit.js'
import { withSettlement, type SettlementKit } from '../test-support/settlement.js'
import { INPUT, NOW, open, errorOf } from './test-support/http.js'

const unlimited = () => createRateLimiter({ limit: 1000, windowMs: 10_000 })
const setup = (t: SettlementKit) =>
  open(t, { writeLimiter: unlimited(), notesLimiter: unlimited() })
async function confirmed(h: ReturnType<typeof open>) {
  const made = await h.create()
  const agenda = made.agenda[0]!
  assert.equal(
    (await h.post(`/${made.id}/agenda/${agenda.id}/decisions`, { content: '진행' })).status,
    201,
  )
  const response = await h.post(`/${made.id}/confirm`, {})
  assert.equal(response.status, 200, await response.clone().text())
  return ((await response.json()) as MeetingResponse).meeting
}

test(
  '확정은 살아 있는 회의·안건·결정만 같은 사람과 시각으로 채우고 판을 만들지 않는다',
  withSettlement(async t => {
    const h = setup(t)
    const made = await h.create({
      ...INPUT,
      attendeeIds: [t.council.people.plain.memberId],
      agenda: [{ title: '하나' }, { title: '둘' }, { title: '뺀 안건' }],
    })
    const [first, second, removed] = made.agenda
    const decision = await t.make(t.council, 'decision', {
      originId: first!.id,
      originKind: 'agenda_item',
      content: '결정',
      decidedBy: t.council.people.president.memberId,
      decidedAt: NOW,
    })
    const removedDecision = await t.make(t.council, 'decision', {
      originId: first!.id,
      originKind: 'agenda_item',
      content: '뺀 결정',
      decidedBy: t.council.people.president.memberId,
      decidedAt: NOW,
      cancelledAt: NOW,
    })
    const orphanDecision = await t.make(t.council, 'decision', {
      originId: removed!.id,
      originKind: 'agenda_item',
      content: '뺀 안건의 결정',
      decidedBy: t.council.people.president.memberId,
      decidedAt: NOW,
    })
    const task = await t.make(t.council, 'task', {
      title: '후속',
      originId: second!.id,
      originKind: 'agenda_item',
    })
    await t.pg.query('UPDATE agenda_item SET cancelled_at = $2 WHERE id = $1', [
      removed!.id,
      NOW.toISOString(),
    ])
    const foreign = await t.make(t.other, 'meeting', { title: INPUT.title, heldAt: NOW })
    const before = await t.pg.query(
      'SELECT record_id, version_no FROM record_version ORDER BY record_id, version_no',
    )
    const response = await h.post(`/${made.id}/confirm`, {})
    assert.equal(response.status, 200, await response.clone().text())
    const detail = ((await response.json()) as MeetingResponse).meeting
    assert.equal(detail.status, 'done')
    assert.equal(detail.minutesStatus, 'confirmed')
    assert.equal(detail.confirmedBy?.id, t.council.people.president.memberId)
    assert.equal(detail.confirmedBy?.name, 's president')
    assert.ok(detail.confirmedAt)
    const ids = [made.id, first!.id, second!.id, decision]
    const rows = await t.pg.query<{ id: string; at: string | null; by: string | null }>(
      'SELECT id, confirmed_at::text AS at, confirmed_by AS by FROM record WHERE id = ANY($1::uuid[])',
      [ids],
    )
    assert.equal(rows.rows.length, 4)
    assert.equal(new Set(rows.rows.map(row => row.at)).size, 1)
    for (const row of rows.rows) {
      assert.ok(row.at)
      assert.equal(row.by, t.council.people.president.memberId)
    }
    const untouched = await t.pg.query<{ at: string | null; by: string | null }>(
      'SELECT confirmed_at::text AS at, confirmed_by AS by FROM record WHERE id = ANY($1::uuid[])',
      [[removed!.id, removedDecision, orphanDecision, task, foreign]],
    )
    assert.equal(untouched.rows.length, 5)
    for (const row of untouched.rows) assert.deepEqual(row, { at: null, by: null })
    const after = await t.pg.query(
      'SELECT record_id, version_no FROM record_version ORDER BY record_id, version_no',
    )
    assert.deepEqual(after.rows, before.rows)
    for (const [user, actions] of [
      ['s-president', ['meeting.amend']],
      ['s-plain', []],
      ['s-financeMember', []],
    ] as const) {
      const read = await h.detail(made.id, user)
      assert.deepEqual(read.actions, actions)
      assert.equal(read.agenda[0]!.decisions[0]!.content, '결정')
      assert.equal(
        (await h.list('?view=mine', user)).meetings.some(m => m.id === made.id),
        false,
      )
    }
    const again = await h.post(`/${made.id}/confirm`, {})
    assert.equal(again.status, 409)
    assert.equal(await errorOf(again), 'RECORD_CONFIRMED')
  }),
)

test(
  '확정은 시작 전도 허용하고 참가자·부원·미인증·취소·다른 학생회를 거절한다',
  withSettlement(async t => {
    const h = setup(t)
    const made = await h.create({ ...INPUT, attendeeIds: [t.council.people.plain.memberId] })
    assert.ok(made.actions.includes('meeting.confirm'))
    assert.equal(made.actions.includes('meeting.amend'), false)
    assert.equal((await h.detail(made.id, 's-plain')).actions.includes('meeting.confirm'), false)
    for (const user of ['s-plain', 's-financeMember']) {
      const denied = await h.post(`/${made.id}/confirm`, {}, user)
      assert.equal(denied.status, 403)
      assert.equal(await errorOf(denied), 'FORBIDDEN')
    }
    assert.equal((await h.api.post(`${h.base}/${made.id}/confirm`, {})).status, 401)
    assert.equal((await h.post(`/${made.id}/confirm`, { extra: true })).status, 400)
    const foreign = await t.make(t.other, 'meeting', { title: INPUT.title, heldAt: NOW })
    assert.equal((await h.post(`/${foreign}/confirm`, {})).status, 404)
    assert.equal((await h.post(`/${made.id}/cancel`, { reason: '취소' })).status, 200)
    const cancelled = await h.post(`/${made.id}/confirm`, {})
    assert.equal(cancelled.status, 409)
    assert.equal(await errorOf(cancelled), 'MEETING_CANCELLED')
    const early = await h.create()
    assert.equal(early.status, 'scheduled')
    assert.equal((await h.post(`/${early.id}/confirm`, {})).status, 200)
  }),
)

test(
  '확정 뒤 안건·결정 고치기는 사유와 판을 확인하고 새 판에 사유를 남긴다',
  withSettlement(async t => {
    const h = setup(t)
    const made = await confirmed(h)
    const agenda = made.agenda[0]!
    const decision = agenda.decisions[0]!
    for (const [suffix, patch, id] of [
      [`/agenda/${agenda.id}`, { notes: '고친 논의' }, agenda.id],
      [`/decisions/${decision.id}`, { content: '고친 결정' }, decision.id],
    ] as const) {
      const before = await t.pg.query(
        'SELECT * FROM record_version WHERE record_id = $1 ORDER BY version_no',
        [id],
      )
      for (const reason of [undefined, '', '   ']) {
        const response = await h.post(`/${made.id}${suffix}`, {
          ...patch,
          baseVersionNo: 1,
          ...(reason === undefined ? {} : { reason }),
        })
        assert.equal(response.status, 400)
        assert.equal(await errorOf(response), 'REASON_REQUIRED')
      }
      const after = await t.pg.query(
        'SELECT * FROM record_version WHERE record_id = $1 ORDER BY version_no',
        [id],
      )
      assert.deepEqual(after.rows, before.rows)
      const saved = await h.post(`/${made.id}${suffix}`, {
        ...patch,
        baseVersionNo: 1,
        reason: '오기를 바로잡음',
      })
      assert.equal(saved.status, 200)
      const versions = await t.pg.query<{ reason: string; version_no: number }>(
        'SELECT reason, version_no FROM record_version WHERE record_id = $1 AND upper_inf(valid)',
        [id],
      )
      assert.deepEqual(versions.rows, [{ reason: '오기를 바로잡음', version_no: 2 }])
      const stale = await h.post(`/${made.id}${suffix}`, {
        ...patch,
        baseVersionNo: 1,
        reason: '낡은 판',
      })
      assert.equal(stale.status, 409)
      assert.equal(await errorOf(stale), 'VERSION_CONFLICT')
    }
    const current = await h.detail(made.id)
    assert.equal(current.agenda[0]!.notes, '고친 논의')
    assert.equal(current.agenda[0]!.decisions[0]!.content, '고친 결정')
  }),
)

test(
  '확정 뒤 참가자는 고치지 못하고 안건·결정 추가와 빼기·정보·참가자·취소·후속 업무는 막힌다',
  withSettlement(async t => {
    const h = setup(t)
    const made = await h.create({ ...INPUT, attendeeIds: [t.council.people.plain.memberId] })
    const agenda = made.agenda[0]!
    await h.post(`/${made.id}/agenda/${agenda.id}/decisions`, { content: '결정' })
    const detail = await h.detail(made.id)
    const decision = detail.agenda[0]!.decisions[0]!
    assert.equal((await h.post(`/${made.id}/confirm`, {})).status, 200)
    for (const [suffix, body] of [
      [`/agenda/${agenda.id}`, { notes: '글', baseVersionNo: 1, reason: '사유' }],
      [`/decisions/${decision.id}`, { content: '글', baseVersionNo: 1, reason: '사유' }],
    ] as const)
      assert.equal((await h.post(`/${made.id}${suffix}`, body, 's-plain')).status, 403)
    for (const [suffix, body] of [
      ['/agenda', { title: '추가' }],
      [`/agenda/${agenda.id}/cancel`, {}],
      [`/agenda/${agenda.id}/decisions`, { content: '추가' }],
      [`/decisions/${decision.id}/cancel`, {}],
      ['', { title: '정보', baseVersionNo: 1 }],
      ['/attendees', { attendeeIds: [] }],
      ['/cancel', { reason: '취소' }],
    ] as const) {
      const response = await h.post(`/${made.id}${suffix}`, body)
      assert.equal(response.status, 409, suffix)
      assert.equal(await errorOf(response), 'RECORD_CONFIRMED')
    }
    const task = await t.api.post(
      `/api/organizations/${t.council.councilId}/tasks`,
      { title: '후속', agendaItemId: agenda.id },
      's-president',
    )
    assert.equal(task.status, 409)
    assert.equal(await errorOf(task), 'RECORD_CONFIRMED')
  }),
)

test(
  '확정 전 저장은 사유가 없어도 되고 보내온 사유는 판에 남기지 않는다',
  withSettlement(async t => {
    const h = setup(t)
    const made = await h.create()
    const path = `/${made.id}/agenda/${made.agenda[0]!.id}`
    assert.equal((await h.post(path, { notes: '초안', baseVersionNo: 1 })).status, 200)
    assert.equal(
      (await h.post(path, { notes: '다음', baseVersionNo: 2, reason: '무시' })).status,
      200,
    )
    const versions = await t.pg.query<{ reason: string | null }>(
      'SELECT reason FROM record_version WHERE record_id = $1',
      [made.agenda[0]!.id],
    )
    assert.ok(versions.rows.every(row => row.reason === null))
  }),
)

test(
  '확정 뒤 고치기 주소도 사유 상한·문자·모르는 키를 쓰기 전에 거절한다',
  withSettlement(async t => {
    const h = setup(t)
    const made = await confirmed(h)
    const agenda = made.agenda[0]!
    for (const suffix of [`/agenda/${agenda.id}`, `/decisions/${agenda.decisions[0]!.id}`]) {
      for (const reason of ['x'.repeat(201), '😀'.repeat(201), '\u0000', '\uD800'])
        assert.equal(
          (await h.post(`/${made.id}${suffix}`, { baseVersionNo: 1, reason })).status,
          400,
        )
      assert.equal(
        (await h.post(`/${made.id}${suffix}`, { baseVersionNo: 1, reason: '사유', extra: true }))
          .status,
        400,
      )
    }
    assert.equal((await h.detail(made.id)).agenda[0]!.versionNo, 1)
  }),
)

test(
  '확정은 회의 잠금 뒤 record를 한 문장으로 쓰고 상세 쿼리는 안건 수와 무관하다',
  withSettlement(async t => {
    const h = setup(t)
    const made = await h.create()
    const queries: string[] = []
    const db = t.drizzle({
      logger: {
        logQuery: query => {
          queries.push(query)
        },
      },
    })
    const { createApp } = await import('../app.js')
    const { caller, ORIGIN, testSession } = await import('../test-support/http.js')
    const { createMeetingRoutes } = await import('./routes.js')
    const api = caller(
      createApp({
        auth: { handler: async () => new Response() },
        trustedOrigin: ORIGIN,
        meetings: createMeetingRoutes(db, testSession, { clock: () => NOW }),
      }),
    )
    assert.equal((await api.post(`${h.base}/${made.id}/confirm`, {}, 's-president')).status, 200)
    const lock = queries.findIndex(query => query.includes('for no key update of "meeting"'))
    const updates = queries.filter(query => /UPDATE record SET confirmed_by/i.test(query))
    assert.equal(updates.length, 1)
    assert.ok(lock >= 0)
    assert.ok(queries.indexOf(updates[0]!) > lock)
    assert.equal((updates[0]!.match(/clock_timestamp\(\)/g) ?? []).length, 1)
    assert.ok(updates[0]!.includes('record.council_id'))
    const { actorOf } = await import('../access/actor.js')
    const { meetingDetailOf } = await import('./queries.js')
    const actor = (await actorOf(db, 's-president', t.council.councilId, NOW))!
    queries.length = 0
    await db.transaction(tx => meetingDetailOf(tx, actor, made.id, NOW))
    const one = queries.filter(query => /^select/i.test(query)).length
    const many = await h.create({
      ...INPUT,
      agenda: Array.from({ length: 10 }, (_, i) => ({ title: `안건 ${i}` })),
    })
    assert.equal((await h.post(`/${many.id}/confirm`, {})).status, 200)
    queries.length = 0
    await db.transaction(tx => meetingDetailOf(tx, actor, many.id, NOW))
    assert.equal(queries.filter(query => /^select/i.test(query)).length, one)
  }),
)

test(
  '확정과 안건·결정·후속 업무 만들기가 겹쳐도 확정 전에 끝난 기록만 포함한다',
  withSettlement(async t => {
    const h = setup(t)
    for (const kind of ['agenda', 'decision', 'task']) {
      const made = await h.create()
      const agenda = made.agenda[0]!
      const writing =
        kind === 'agenda'
          ? h.post(`/${made.id}/agenda`, { title: '동시 안건' })
          : kind === 'decision'
            ? h.post(`/${made.id}/agenda/${agenda.id}/decisions`, { content: '동시 결정' })
            : t.api.post(
                `/api/organizations/${t.council.councilId}/tasks`,
                { title: '동시 후속', agendaItemId: agenda.id },
                's-president',
              )
      const [created, response] = await Promise.all([writing, h.post(`/${made.id}/confirm`, {})])
      assert.equal(response.status, 200)
      assert.ok([201, 409].includes(created.status))
      if (created.status === 409) assert.equal(await errorOf(created), 'RECORD_CONFIRMED')
      const detail = await h.detail(made.id)
      const ids = [
        detail.id,
        ...detail.agenda.map(item => item.id),
        ...detail.agenda.flatMap(item => item.decisions.map(d => d.id)),
      ]
      const records = await t.pg.query<{ at: string | null }>(
        'SELECT confirmed_at::text AS at FROM record WHERE id = ANY($1::uuid[])',
        [ids],
      )
      assert.equal(new Set(records.rows.map(row => row.at)).size, 1)
      assert.ok(records.rows.every(row => row.at !== null))
      const tasks = detail.agenda.flatMap(item => item.followUps)
      for (const task of tasks) {
        const [record] = (
          await t.pg.query<{ at: string | null }>(
            'SELECT confirmed_at::text AS at FROM record WHERE id = $1',
            [task.id],
          )
        ).rows
        assert.equal(record!.at, null)
      }
    }
  }),
)

test(
  '동시에 두 번 확정하면 잠금 뒤 다시 읽어 한 번만 성공한다',
  withSettlement(async t => {
    const h = setup(t)
    const made = await h.create()
    const responses = await Promise.all([
      h.post(`/${made.id}/confirm`, {}),
      h.post(`/${made.id}/confirm`, {}, 's-vicePresident'),
    ])
    assert.deepEqual(
      responses.map(r => r.status).sort((a, b) => a - b),
      [200, 409],
    )
    assert.equal(await errorOf(responses.find(r => r.status === 409)!), 'RECORD_CONFIRMED')
  }),
)
