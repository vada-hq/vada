import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createTestDb } from '../db/test-db.js'
import { addUser, seedCouncil } from '../test-support/council.js'
import { actorOf, koreanDate } from './actor.js'
import { authorize, authorizeChange, councilIdOf, recordIdOf } from './authorize.js'

const inside = new Date('2026-06-01T03:00:00Z')

test('지금 소속: 학생회 직급과 지금 부서 소속(부서, 역할, 부서 직급)을 돌려준다', async () => {
  const { db, pg, close } = await createTestDb()
  try {
    const seeded = await seedCouncil(db, pg)
    const { people, departments, councilId, cohortId } = seeded
    const president = await actorOf(db, people.president.userId, councilId, inside)
    assert.deepEqual({ ...president, membershipId: undefined }, { memberId: people.president.memberId, councilId, cohortId, membershipId: undefined,
      councilRank: 'president', departments: [] })
    assert.deepEqual((await actorOf(db, people.financeMember.userId, councilId, inside))?.departments,
      [{ departmentId: departments.finance, role: 'finance', rank: null }])
    assert.deepEqual((await actorOf(db, people.planningViceHead.userId, councilId, inside))?.departments,
      [{ departmentId: departments.planning, role: null, rank: 'vice_head' }])
    assert.equal((await actorOf(db, people.plain.userId, councilId, inside))?.councilRank, null)
  } finally {
    await close()
  }
})

test('끝난 소속, 잇지 않은 계정, 다른 학생회 사람은 지금 소속이 없다', async () => {
  const { db, pg, close } = await createTestDb()
  try {
    const first = await seedCouncil(db, pg, 'a')
    const second = await seedCouncil(db, pg, 'b')
    await addUser(pg, 'stranger')
    assert.equal(await actorOf(db, first.people.ended.userId, first.councilId, inside), null)
    assert.equal(await actorOf(db, 'stranger', first.councilId, inside), null)
    assert.equal(await actorOf(db, second.people.president.userId, first.councilId, inside), null)
  } finally {
    await close()
  }
})

test('기간이 지난 기수의 사람은 막힌다. 날짜는 서버 시간대가 아니라 한국 날짜로 센다', async () => {
  const { db, pg, close } = await createTestDb()
  try {
    const { people, councilId } = await seedCouncil(db, pg)
    const user = people.plain.userId
    // 2026-01-01 00:00 KST는 2025-12-31 15:00 UTC다.
    assert.equal(koreanDate(new Date('2025-12-31T15:00:00Z')), '2026-01-01')
    assert.equal(await actorOf(db, user, councilId, new Date('2025-12-31T14:59:59Z')), null)
    assert.notEqual(await actorOf(db, user, councilId, new Date('2025-12-31T15:00:00Z')), null)
    assert.notEqual(await actorOf(db, user, councilId, new Date('2026-12-31T14:59:59Z')), null)
    assert.equal(await actorOf(db, user, councilId, new Date('2026-12-31T15:00:00Z')), null)
  } finally {
    await close()
  }
})

test('authorize: 운영진이 아니거나 권한이 없으면 403이고, 바꾸기는 학생회를 잠근 뒤 다시 본다', async () => {
  const { db, pg, close } = await createTestDb()
  try {
    const { people, councilId } = await seedCouncil(db, pg)
    await addUser(pg, 'stranger')
    await assert.rejects(authorize(db, 'stranger', councilId, 'council.view', inside), { code: 'FORBIDDEN', status: 403 })
    await assert.rejects(authorize(db, people.ended.userId, councilId, 'council.view', inside), { code: 'FORBIDDEN', status: 403 })
    await assert.rejects(authorize(db, people.planningHead.userId, councilId, 'member.manage', inside), { code: 'FORBIDDEN', status: 403 })
    assert.equal((await authorize(db, people.plain.userId, councilId, 'council.view', inside)).memberId, people.plain.memberId)
    const actor = await db.transaction(tx => authorizeChange(tx, people.vicePresident.userId, councilId, 'member.manage', inside))
    assert.equal(actor.councilRank, 'vice_president')
  } finally {
    await close()
  }
})

test('경로 번호: 학생회 번호가 uuid가 아니면 403, 운영진·부서 번호가 uuid가 아니면 404다', () => {
  assert.equal(councilIdOf('0192F2A0-0000-7000-8000-000000000001'), '0192f2a0-0000-7000-8000-000000000001')
  for (const value of [undefined, '', 'probe', '0192f2a0-0000-7000-8000-00000000000', "' OR 1=1 --"]) {
    assert.throws(() => councilIdOf(value), { code: 'FORBIDDEN', status: 403 })
    assert.throws(() => recordIdOf(value), { code: 'NOT_FOUND', status: 404 })
  }
})
