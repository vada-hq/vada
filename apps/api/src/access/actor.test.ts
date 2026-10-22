import assert from 'node:assert/strict'
import { test } from 'node:test'
import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/pglite'
import { createTestDb } from '../db/test-db.js'
import { clockNow, createRecord, updateRecord } from '../records/records.js'
import { addUser, seedCouncil } from '../test-support/council.js'
import { actorOf, actorOfMember } from './actor.js'
import { authorize, authorizeChange, councilIdOf, recordIdOf } from './authorize.js'

const inside = new Date('2026-06-01T03:00:00Z')

test('운영진 번호로 열기: 같은 사람이면 actorOf와 같고, 다른 학생회나 끝난 소속은 열리지 않는다', async () => {
  const { db, pg, close } = await createTestDb()
  try {
    const seeded = await seedCouncil(db, pg)
    const other = await seedCouncil(db, pg, 'o')
    const { people, councilId } = seeded
    for (const name of ['president', 'planningHead', 'financeMember', 'plain'] as const) {
      const byLogin = await actorOf(db, people[name].userId, councilId, inside)
      assert.ok(byLogin)
      assert.deepEqual(await actorOfMember(db, people[name].memberId, councilId, inside), byLogin)
    }
    assert.equal(await actorOfMember(db, people.president.memberId, other.councilId, inside), null)
    assert.equal(await actorOfMember(db, people.ended.memberId, councilId, inside), null)
    assert.equal(
      await actorOfMember(
        db,
        people.president.memberId,
        councilId,
        new Date('2027-06-01T03:00:00Z'),
      ),
      null,
    )
  } finally {
    await close()
  }
})

test('지금 소속: 학생회 직급과 지금 부서 소속(부서, 역할, 부서 직급)을 돌려준다', async () => {
  const { db, pg, close } = await createTestDb()
  try {
    const seeded = await seedCouncil(db, pg)
    const { people, departments, councilId, cohortId } = seeded
    const president = await actorOf(db, people.president.userId, councilId, inside)
    assert.deepEqual(
      { ...president, membershipId: undefined },
      {
        memberId: people.president.memberId,
        councilId,
        cohortId,
        membershipId: undefined,
        councilRank: 'president',
        departments: [],
      },
    )
    assert.deepEqual(
      (await actorOf(db, people.financeMember.userId, councilId, inside))?.departments,
      [{ departmentId: departments.finance, role: 'finance', rank: null }],
    )
    assert.deepEqual(
      (await actorOf(db, people.planningViceHead.userId, councilId, inside))?.departments,
      [{ departmentId: departments.planning, role: null, rank: 'vice_head' }],
    )
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

test('끝난 부서 소속과 다른 기수의 부서 소속은 부서 직급도 재정 역할도 주지 않는다', async () => {
  const { db, pg, close } = await createTestDb()
  try {
    const { people, departments, councilId } = await seedCouncil(db, pg)
    const placementOf = async (memberId: string, departmentId: string) => {
      const { rows } = await pg.query<{ id: string }>(
        'SELECT id FROM department_membership WHERE member_id = $1 AND department_id = $2',
        [memberId, departmentId],
      )
      return rows[0]!.id
    }
    const financeId = await placementOf(people.financeMember.memberId, departments.finance)
    const headId = await placementOf(people.planningHead.memberId, departments.planning)
    // 지금 소속이 있는 동안에는 보인다. 끝내면 빠진다.
    assert.equal(
      (await actorOf(db, people.financeMember.userId, councilId, inside))?.departments.length,
      1,
    )
    await db.transaction(async tx => {
      await updateRecord(tx, {
        kind: 'department_membership',
        id: financeId,
        actor: null,
        reason: null,
        changes: { endsAt: clockNow },
      })
      await updateRecord(tx, {
        kind: 'department_membership',
        id: headId,
        actor: null,
        reason: null,
        changes: { endsAt: clockNow },
      })
    })
    assert.deepEqual(
      (await actorOf(db, people.financeMember.userId, councilId, inside))?.departments,
      [],
    )
    assert.deepEqual(
      (await actorOf(db, people.planningHead.userId, councilId, inside))?.departments,
      [],
    )
    // 지난 기수에 열려 있는(끝나지 않은) 재정부·기획부장 소속은 지금 기수의 권한이 아니다.
    await db.transaction(async tx => {
      const cohortId = await createRecord(tx, {
        kind: 'cohort',
        councilId,
        actor: null,
        values: { name: '2025', startsOn: '2025-01-01', endsOn: '2025-12-31' },
      })
      await createRecord(tx, {
        kind: 'department_membership',
        councilId,
        actor: null,
        values: {
          memberId: people.plain.memberId,
          departmentId: departments.finance,
          cohortId,
          startsAt: clockNow,
        },
      })
      await createRecord(tx, {
        kind: 'department_membership',
        councilId,
        actor: null,
        values: {
          memberId: people.plain.memberId,
          departmentId: departments.planning,
          cohortId,
          departmentRank: 'head',
          startsAt: clockNow,
        },
      })
    })
    const plain = await actorOf(db, people.plain.userId, councilId, inside)
    assert.equal(plain?.councilRank, null)
    assert.deepEqual(plain?.departments, [])
    // 지금 기수에 같은 부서 소속이 있으면 그 기수 것만 보인다.
    await db.transaction(tx =>
      createRecord(tx, {
        kind: 'department_membership',
        councilId,
        actor: null,
        values: {
          memberId: people.plain.memberId,
          departmentId: departments.planning,
          cohortId: plain.cohortId,
          startsAt: clockNow,
        },
      }),
    )
    assert.deepEqual((await actorOf(db, people.plain.userId, councilId, inside))?.departments, [
      { departmentId: departments.planning, role: null, rank: null },
    ])
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
    await assert.rejects(
      authorize(db, {
        userId: 'stranger',
        councilId: councilId,
        action: 'council.view',
        now: inside,
      }),
      {
        code: 'FORBIDDEN',
        status: 403,
      },
    )
    await assert.rejects(
      authorize(db, {
        userId: people.ended.userId,
        councilId: councilId,
        action: 'council.view',
        now: inside,
      }),
      {
        code: 'FORBIDDEN',
        status: 403,
      },
    )
    await assert.rejects(
      authorize(db, {
        userId: people.planningHead.userId,
        councilId: councilId,
        action: 'member.manage',
        now: inside,
      }),
      { code: 'FORBIDDEN', status: 403 },
    )
    assert.equal(
      (
        await authorize(db, {
          userId: people.plain.userId,
          councilId: councilId,
          action: 'council.view',
          now: inside,
        })
      ).memberId,
      people.plain.memberId,
    )
    const actor = await db.transaction(tx =>
      authorizeChange(tx, {
        userId: people.vicePresident.userId,
        councilId: councilId,
        action: 'member.manage',
        now: inside,
      }),
    )
    assert.equal(actor.councilRank, 'vice_president')
  } finally {
    await close()
  }
})

test('authorizeChange: 권한을 보기 전에 학생회 행을 FOR NO KEY UPDATE로 잠그고, 칸이 없는 사람은 잠근 뒤에 403이다', async () => {
  const { pg, close } = await createTestDb()
  try {
    const queries: string[] = []
    const db = drizzle(pg, {
      logger: {
        logQuery: query => {
          queries.push(query)
        },
      },
    })
    const { people, councilId } = await seedCouncil(db, pg)
    queries.length = 0
    const held = await db.transaction(async tx => {
      const actor = await authorizeChange(tx, {
        userId: people.vicePresident.userId,
        councilId,
        action: 'member.manage',
        now: inside,
      })
      assert.equal(actor.memberId, people.vicePresident.memberId)
      // 잠금을 건 문장은 council 표를 FOR NO KEY UPDATE로 읽고, 그 문장이 소속을 읽는 문장보다 먼저다.
      const lock = queries.findIndex(query => query.includes('from "council"'))
      assert.ok(lock >= 0)
      assert.match(queries[lock]!, / for no key update$/)
      assert.ok(queries.findIndex(query => query.includes('"member_login"')) > lock)
      // 거래가 끝나기 전에 council 표의 행 잠금(RowShareLock)을 쥐고 있다. 보통의 읽기(AccessShareLock)가 아니다.
      return tx.execute(
        sql`SELECT mode FROM pg_locks WHERE locktype = 'relation' AND relation = 'council'::regclass AND pid = pg_backend_pid()`,
      )
    })
    assert.ok(
      held.rows.some(row => (row as { mode: string }).mode === 'RowShareLock'),
      JSON.stringify(held.rows),
    )
    // 칸이 없는 사람(부장은 member.manage가 없다)은 403이고, 소속이 없는 사람도 403이다.
    await addUser(pg, 'stranger')
    for (const user of [people.planningHead.userId, people.ended.userId, 'stranger']) {
      await assert.rejects(
        db.transaction(tx =>
          authorizeChange(tx, {
            userId: user,
            councilId: councilId,
            action: 'member.manage',
            now: inside,
          }),
        ),
        { code: 'FORBIDDEN', status: 403 },
        user,
      )
    }
  } finally {
    await close()
  }
})

test('학생회 번호 형식이 틀리면 authorize와 authorizeChange가 스스로 403으로 막는다(DB 오류 500이 아니다)', async () => {
  const { db, pg, close } = await createTestDb()
  try {
    const { people, councilId } = await seedCouncil(db, pg)
    for (const bad of ['not-a-uuid', '', "' OR 1=1 --", councilId.slice(1)]) {
      await assert.rejects(
        authorize(db, {
          userId: people.president.userId,
          councilId: bad,
          action: 'council.view',
          now: inside,
        }),
        { code: 'FORBIDDEN', status: 403 },
        bad,
      )
      await assert.rejects(
        db.transaction(tx =>
          authorizeChange(tx, {
            userId: people.president.userId,
            councilId: bad,
            action: 'member.manage',
            now: inside,
          }),
        ),
        { code: 'FORBIDDEN', status: 403 },
        bad,
      )
    }
    // 대문자 uuid는 같은 번호로 받아 소문자로 돌려준다.
    assert.equal(
      (
        await authorize(db, {
          userId: people.president.userId,
          councilId: councilId.toUpperCase(),
          action: 'council.view',
          now: inside,
        })
      ).councilId,
      councilId,
    )
  } finally {
    await close()
  }
})

test('경로 번호: 학생회 번호가 uuid가 아니면 403, 운영진·부서 번호가 uuid가 아니면 404다', () => {
  assert.equal(
    councilIdOf('0192F2A0-0000-7000-8000-000000000001'),
    '0192f2a0-0000-7000-8000-000000000001',
  )
  for (const value of [
    undefined,
    '',
    'probe',
    '0192f2a0-0000-7000-8000-00000000000',
    "' OR 1=1 --",
  ]) {
    assert.throws(() => councilIdOf(value), { code: 'FORBIDDEN', status: 403 })
    assert.throws(() => recordIdOf(value), { code: 'NOT_FOUND', status: 404 })
  }
})
