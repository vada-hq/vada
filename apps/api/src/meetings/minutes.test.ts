import assert from 'node:assert/strict'
import { test } from 'node:test'
import { dateFromKorean, MeetingNotesSchema, type MeetingResponse } from '@vada/contracts'
import { createRateLimiter } from '../http/rate-limit.js'
import { withSettlement } from '../test-support/settlement.js'
import { INPUT, NOW, open, errorOf } from './test-support/http.js'

test(
  '안건을 끝에 더하고 빼도 자리를 보존하며 살아 있는 안건 30개만 받는다',
  withSettlement(async t => {
    const h = open(t, { writeLimiter: createRateLimiter({ limit: 1000, windowMs: 10_000 }) })
    const made = await h.create({ ...INPUT, agenda: [{ title: '하나' }, { title: '둘' }] })
    const path = `/${made.id}/agenda`
    assert.equal((await h.post(`${path}/${made.agenda[0]!.id}/cancel`, {})).status, 200)
    assert.equal((await h.post(path, { title: '셋' })).status, 201)
    assert.deepEqual(
      (await h.detail(made.id)).agenda.map(a => a.position),
      [2, 3],
    )
    assert.equal(
      (await h.post(`${path}/${made.agenda[0]!.id}`, { notes: '글', baseVersionNo: 1 })).status,
      404,
    )
    for (let n = 0; n < 28; n++)
      assert.equal((await h.post(path, { title: `안건 ${n}` })).status, 201)
    assert.equal((await h.post(path, { title: '31번째' })).status, 400)
  }),
)

test(
  '논의는 공백을 보존하고 빈 글만 null로 쓰며 충돌·같은 값은 판을 늘리지 않는다',
  withSettlement(async t => {
    const h = open(t)
    const made = await h.create({ ...INPUT, attendeeIds: [t.council.people.plain.memberId] })
    const agenda = made.agenda[0]!
    const path = `/${made.id}/agenda/${agenda.id}`
    const save = await h.post(path, { notes: '  논의\n다음 줄  ', baseVersionNo: 1 }, 's-plain')
    assert.equal(save.status, 200)
    const saved = ((await save.json()) as MeetingResponse).meeting.agenda[0]!
    assert.equal(saved.notes, '  논의\n다음 줄  ')
    assert.equal(saved.versionNo, 2)
    assert.equal(saved.updatedBy?.id, t.council.people.plain.memberId)
    assert.ok(Number.isFinite(Date.parse(saved.updatedAt)))
    const before = await t.pg.query(
      'SELECT * FROM record_version WHERE record_id = $1 ORDER BY version_no',
      [agenda.id],
    )
    const stale = await h.post(path, { notes: '지우지 말 것', baseVersionNo: 1 })
    assert.equal(stale.status, 409)
    assert.deepEqual(await stale.json(), { error: 'VERSION_CONFLICT' })
    const after = await t.pg.query(
      'SELECT * FROM record_version WHERE record_id = $1 ORDER BY version_no',
      [agenda.id],
    )
    assert.deepEqual(after.rows, before.rows)
    assert.equal((await h.detail(made.id)).agenda[0]!.notes, saved.notes)
    assert.equal((await h.post(path, { notes: saved.notes, baseVersionNo: 2 })).status, 200)
    assert.equal((await h.detail(made.id)).agenda[0]!.versionNo, 2)
    assert.equal((await h.post(path, { notes: '\n  ', baseVersionNo: 2 })).status, 200)
    assert.equal((await h.detail(made.id)).agenda[0]!.notes, null)
    for (const notes of ['x'.repeat(10001), '😀'.repeat(10001), '\u0000', '\uD800'])
      assert.equal(MeetingNotesSchema.safeParse(notes).success, false)
    for (const notes of ['x'.repeat(10001), '\u0000', '\uD800'])
      assert.equal((await h.post(path, { notes, baseVersionNo: 3 })).status, 400)
    for (const body of [
      { notes: '글' },
      { baseVersionNo: 3, unknown: 1 },
      { title: ' ', baseVersionNo: 3 },
    ])
      assert.equal((await h.post(path, body)).status, 400)
    assert.equal((await h.post(path, { notes: '가'.repeat(10000), baseVersionNo: 3 })).status, 200)
    // 제어 문자는 JSON에서 6바이트라 가장 큰 저장 요청도 413 없이 받는지 본다(http/guard.ts).
    const widest = {
      title: '\u0001'.repeat(100),
      body: '\u0001'.repeat(500),
      notes: '\u0001'.repeat(10000),
    }
    assert.equal((await h.post(path, { ...widest, baseVersionNo: 4 })).status, 200)
    assert.equal((await h.post(path, { notes: '가'.repeat(10000), baseVersionNo: 5 })).status, 200)
    assert.equal((await h.post(path, { title: '새 제목', baseVersionNo: 6 })).status, 200)
    const titleChanged = (await h.detail(made.id)).agenda[0]!
    assert.equal(titleChanged.notes, '가'.repeat(10000))
    assert.equal(titleChanged.body, '\u0001'.repeat(500))
  }),
)

test(
  '결정은 적은 사람과 회의 시작을 남기고 수정 충돌과 사용 중 안건 빼기를 막는다',
  withSettlement(async t => {
    const h = open(t)
    const made = await h.create({ ...INPUT, attendeeIds: [t.council.people.plain.memberId] })
    const agenda = made.agenda[0]!
    const path = `/${made.id}/agenda/${agenda.id}`
    const response = await h.post(
      `${path}/decisions`,
      { content: '진행하기', rationale: '합의' },
      's-plain',
    )
    assert.equal(response.status, 201)
    const decided = ((await response.json()) as MeetingResponse).meeting.agenda[0]!.decisions[0]!
    assert.equal(decided.decidedBy?.id, t.council.people.plain.memberId)
    assert.equal(decided.decidedAt, dateFromKorean(made.heldAt).toISOString())
    const decisionPath = `/${made.id}/decisions/${decided.id}`
    assert.equal((await h.post(decisionPath, { content: '수정', baseVersionNo: 1 })).status, 200)
    const conflict = await h.post(decisionPath, { content: '낡은 수정', baseVersionNo: 1 })
    assert.equal(conflict.status, 409)
    assert.equal(await errorOf(conflict), 'VERSION_CONFLICT')
    const blocked = await h.post(`${path}/cancel`, {})
    assert.equal(blocked.status, 409)
    assert.equal(await errorOf(blocked), 'AGENDA_IN_USE')
    assert.equal((await h.post(`${decisionPath}/cancel`, {})).status, 200)
    assert.equal((await h.detail(made.id)).agenda[0]!.decisions.length, 0)
    assert.equal((await h.post(`${decisionPath}/cancel`, {})).status, 404)
    assert.equal((await h.post(decisionPath, { content: '다시', baseVersionNo: 2 })).status, 404)
    assert.equal((await h.post(`${path}/cancel`, {})).status, 200)
    assert.equal((await h.detail(made.id)).agenda.length, 0)
  }),
)

test(
  '취소되지 않은 후속 업무가 있으면 안건을 빼지 못한다',
  withSettlement(async t => {
    const h = open(t)
    const made = await h.create()
    const agenda = made.agenda[0]!
    const task = await t.make(t.council, 'task', {
      title: '후속',
      originId: agenda.id,
      originKind: 'agenda_item',
    })
    assert.equal((await h.post(`/${made.id}/agenda/${agenda.id}/cancel`, {})).status, 409)
    await t.pg.query('UPDATE task SET cancelled_at = $2 WHERE id = $1', [task, NOW.toISOString()])
    assert.equal((await h.post(`/${made.id}/agenda/${agenda.id}/cancel`, {})).status, 200)
  }),
)

test(
  '같은 판의 동시 저장은 하나만 성공하고 다른 글은 충돌로 남는다',
  withSettlement(async t => {
    const h = open(t)
    const made = await h.create({ ...INPUT, attendeeIds: [t.council.people.plain.memberId] })
    const path = `/${made.id}/agenda/${made.agenda[0]!.id}`
    const responses = await Promise.all([
      h.post(path, { notes: '회장이 쓴 글', baseVersionNo: 1 }),
      h.post(path, { notes: '참가자가 쓴 글', baseVersionNo: 1 }, 's-plain'),
    ])
    assert.deepEqual(
      responses.map(r => r.status).sort((a, b) => a - b),
      [200, 409],
    )
    const conflict = responses.find(r => r.status === 409)!
    assert.deepEqual(await conflict.json(), { error: 'VERSION_CONFLICT' })
    const current = (await h.detail(made.id)).agenda[0]!
    assert.equal(current.versionNo, 2)
    assert.ok(['회장이 쓴 글', '참가자가 쓴 글'].includes(current.notes!))
    const versions = await t.pg.query(
      'SELECT version_no FROM record_version WHERE record_id = $1',
      [current.id],
    )
    assert.equal(versions.rows.length, 2)
  }),
)

test(
  '안건·결정 칸의 빈 글·길이·깨진 글자·모르는 키와 필수 판을 확인한다',
  withSettlement(async t => {
    const h = open(t, { writeLimiter: createRateLimiter({ limit: 1000, windowMs: 10_000 }) })
    const made = await h.create()
    for (const title of ['', ' ', '😀'.repeat(101), '\u0000', '\uD800'])
      assert.equal((await h.post(`/${made.id}/agenda`, { title })).status, 400)
    const path = `/${made.id}/agenda/${made.agenda[0]!.id}/decisions`
    for (const body of [
      {},
      { content: '결정', unknown: true },
      ...['', ' ', '😀'.repeat(501), '\u0000', '\uD800'].map(content => ({ content })),
    ])
      assert.equal((await h.post(path, body)).status, 400)
    assert.equal((await h.post(path, { content: '결정', rationale: '😀'.repeat(501) })).status, 400)
    assert.equal((await h.post(path, { content: '😀'.repeat(500) })).status, 201)
    const d = (await h.detail(made.id)).agenda[0]!.decisions[0]!
    for (const body of [
      { content: '글' },
      { content: ' ', baseVersionNo: 1 },
      { content: '글', baseVersionNo: 1, unknown: true },
    ])
      assert.equal((await h.post(`/${made.id}/decisions/${d.id}`, body)).status, 400)
  }),
)
