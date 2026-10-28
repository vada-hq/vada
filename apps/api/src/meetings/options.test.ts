import assert from 'node:assert/strict'
import { test } from 'node:test'
import { withSettlement } from '../test-support/settlement.js'
import { open } from './test-support/http.js'

test(
  '기본 참가자는 주관 부서 → 행사 책임자·담당 부서 → 지금 운영진 전체다',
  withSettlement(async t => {
    const h = open(t)
    const planning = t.council.departments.planning
    const members = ['planningHead', 'planningViceHead', 'planningMember'] as const
    const ids = members.map(key => t.council.people[key].memberId)
    const all = await h.options()
    assert.equal(all.members.length, 7)
    assert.deepEqual(new Set(all.defaultAttendeeIds), new Set(all.members.map(person => person.id)))
    const department = await h.options(`?hostDepartment=${planning}`)
    assert.deepEqual(new Set(department.defaultAttendeeIds), new Set(ids))
    const ownerId = t.council.people.financeMember.memberId
    const eventId = await t.event({ ownerId })
    await t.make(t.council, 'task', { title: '담당', eventId, departmentId: planning })
    const event = await h.options(`?event=${eventId}`)
    assert.deepEqual(new Set(event.defaultAttendeeIds), new Set([...ids, ownerId]))
    const hosted = await h.options(`?event=${eventId}&hostDepartment=${planning}`)
    assert.deepEqual(new Set(hosted.defaultAttendeeIds), new Set(ids))
    assert.equal(
      (await h.get(`/options?hostDepartment=${t.other.departments.planning}`)).status,
      404,
    )
    await t.pg.query(
      'UPDATE council_membership SET ends_at = clock_timestamp() WHERE member_id = $1',
      [t.council.people.planningMember.memberId],
    )
    assert.equal(
      (await h.options(`?hostDepartment=${planning}`)).defaultAttendeeIds.includes(
        t.council.people.planningMember.memberId,
      ),
      false,
    )
  }),
)
