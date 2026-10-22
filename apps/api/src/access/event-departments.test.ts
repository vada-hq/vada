import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createTestDb } from '../db/test-db.js'
import { clockNow, createRecord, updateRecord } from '../records/records.js'
import { seedCouncil } from '../test-support/council.js'
import { actorOfMember } from './actor.js'
import { eventDepartmentIdsOf } from './event-departments.js'
import { can } from './permissions.js'

const inside = new Date('2026-06-01T03:00:00Z')

// 행사 담당 부서 기준(기능 007, DEC-25): 그 행사의 취소하지 않은 업무가 가리키는 부서의 지금 소속일 때만 맞는다.
async function start() {
  const handle = await createTestDb()
  const council = await seedCouncil(handle.db, handle.pg)
  const other = await seedCouncil(handle.db, handle.pg, 'o')
  const president = council.people.president.memberId
  const makeEvent = (owner = council, name = '축제') =>
    handle.db.transaction(tx =>
      createRecord(tx, {
        kind: 'event',
        councilId: owner.councilId,
        actor: owner.people.president.memberId,
        values: { name },
      }),
    )
  const makeTask = (eventId: string, departmentId: string | null) =>
    handle.db.transaction(tx =>
      createRecord(tx, {
        kind: 'task',
        councilId: council.councilId,
        actor: president,
        values: { title: '현수막', eventId, departmentId },
      }),
    )
  const mayManage = async (who: keyof typeof council.people, eventId: string) => {
    const actor = await actorOfMember(
      handle.db,
      council.people[who].memberId,
      council.councilId,
      inside,
    )
    assert.ok(actor)
    const eventDepartmentIds = await eventDepartmentIdsOf(handle.db, council.councilId, eventId)
    return {
      manage: can(actor, 'registration.manage', { eventDepartmentIds }),
      view: can(actor, 'registration.view_applicants', { eventDepartmentIds }),
    }
  }
  return { ...handle, council, other, makeEvent, makeTask, mayManage }
}

test('그 행사의 업무가 가리키는 부서 사람은 관리하고 신청자를 본다. 다른 부서와 직급 없는 사람은 아니다', async () => {
  const t = await start()
  try {
    const event = await t.makeEvent()
    await t.makeTask(event, t.council.departments.planning)
    for (const who of ['planningHead', 'planningViceHead', 'planningMember'] as const)
      assert.deepEqual(await t.mayManage(who, event), { manage: true, view: true }, who)
    // 재정부는 담당 부서가 아니어도 신청자 정보는 보지만 관리는 못 한다.
    assert.deepEqual(await t.mayManage('financeMember', event), { manage: false, view: true })
    assert.deepEqual(await t.mayManage('plain', event), { manage: false, view: false })
    // 회장단은 업무와 관계없이 관리하고 본다(기준 3).
    for (const who of ['president', 'vicePresident'] as const)
      assert.deepEqual(await t.mayManage(who, event), { manage: true, view: true }, who)
  } finally {
    await t.close()
  }
})

test('업무가 없거나 부서가 없는 업무뿐이면 담당 부서가 없어 아무 부서도 맞지 않는다', async () => {
  const t = await start()
  try {
    const event = await t.makeEvent()
    assert.deepEqual(await t.mayManage('planningHead', event), { manage: false, view: false })
    await t.makeTask(event, null)
    assert.deepEqual(await eventDepartmentIdsOf(t.db, t.council.councilId, event), [])
    assert.deepEqual(await t.mayManage('planningHead', event), { manage: false, view: false })
  } finally {
    await t.close()
  }
})

test('업무를 취소하면 그 부서는 바로 맞지 않고, 다른 행사의 업무는 세지 않는다', async () => {
  const t = await start()
  try {
    const event = await t.makeEvent()
    const otherEvent = await t.makeEvent(t.council, '다른 행사')
    const task = await t.makeTask(event, t.council.departments.planning)
    await t.makeTask(otherEvent, t.council.departments.finance)
    assert.deepEqual(await eventDepartmentIdsOf(t.db, t.council.councilId, event), [
      t.council.departments.planning,
    ])
    await t.db.transaction(tx =>
      updateRecord(tx, {
        kind: 'task',
        id: task,
        actor: t.council.people.president.memberId,
        reason: null,
        changes: { cancelledAt: clockNow },
      }),
    )
    assert.deepEqual(await t.mayManage('planningHead', event), { manage: false, view: false })
  } finally {
    await t.close()
  }
})

test('업무의 부서를 바꾸면 새 부서가 맞고 옛 부서는 맞지 않는다', async () => {
  const t = await start()
  try {
    const event = await t.makeEvent()
    const task = await t.makeTask(event, t.council.departments.planning)
    await t.db.transaction(tx =>
      updateRecord(tx, {
        kind: 'task',
        id: task,
        actor: t.council.people.president.memberId,
        reason: null,
        changes: { departmentId: t.council.departments.finance },
      }),
    )
    assert.deepEqual(await t.mayManage('planningHead', event), { manage: false, view: false })
    assert.deepEqual(await t.mayManage('financeMember', event), { manage: true, view: true })
  } finally {
    await t.close()
  }
})

test('부서를 떠난 사람은 맞지 않고, 다른 학생회의 행사는 업무가 있어도 빈 목록이다', async () => {
  const t = await start()
  try {
    const event = await t.makeEvent()
    await t.makeTask(event, t.council.departments.planning)
    const { rows } = await t.pg.query<{ id: string }>(
      'SELECT id FROM department_membership WHERE member_id = $1',
      [t.council.people.planningMember.memberId],
    )
    await t.db.transaction(tx =>
      updateRecord(tx, {
        kind: 'department_membership',
        id: rows[0]!.id,
        actor: null,
        reason: null,
        changes: { endsAt: clockNow },
      }),
    )
    assert.deepEqual(await t.mayManage('planningMember', event), { manage: false, view: false })
    assert.deepEqual(await t.mayManage('planningHead', event), { manage: true, view: true })
    assert.deepEqual(await eventDepartmentIdsOf(t.db, t.other.councilId, event), [])
  } finally {
    await t.close()
  }
})
