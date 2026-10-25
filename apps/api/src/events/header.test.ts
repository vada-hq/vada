import assert from 'node:assert/strict'
import { test } from 'node:test'
import { clockNow, createRecord } from '../records/records.js'
import { withEvents, type EventCouncil, type EventKit } from '../test-support/events.js'

// 'YYYY-MM-DDTHH:mm' 또는 초까지 쓴 한국 시각
const korean = (value: string) => new Date(`${value.length === 16 ? `${value}:00` : value}+09:00`)
// 마감 날짜는 그날 한국 23:59:59로 저장한다(tasks/due.ts dueAtOf).
const due = (date: string) => new Date(`${date}T23:59:59+09:00`)

function taskMaker(t: EventKit) {
  return (values: Record<string, unknown>, owner: EventCouncil = t.council) =>
    t.db.transaction(tx =>
      createRecord(tx, {
        kind: 'task',
        councilId: owner.councilId,
        actor: owner.people.president.memberId,
        values: { title: '업무', ...values },
      }),
    )
}

const department = (t: EventKit, name: string) =>
  t.db.transaction(tx =>
    createRecord(tx, {
      kind: 'department',
      councilId: t.council.councilId,
      actor: t.council.people.president.memberId,
      values: { name },
    }),
  )

test(
  '담당 부서는 취소·끝나지 않은 업무의 부서를 중복 없이 이름순으로 주고, 업무가 없으면 비어 있다',
  withEvents(async t => {
    const task = taskMaker(t)
    const { planning, finance } = t.council.departments
    const id = await t.make({ name: '축제' })
    assert.deepEqual((await t.detail(id)).departments, [])
    const first = await department(t, '가나부')
    await task({ eventId: id, departmentId: finance })
    await task({ eventId: id, departmentId: planning })
    await task({ eventId: id, departmentId: planning })
    await task({ eventId: id })
    // 끝난 업무와 취소한 업무의 부서는 담당이 아니다.
    await task({ eventId: id, departmentId: first, status: 'done' })
    await task({ eventId: id, departmentId: first, cancelledAt: clockNow })
    // 다른 행사의 업무는 세지 않는다.
    const other = await t.make({ name: '다른 행사' })
    await task({ eventId: other, departmentId: first })
    assert.deepEqual((await t.detail(id)).departments, ['기획부', '재정부'])
    assert.deepEqual((await t.detail(id, 's-plain')).departments, ['기획부', '재정부'])
  }),
)

test(
  '건강도는 마감이 지난 업무와 담당자 없는 업무의 수이고, 끝난 업무와 취소한 업무는 세지 않는다',
  withEvents(async t => {
    const task = taskMaker(t)
    const { planning } = t.council.departments
    const { planningMember, ended } = t.council.people
    const id = await t.make({ name: '축제' })
    const staffed = { departmentId: planning, assigneeId: planningMember.memberId }
    assert.deepEqual((await t.detail(id)).health, { overdue: 0, unassigned: 0 })
    // 지금은 한국 2026-10-25 12:00이다. 어제 마감은 지났고 오늘 마감은 아직이다.
    await task({ eventId: id, ...staffed, dueAt: due('2026-10-24') })
    await task({ eventId: id, ...staffed, dueAt: due('2026-10-25') })
    // 담당자 없음: 담당자가 없거나, 떠났거나, 부서가 없다(업무 화면의 '담당자 없음'과 같다).
    await task({ eventId: id, departmentId: planning })
    await task({ eventId: id, departmentId: planning, assigneeId: ended.memberId })
    await task({ eventId: id, assigneeId: planningMember.memberId })
    await task({ eventId: id, status: 'done', dueAt: due('2026-10-01') })
    await task({ eventId: id, cancelledAt: clockNow, dueAt: due('2026-10-01') })
    assert.deepEqual((await t.detail(id)).health, { overdue: 1, unassigned: 3 })
  }),
)

test(
  '마감이 지났는지는 한국 날짜로 센다(자정 ±1초)',
  withEvents(async t => {
    const task = taskMaker(t)
    const id = await t.make({ name: '축제' })
    await task({
      eventId: id,
      departmentId: t.council.departments.planning,
      assigneeId: t.council.people.planningMember.memberId,
      dueAt: due('2026-10-25'),
    })
    t.setNow(korean('2026-10-25T23:59:59'))
    assert.equal((await t.detail(id)).health.overdue, 0)
    t.setNow(korean('2026-10-26T00:00:00'))
    assert.equal((await t.detail(id)).health.overdue, 1)
  }),
)

test(
  '다음 일정은 지금 뒤의 가장 이른 것(끝나지 않은 업무 마감, 행사 시작)이고, 없으면 null이다',
  withEvents(async t => {
    const task = taskMaker(t)
    const id = await t.make({ name: '축제', startsAt: korean('2026-10-28T14:00') })
    assert.deepEqual((await t.detail(id)).next, { kind: 'start', startsAt: '2026-10-28T14:00' })
    await task({ eventId: id, title: '지난 일', dueAt: due('2026-10-24') })
    await task({ eventId: id, title: '끝낸 일', dueAt: due('2026-10-25'), status: 'done' })
    await task({ eventId: id, title: '취소한 일', dueAt: due('2026-10-25'), cancelledAt: clockNow })
    await task({ eventId: id, title: '마감 없는 일' })
    await task({ eventId: id, title: '포스터', dueAt: due('2026-10-27') })
    await task({ eventId: id, title: '오늘 일', dueAt: due('2026-10-26') })
    assert.deepEqual((await t.detail(id)).next, {
      kind: 'task',
      dueDate: '2026-10-26',
      title: '오늘 일',
    })
    // 같은 날이면 행사 시작(그날 14:00)이 업무 마감(그날 끝)보다 이르다.
    t.setNow(korean('2026-10-28T09:00'))
    await task({ eventId: id, title: '당일 일', dueAt: due('2026-10-28') })
    assert.deepEqual((await t.detail(id)).next, { kind: 'start', startsAt: '2026-10-28T14:00' })
    t.setNow(korean('2026-10-28T15:00'))
    assert.deepEqual((await t.detail(id)).next, {
      kind: 'task',
      dueDate: '2026-10-28',
      title: '당일 일',
    })
    t.setNow(korean('2026-10-29T00:00'))
    assert.equal((await t.detail(id)).next, null)
  }),
)

test(
  '끝난 지 며칠은 끝났고 완료하지 않은 행사만 한국 날짜로 세고, 끝 시각이 없으면 시작한 날부터 센다',
  withEvents(async t => {
    const upcoming = await t.make({ name: '예정', startsAt: korean('2026-10-30T14:00') })
    const tbd = await t.make({ name: '미정' })
    const ended = await t.make({
      name: '끝남',
      startsAt: korean('2026-10-17T14:00'),
      endsAt: korean('2026-10-18T02:00'),
    })
    const noEnd = await t.make({ name: '끝 없음', startsAt: korean('2026-10-18T10:00') })
    assert.equal((await t.detail(upcoming)).endedDays, null)
    assert.equal((await t.detail(tbd)).endedDays, null)
    // 지금은 한국 2026-10-25 12:00이다.
    assert.equal((await t.detail(ended)).endedDays, 7)
    assert.equal((await t.detail(noEnd)).endedDays, 7)
    t.setNow(korean('2026-10-25T23:59:59'))
    assert.equal((await t.detail(ended)).endedDays, 7)
    t.setNow(korean('2026-10-26T00:00:00'))
    assert.equal((await t.detail(ended)).endedDays, 8)
    // 끝 시각의 그 날에 끝난 행사는 0일이다.
    t.setNow(korean('2026-10-18T02:00:01'))
    assert.equal((await t.detail(ended)).endedDays, 0)
    t.setNow(korean('2026-10-26T00:00:00'))
    await t.db.transaction(tx =>
      createRecord(tx, {
        kind: 'approval',
        councilId: t.council.councilId,
        actor: t.council.people.president.memberId,
        values: {
          targetId: ended,
          targetKind: 'event',
          outcome: 'completed',
          actorId: t.council.people.president.memberId,
          actorKind: 'member',
          actedAt: korean('2026-10-25T10:00'),
        },
      }),
    )
    const done = await t.detail(ended)
    assert.equal(done.status, 'completed')
    assert.equal(done.endedDays, null)
  }),
)
