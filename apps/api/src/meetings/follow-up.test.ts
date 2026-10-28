import assert from 'node:assert/strict'
import { test } from 'node:test'
import { CreateTaskSchema, UpdateTaskSchema, type TaskResponse } from '@vada/contracts'
import { withSettlement } from '../test-support/settlement.js'
import { actorOf } from '../access/actor.js'
import { meetingDetailOf } from './queries.js'
import { INPUT, NOW, open, errorOf } from './test-support/http.js'

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
        dueDate: null,
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
  '업무를 만들 수 있는 비참가 기획부장과 부원도 회의 권한 없이는 후속 업무를 만들지 못한다',
  withSettlement(async t => {
    const h = open(t)
    const meeting = await h.create({ ...INPUT, hostDepartmentId: null, attendeeIds: [] })
    const base = `/api/organizations/${t.council.councilId}/tasks`
    const count = async () => (await t.pg.query('SELECT id FROM task')).rows.length
    for (const user of ['s-planningHead', 's-planningMember']) {
      assert.equal((await h.detail(meeting.id, user)).actions.includes('meeting.minutes'), false)
      const body = {
        title: '기획부 업무',
        departmentId: t.council.departments.planning,
        assigneeId: t.council.people.planningMember.memberId,
      }
      const before = await count()
      const denied = await t.api.post(base, { ...body, agendaItemId: meeting.agenda[0]!.id }, user)
      assert.equal(denied.status, 403)
      assert.equal(await errorOf(denied), 'FORBIDDEN')
      assert.equal(await count(), before)
      assert.equal((await t.api.post(base, body, user)).status, 201)
      assert.equal(await count(), before + 1)
    }
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
  '안건 1개·후속 업무 1개와 안건 3개·후속 업무 6개의 상세 쿼리 수는 같다',
  withSettlement(async t => {
    const h = open(t)
    const small = await h.create()
    const large = await h.create({
      ...INPUT,
      agenda: [{ title: '하나' }, { title: '둘' }, { title: '셋' }],
    })
    const base = `/api/organizations/${t.council.councilId}/tasks`
    for (const meeting of [small, large])
      for (const agenda of meeting.agenda)
        for (let index = 0; index < (meeting === small ? 1 : 2); index++) {
          const result = await t.api.post(
            base,
            {
              title: `${agenda.title} ${index}`,
              agendaItemId: agenda.id,
              departmentId: t.council.departments.planning,
              assigneeId: t.council.people.planningMember.memberId,
            },
            's-president',
          )
          assert.equal(result.status, 201)
        }
    const queries: string[] = []
    const db = t.drizzle({ logger: { logQuery: query => queries.push(query) } })
    const actor = (await actorOf(db, 's-president', t.council.councilId, NOW))!
    const counts: number[] = []
    for (const [meeting, expectedTasks] of [
      [small, 1],
      [large, 6],
    ] as const) {
      queries.length = 0
      const detail = await db.transaction(tx => meetingDetailOf(tx, actor, meeting.id, NOW))
      counts.push(queries.length)
      assert.equal(detail.agenda.length, meeting.agenda.length)
      const tasks = detail.agenda.flatMap(item => item.followUps)
      assert.equal(tasks.length, expectedTasks)
      assert.ok(tasks.every(task => task.assignee?.id === t.council.people.planningMember.memberId))
    }
    assert.ok(counts[0]! > 0)
    assert.equal(counts[1], counts[0])
  }),
)

for (const target of ['회의', '안건'] as const)
  test(
    `후속 업무 만들기와 ${target} 취소가 경합해도 취소된 곳에 살아 있는 업무를 남기지 않는다`,
    withSettlement(async t => {
      const h = open(t)
      const meeting = await h.create()
      const agenda = meeting.agenda[0]!
      // PGlite는 한 연결에서 직렬화하지만 진짜 Postgres에서도 같은 불변식을 지킨다.
      const [created, cancelled] = await Promise.all([
        t.api.post(
          `/api/organizations/${t.council.councilId}/tasks`,
          { title: '동시에 만든 후속', agendaItemId: agenda.id },
          's-president',
        ),
        target === '회의'
          ? h.post(`/${meeting.id}/cancel`, { reason: '취소' })
          : h.post(`/${meeting.id}/agenda/${agenda.id}/cancel`, {}),
      ])
      if (created.status === 201) {
        assert.equal(cancelled.status, 409)
        assert.equal(
          await errorOf(cancelled),
          target === '회의' ? 'MEETING_HAS_TASKS' : 'AGENDA_IN_USE',
        )
      } else {
        assert.equal(cancelled.status, 200)
        assert.equal(created.status, target === '회의' ? 409 : 404)
        assert.equal(await errorOf(created), target === '회의' ? 'MEETING_CANCELLED' : 'NOT_FOUND')
      }
      const live = await t.pg.query(
        'SELECT id FROM task WHERE origin_id = $1 AND cancelled_at IS NULL',
        [agenda.id],
      )
      assert.equal(live.rows.length, created.status === 201 ? 1 : 0)
      const invalid = await t.pg.query(
        `SELECT task.id FROM task
         JOIN agenda_item ON agenda_item.id = task.origin_id AND task.origin_kind = 'agenda_item'
         JOIN meeting ON meeting.id = agenda_item.meeting_id
         WHERE meeting.id = $1 AND task.cancelled_at IS NULL
           AND (meeting.cancelled_at IS NOT NULL OR agenda_item.cancelled_at IS NOT NULL)`,
        [meeting.id],
      )
      assert.equal(invalid.rows.length, 0)
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
