import assert from 'node:assert/strict'
import { test } from 'node:test'
import { CreateTaskSchema, UpdateTaskSchema, type TaskResponse } from '@vada/contracts'
import { withSettlement } from '../test-support/settlement.js'
import { INPUT, open, errorOf } from './test-support/http.js'

test('업무 만들기의 안건 번호만 선택적으로 받고 고치기에서는 받지 않는다', () => {
  const id = '0199d1a0-0000-7000-8000-000000000001'
  for (const agendaItemId of [id, null, undefined])
    assert.equal(CreateTaskSchema.safeParse({ title: '후속', agendaItemId }).success, true)
  for (const agendaItemId of ['', ' ', 'x'.repeat(37), '\u0000', '\uD800', [], {}])
    assert.equal(CreateTaskSchema.safeParse({ title: '후속', agendaItemId }).success, false)
  assert.equal(UpdateTaskSchema.safeParse({ agendaItemId: id }).success, false)
})

test(
  '참가 부서장이 만든 후속 업무의 출처가 첫 판·상세에 남고 비참가 부원도 요약을 읽는다',
  withSettlement(async t => {
    const h = open(t)
    const meeting = await h.create({
      ...INPUT,
      attendeeIds: [t.council.people.planningHead.memberId],
      agenda: [{ title: '하나' }, { title: '둘' }, { title: '셋' }],
    })
    const base = `/api/organizations/${t.council.councilId}/tasks`
    const agenda = meeting.agenda[0]!
    const response = await t.api.post(
      base,
      {
        title: '현수막 주문',
        agendaItemId: agenda.id,
        departmentId: t.council.departments.planning,
        assigneeId: t.council.people.planningMember.memberId,
      },
      's-planningHead',
    )
    assert.equal(response.status, 201)
    const task = ((await response.json()) as TaskResponse).task
    const origin = {
      meetingId: meeting.id,
      meetingTitle: meeting.title,
      agendaId: agenda.id,
      agendaTitle: agenda.title,
    }
    assert.deepEqual(task.origin, origin)
    const stored = await t.pg.query<{ origin_id: string; origin_kind: string }>(
      'SELECT origin_id, origin_kind FROM task WHERE id = $1',
      [task.id],
    )
    assert.deepEqual(stored.rows[0], { origin_id: agenda.id, origin_kind: 'agenda_item' })
    const version = await t.pg.query<{ data: { origin_id: string; origin_kind: string } }>(
      'SELECT data FROM record_version WHERE record_id = $1 AND version_no = 1',
      [task.id],
    )
    assert.equal(version.rows[0]!.data.origin_id, agenda.id)
    assert.equal(version.rows[0]!.data.origin_kind, 'agenda_item')
    const detail = await t.api.get(`${base}/${task.id}`, 's-plain')
    assert.deepEqual(((await detail.json()) as TaskResponse).task.origin, origin)
    for (const agendaItem of meeting.agenda.slice(1)) {
      const result = await t.api.post(
        base,
        { title: agendaItem.title, agendaItemId: agendaItem.id },
        's-president',
      )
      assert.equal(result.status, 201)
    }
    const summary = (await h.detail(meeting.id, 's-plain')).agenda
    assert.deepEqual(
      summary.map(item => item.followUps.length),
      [1, 1, 1],
    )
    assert.deepEqual(summary[0]!.followUps, [
      {
        id: task.id,
        title: task.title,
        status: 'todo',
        assignee: { id: t.council.people.planningMember.memberId, name: 's planningMember' },
      },
    ])
    assert.equal(
      (await t.api.post(`${base}/${task.id}/status`, { status: 'done' }, 's-president')).status,
      200,
    )
    assert.equal((await h.detail(meeting.id)).agenda[0]!.followUps[0]!.status, 'done')
    const normal = await t.api.post(base, { title: '일반 업무' }, 's-president')
    assert.equal(((await normal.json()) as TaskResponse).task.origin, null)
  }),
)

test(
  '회의 권한과 업무 권한을 모두 지키며 다른 학생회 안건은 먼저 404로 숨긴다',
  withSettlement(async t => {
    const h = open(t)
    const meeting = await h.create({
      ...INPUT,
      attendeeIds: [t.council.people.planningMember.memberId],
    })
    const base = `/api/organizations/${t.council.councilId}/tasks`
    const body = {
      title: '후속',
      agendaItemId: meeting.agenda[0]!.id,
      departmentId: t.council.departments.planning,
    }
    const count = async () => (await t.pg.query('SELECT id FROM task')).rows.length
    const before = await count()
    assert.equal(
      (
        await t.api.post(
          base,
          { ...body, assigneeId: t.council.people.planningMember.memberId },
          's-plain',
        )
      ).status,
      403,
    )
    assert.equal(
      (
        await t.api.post(
          base,
          { ...body, assigneeId: t.council.people.planningHead.memberId },
          's-planningMember',
        )
      ).status,
      403,
    )
    const ownMeeting = await h.create(INPUT, 's-planningHead')
    assert.equal(
      (
        await t.api.post(
          base,
          {
            ...body,
            agendaItemId: ownMeeting.agenda[0]!.id,
            departmentId: t.council.departments.finance,
            assigneeId: t.council.people.financeMember.memberId,
          },
          's-planningHead',
        )
      ).status,
      403,
    )
    const foreignMeeting = await t.make(t.other, 'meeting', {
      title: '다른 회의',
      heldAt: new Date('2026-10-29T03:00:00Z'),
    })
    const foreignAgenda = await t.make(t.other, 'agenda_item', {
      meetingId: foreignMeeting,
      title: '다른 안건',
      position: 1,
    })
    for (const user of ['s-president', 's-plain'])
      assert.equal(
        (await t.api.post(base, { ...body, agendaItemId: foreignAgenda }, user)).status,
        404,
      )
    assert.equal(await count(), before)
    assert.equal((await t.api.post(base, body, undefined)).status, 401)
    assert.equal((await t.api.post(base, body, 'o-president')).status, 403)
    assert.equal(
      (
        await t.api.post(
          base,
          { ...body, assigneeId: t.council.people.planningMember.memberId },
          's-planningMember',
        )
      ).status,
      201,
    )
  }),
)

test(
  '확정·취소한 회의와 뺀 안건에는 업무를 더하지 않는다',
  withSettlement(async t => {
    const h = open(t)
    const base = `/api/organizations/${t.council.councilId}/tasks`
    for (const state of ['confirmed', 'cancelled', 'removed'] as const) {
      const meeting = await h.create()
      const agenda = meeting.agenda[0]!
      if (state === 'confirmed')
        await t.pg.query(
          'UPDATE record SET confirmed_at = $2, confirmed_by = created_by WHERE id = $1',
          [meeting.id, '2026-10-29T03:00:00Z'],
        )
      else if (state === 'cancelled')
        assert.equal((await h.post(`/${meeting.id}/cancel`, { reason: '취소' })).status, 200)
      else assert.equal((await h.post(`/${meeting.id}/agenda/${agenda.id}/cancel`, {})).status, 200)
      const result = await t.api.post(
        base,
        { title: '후속', agendaItemId: agenda.id },
        's-president',
      )
      assert.equal(result.status, state === 'removed' ? 404 : 409)
      assert.equal(
        await errorOf(result),
        state === 'confirmed'
          ? 'RECORD_CONFIRMED'
          : state === 'cancelled'
            ? 'MEETING_CANCELLED'
            : 'NOT_FOUND',
      )
    }
    assert.equal((await t.pg.query('SELECT id FROM task')).rows.length, 0)
  }),
)

test(
  '실제 후속 업무가 있으면 안건·회의 취소를 막고 업무를 지우면 요약에서 빠져 둘 다 취소된다',
  withSettlement(async t => {
    const h = open(t)
    const meeting = await h.create()
    const agenda = meeting.agenda[0]!
    const base = `/api/organizations/${t.council.councilId}/tasks`
    const made = await t.api.post(base, { title: '후속', agendaItemId: agenda.id }, 's-president')
    assert.equal(made.status, 201)
    const task = ((await made.json()) as TaskResponse).task
    const remove = `/${meeting.id}/agenda/${agenda.id}/cancel`
    assert.equal(await errorOf(await h.post(remove, {})), 'AGENDA_IN_USE')
    assert.equal(
      await errorOf(await h.post(`/${meeting.id}/cancel`, { reason: '취소' })),
      'MEETING_HAS_TASKS',
    )
    assert.equal((await t.api.post(`${base}/${task.id}/delete`, {}, 's-president')).status, 204)
    assert.deepEqual((await h.detail(meeting.id)).agenda[0]!.followUps, [])
    const stored = await t.pg.query<{ origin_id: string }>(
      'SELECT origin_id FROM task WHERE id = $1',
      [task.id],
    )
    assert.equal(stored.rows[0]!.origin_id, agenda.id)
    assert.equal((await h.post(remove, {})).status, 200)
    assert.equal((await h.post(`/${meeting.id}/cancel`, { reason: '취소' })).status, 200)
  }),
)
