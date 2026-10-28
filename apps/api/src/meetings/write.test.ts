import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { MeetingResponse } from '@vada/contracts'
import { withSettlement } from '../test-support/settlement.js'
import { INPUT, NOW, errorOf, open } from './test-support/http.js'

test(
  '회의 만들기는 만든 사람·안건 차례·판을 남기고, 고치기는 낡은 판을 거절한다',
  withSettlement(async t => {
    const h = open(t)
    const made = await h.create({
      ...INPUT,
      agenda: [{ title: '첫째' }, { title: '둘째', body: '설명' }],
    })
    assert.deepEqual(
      made.attendees.map(person => person.id),
      [t.council.people.president.memberId],
    )
    assert.deepEqual(
      made.agenda.map(item => [item.position, item.title, item.versionNo]),
      [
        [1, '첫째', 1],
        [2, '둘째', 1],
      ],
    )
    assert.equal(made.versionNo, 1)
    const changed = await h.post(`/${made.id}`, {
      baseVersionNo: 1,
      title: '바뀐 회의',
      purpose: '행사 준비',
    })
    assert.equal(changed.status, 200)
    const updated = ((await changed.json()) as MeetingResponse).meeting
    assert.equal(updated.versionNo, 2)
    const stale = await h.post(`/${made.id}`, { baseVersionNo: 1, title: '덮어쓰기' })
    assert.equal(stale.status, 409)
    assert.equal(await errorOf(stale), 'VERSION_CONFLICT')
    assert.equal((await h.detail(made.id)).title, '바뀐 회의')
    assert.equal(
      (await h.post(`/${made.id}`, { baseVersionNo: 2, heldAt: '2026-10-29T16:00' })).status,
      400,
    )
    assert.equal(
      (
        await h.post(`/${made.id}`, {
          baseVersionNo: 2,
          purpose: null,
          eventId: null,
          hostDepartmentId: null,
        })
      ).status,
      200,
    )
  }),
)

test(
  '필수·상한·미인증·부원 만들기와 다른 학생회 참조를 거절한다',
  withSettlement(async t => {
    const h = open(t)
    for (const key of ['title', 'heldAt', 'endsAt', 'place'] as const) {
      const { [key]: _omitted, ...body } = INPUT
      assert.equal((await h.post('', body)).status, 400)
    }
    for (const patch of [
      { endsAt: INPUT.heldAt },
      { title: '😀'.repeat(101) },
      { agenda: Array(31).fill({ title: '안건' }) },
    ])
      assert.equal((await h.post('', { ...INPUT, ...patch })).status, 400)
    assert.equal((await h.api.post(h.base, INPUT)).status, 401)
    assert.equal((await h.post('', INPUT, 's-plain')).status, 403)
    const otherEvent = await t.event({}, t.other)
    for (const patch of [
      { eventId: otherEvent },
      { hostDepartmentId: t.other.departments.planning },
      { attendeeIds: [t.other.people.president.memberId] },
      { attendeeIds: [t.council.people.ended.memberId] },
      { eventId: t.council.departments.planning },
      { hostDepartmentId: otherEvent },
    ])
      assert.equal((await h.post('', { ...INPUT, ...patch })).status, 404)
    const made = await h.create()
    for (const patch of [
      { eventId: otherEvent },
      { hostDepartmentId: t.other.departments.planning },
    ])
      assert.equal((await h.post(`/${made.id}`, { baseVersionNo: 1, ...patch })).status, 404)
  }),
)

test(
  '참가자 전체 교체는 지금 운영진만 받고 확정·취소 회의는 바꾸지 않는다',
  withSettlement(async t => {
    const h = open(t)
    const made = await h.create()
    const path = `/${made.id}/attendees`
    for (const attendeeIds of [
      [t.other.people.president.memberId],
      [t.council.people.ended.memberId],
    ])
      assert.equal((await h.post(path, { attendeeIds })).status, 404)
    assert.equal(
      (await h.post(path, { attendeeIds: Array(201).fill(t.council.people.plain.memberId) }))
        .status,
      400,
    )
    assert.equal(
      (await h.post(path, { attendeeIds: [t.council.people.plain.memberId] }, 's-plain')).status,
      403,
    )
    assert.equal(
      (await h.post(path, { attendeeIds: [t.council.people.plain.memberId] })).status,
      200,
    )
    assert.deepEqual(
      (await h.detail(made.id)).attendees.map(person => person.id),
      [t.council.people.plain.memberId],
    )
    await t.pg.query(
      'UPDATE record SET confirmed_at = $2, confirmed_by = created_by WHERE id = $1',
      [made.id, NOW.toISOString()],
    )
    for (const [suffix, body] of [
      ['', { baseVersionNo: 1, title: '변경' }],
      ['/attendees', { attendeeIds: [] }],
      ['/cancel', { reason: '변경' }],
    ] as const) {
      const response = await h.post(`/${made.id}${suffix}`, body)
      assert.equal(response.status, 409)
      assert.equal(await errorOf(response), 'RECORD_CONFIRMED')
    }
    assert.equal((await h.detail(made.id)).status, 'done')
    assert.deepEqual((await h.detail(made.id)).actions, ['meeting.write'])
  }),
)

test(
  '지난 회의도 사유로 취소하고 취소 시각·판을 남기며 이후 변경을 막는다',
  withSettlement(async t => {
    const h = open(t)
    const made = await h.create({
      ...INPUT,
      heldAt: '2026-10-28T14:00',
      endsAt: '2026-10-28T15:00',
    })
    assert.equal((await h.post(`/${made.id}/cancel`, {})).status, 400)
    assert.equal(
      (await h.post(`/${made.id}/cancel`, { reason: '중복 일정' }, 's-plain')).status,
      403,
    )
    assert.equal((await h.post(`/${made.id}/cancel`, { reason: '중복 일정' })).status, 200)
    const cancelled = await h.detail(made.id)
    assert.equal(cancelled.status, 'cancelled')
    assert.equal(cancelled.cancelledAt, NOW.toISOString())
    assert.equal(cancelled.cancelReason, '중복 일정')
    assert.deepEqual(cancelled.actions, [])
    assert.equal(cancelled.versionNo, 2)
    for (const [suffix, body] of [
      ['', { baseVersionNo: 2, title: '변경' }],
      ['/attendees', { attendeeIds: [] }],
      ['/cancel', { reason: '재취소' }],
    ] as const) {
      const response = await h.post(`/${made.id}${suffix}`, body)
      assert.equal(response.status, 409)
      assert.equal(await errorOf(response), 'MEETING_CANCELLED')
    }
    const versions = await t.pg.query<{ reason: string }>(
      'SELECT reason FROM record_version WHERE record_id = $1 ORDER BY version_no',
      [made.id],
    )
    assert.equal(versions.rows.at(-1)!.reason, '중복 일정')
  }),
)

test(
  '살아 있는 후속 업무가 있으면 취소를 막고 지운 업무만 있으면 허용한다',
  withSettlement(async t => {
    const h = open(t)
    const made = await h.create()
    const taskId = await t.make(t.council, 'task', {
      title: '후속 업무',
      originId: made.agenda[0]!.id,
      originKind: 'agenda_item',
    })
    let response = await h.post(`/${made.id}/cancel`, { reason: '취소' })
    assert.equal(response.status, 409)
    assert.equal(await errorOf(response), 'MEETING_HAS_TASKS')
    assert.equal((await h.detail(made.id)).actions.includes('meeting.cancel'), false)
    await t.pg.query('UPDATE task SET cancelled_at = $2 WHERE id = $1', [taskId, NOW.toISOString()])
    response = await h.post(`/${made.id}/cancel`, { reason: '취소' })
    assert.equal(response.status, 200)
  }),
)

test(
  '모든 주소는 다른 학생회 회의를 404로, 그만두기 중 쓰기는 409로 거절한다',
  withSettlement(async t => {
    const h = open(t)
    const other = await t.make(t.other, 'meeting', { title: '다른 학생회', heldAt: NOW })
    assert.equal((await h.get(`/${other}`)).status, 404)
    for (const [suffix, body] of [
      ['', { baseVersionNo: 1, title: '변경' }],
      ['/attendees', { attendeeIds: [] }],
      ['/cancel', { reason: '취소' }],
    ] as const)
      assert.equal((await h.post(`/${other}${suffix}`, body)).status, 404)
    const made = await h.create()
    await t.pg.query('UPDATE council SET closing_requested_at = $2 WHERE id = $1', [
      t.council.councilId,
      NOW.toISOString(),
    ])
    for (const [path, body] of [
      ['', INPUT],
      [`/${made.id}`, { baseVersionNo: 1, title: '변경' }],
      [`/${made.id}/attendees`, { attendeeIds: [] }],
      [`/${made.id}/cancel`, { reason: '취소' }],
    ] as const) {
      const response = await h.post(path, body)
      assert.equal(response.status, 409)
      assert.equal(await errorOf(response), 'COUNCIL_CLOSING')
    }
    assert.equal((await h.get(`/${made.id}`, 's-plain')).status, 200)
  }),
)

test(
  '완료 행사에 새로 잇기는 거절하고 기존 연결 회의는 업무처럼 계속 고친다',
  withSettlement(async t => {
    const h = open(t)
    const eventId = await t.event()
    const linked = await h.create({ ...INPUT, eventId })
    const free = await h.create()
    await t.completion(eventId, 'completed', NOW)
    for (const response of [
      await h.post('', { ...INPUT, eventId }),
      await h.post(`/${free.id}`, { baseVersionNo: 1, eventId }),
    ]) {
      assert.equal(response.status, 409)
      assert.equal(await errorOf(response), 'EVENT_COMPLETED')
    }
    assert.equal(
      (await h.post(`/${linked.id}`, { baseVersionNo: 1, eventId, title: '정정' })).status,
      200,
    )
    assert.equal((await h.post(`/${linked.id}/attendees`, { attendeeIds: [] })).status, 200)
    assert.equal((await h.post(`/${linked.id}/cancel`, { reason: '중복' })).status, 200)
    assert.equal(
      (await h.options()).events.some(item => item.id === eventId),
      false,
    )
  }),
)
