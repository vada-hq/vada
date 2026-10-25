import assert from 'node:assert/strict'
import { test } from 'node:test'
import { myCouncils } from '../councils/queries.js'
import { createTestDb } from '../db/test-db.js'
import { memberLogin } from '../db/schema.js'
import { clockNow, createRecord } from '../records/records.js'
import { createOptionsOf } from '../tasks/create-options.js'
import { addUser, seedCouncil } from '../test-support/council.js'
import { actorOf } from './actor.js'
import { periodHasStarted } from './current-cohort.js'

test('periodHasStarted: 시작일이 오늘(한국 날짜)이거나 그 전이면 시작한 기간이다. 끝 날짜는 보지 않는다', () => {
  const period = { startsOn: '2026-01-01' }
  // 2026-01-01 00:00 KST는 2025-12-31 15:00 UTC다.
  assert.equal(periodHasStarted(period, new Date('2025-12-31T14:59:59Z')), false)
  assert.equal(periodHasStarted(period, new Date('2025-12-31T15:00:00Z')), true)
  assert.equal(periodHasStarted(period, new Date('2026-06-15T03:00:00Z')), true)
  assert.equal(periodHasStarted(period, new Date('2030-01-01T03:00:00Z')), true)
})

// DEC-57: 지금 기수는 그 학생회에서 시작한 기수 중 가장 늦게 시작한 것이다. 끝 날짜가 지나도 잠그지 않는다.
// 접근 검사(actorOf), 내 학생회 목록, 업무 선택지가 모든 때에 같은 사람을 지금 운영진으로 본다.
test('지금 기수: 끝난 기수만 있어도 열리고, 시작 전이면 닫히고, 늦게 시작한 기수가 앞 기수를 대신한다', async () => {
  const { db, pg, close } = await createTestDb()
  try {
    // a 학생회: 2026 기수(2026-01-01~2026-12-31), 그 뒤 두 달 비고 2027 기수(2027-03-01~2028-02-29)
    const a = await seedCouncil(db, pg, 'a')
    // 다른 학생회의 기수는 a의 지금 기수를 정하지 않는다. a의 2026 기수보다 늦게 시작해, 학생회 거르기를 지우면 a가 닫힌다.
    const other = await seedCouncil(db, pg, 'o', { startsOn: '2026-03-01', endsOn: '2027-02-28' })
    await addUser(pg, 'a-next')
    const next = await db.transaction(async tx => {
      const memberId = await createRecord(tx, {
        kind: 'member',
        councilId: null,
        actor: null,
        values: { name: 'a next', email: 'a-next@example.test' },
      })
      await tx.insert(memberLogin).values({ memberId, userId: 'a-next' })
      const cohortId = await createRecord(tx, {
        kind: 'cohort',
        councilId: a.councilId,
        actor: null,
        values: { name: '2027', startsOn: '2027-03-01', endsOn: '2028-02-29' },
      })
      await createRecord(tx, {
        kind: 'council_membership',
        councilId: a.councilId,
        actor: null,
        values: { memberId, cohortId, councilRank: 'president', startsAt: clockNow },
      })
      return { userId: 'a-next', memberId, cohortId }
    })
    const old = a.people.president
    const cases: { at: string; open: { userId: string; memberId: string }[] }[] = [
      // 2026 기수 시작 전(한국 2025-12-31 23:59:59)
      { at: '2025-12-31T14:59:59Z', open: [] },
      // 2026 기수 시작(한국 2026-01-01 00:00:00)
      { at: '2025-12-31T15:00:00Z', open: [old] },
      // 2026 기수 끝 날짜가 지났고 다음 기수는 아직 시작 전(한국 2027-01-01 00:00:00과 2027-02-28 23:59:59)
      { at: '2026-12-31T15:00:00Z', open: [old] },
      { at: '2027-02-28T14:59:59Z', open: [old] },
      // 2027 기수 시작(한국 2027-03-01 00:00:00): 늦게 시작한 기수가 지금 기수다
      { at: '2027-02-28T15:00:00Z', open: [next] },
      // 2027 기수 끝 날짜도 지난 뒤
      { at: '2029-06-01T03:00:00Z', open: [next] },
    ]
    for (const { at, open } of cases) {
      const now = new Date(at)
      for (const person of [old, next]) {
        const shouldOpen = open.includes(person)
        const actor = await actorOf(db, person.userId, a.councilId, now)
        assert.equal(actor !== null, shouldOpen, `${person.userId} ${at} actorOf`)
        const listed = (await myCouncils(db, person.userId, now)).some(c => c.id === a.councilId)
        assert.equal(listed, shouldOpen, `${person.userId} ${at} myCouncils`)
      }
      // 다른 학생회는 자기 기수(2026-03-01 시작)대로 열린다.
      assert.equal(
        (await actorOf(db, other.people.president.userId, other.councilId, now)) !== null,
        now >= new Date('2026-02-28T15:00:00Z'),
        `other ${at}`,
      )
      const [opener] = open
      if (!opener) continue
      const actor = await actorOf(db, opener.userId, a.councilId, now)
      assert.ok(actor)
      assert.equal(actor.cohortId, opener === next ? next.cohortId : a.cohortId, at)
      // 업무 선택지의 담당자는 지금 기수의 끝나지 않은 소속뿐이다.
      const options = await db.transaction(tx => createOptionsOf(tx, actor, undefined, now))
      const assignees = new Set(
        options.departments.flatMap(row => row.assignees.map(item => item.id)),
      )
      assert.equal(assignees.has(old.memberId), opener === old, `${at} old in options`)
      assert.equal(assignees.has(next.memberId), opener === next, `${at} next in options`)
      assert.equal(assignees.has(a.people.ended.memberId), false, `${at} ended in options`)
      assert.equal(assignees.has(other.people.plain.memberId), false, `${at} other in options`)
    }
  } finally {
    await close()
  }
})
