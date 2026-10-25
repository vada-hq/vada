import assert from 'node:assert/strict'
import { test } from 'node:test'
import { eq, inArray } from 'drizzle-orm'
import { cohort, councilMembership, member } from '../db/schema.js'
import { createTestDb } from '../db/test-db.js'
import { clockNow, createRecord } from '../records/records.js'
import { markLeft, seedCouncil } from '../test-support/council.js'
import { displayNameOf } from './display-name.js'

// 학생회 a와 b. a의 기획부원은 b에도 소속이 있다(두 학생회에 모두 있던 사람).
async function setup() {
  const testDb = await createTestDb()
  const { db, pg } = testDb
  const a = await seedCouncil(db, pg, 'a')
  const b = await seedCouncil(db, pg, 'b')
  await db.transaction(tx =>
    createRecord(tx, {
      kind: 'council_membership',
      councilId: b.councilId,
      actor: b.people.president.memberId,
      values: {
        memberId: a.people.planningMember.memberId,
        cohortId: b.cohortId,
        councilRank: null,
        startsAt: clockNow,
      },
    }),
  )
  // 표 하나만 읽는 select. drizzle이 바깥 열의 표 이름을 떼는 경우라 안쪽 조회와 섞이지 않는지 같이 본다.
  const namesIn = async (councilId: string, ids: string[]) =>
    Object.fromEntries(
      (
        await db
          .select({ id: member.id, name: displayNameOf(member, councilId) })
          .from(member)
          .where(inArray(member.id, ids))
      ).map(row => [row.id, row.name]),
    )
  return { ...testDb, a, b, namesIn }
}

test('탈퇴한 운영진은 학생회마다 탈퇴한 차례로 떠난 운영진 N이고, 남은 사람과 내보낸 사람은 이름 그대로다', async () => {
  const { close, a, b, namesIn, pg } = await setup()
  try {
    const { plain, planningMember, ended, financeMember } = a.people
    await markLeft(pg, plain.memberId, '2026-10-20T01:00:00Z')
    await markLeft(pg, planningMember.memberId, '2026-10-21T01:00:00Z')
    const ids = [plain, planningMember, ended, financeMember].map(person => person.memberId)
    assert.deepEqual(await namesIn(a.councilId, ids), {
      [plain.memberId]: '떠난 운영진 1',
      [planningMember.memberId]: '떠난 운영진 2',
      [ended.memberId]: 'a ended',
      [financeMember.memberId]: 'a financeMember',
    })
    // b에서는 b에 소속이 있었던 사람만 센다. a의 plain은 b의 차례에 들지 않는다.
    assert.deepEqual(await namesIn(b.councilId, [planningMember.memberId]), {
      [planningMember.memberId]: '떠난 운영진 1',
    })
    // 나중에 b의 사람이 탈퇴하면 뒤에 붙고, 이미 매긴 번호는 그대로다.
    await markLeft(pg, b.people.plain.memberId, '2026-10-22T01:00:00Z')
    assert.deepEqual(
      await namesIn(b.councilId, [planningMember.memberId, b.people.plain.memberId]),
      { [planningMember.memberId]: '떠난 운영진 1', [b.people.plain.memberId]: '떠난 운영진 2' },
    )
    assert.deepEqual(await namesIn(a.councilId, [planningMember.memberId]), {
      [planningMember.memberId]: '떠난 운영진 2',
    })
  } finally {
    await close()
  }
})

test('같은 시각에 탈퇴했으면 운영진 번호 차례다', async () => {
  const { close, a, namesIn, pg } = await setup()
  try {
    const [first, second] = [a.people.plain.memberId, a.people.planningHead.memberId].sort()
    await markLeft(pg, second!, '2026-10-20T01:00:00Z')
    await markLeft(pg, first!, '2026-10-20T01:00:00Z')
    assert.deepEqual(await namesIn(a.councilId, [first!, second!]), {
      [first!]: '떠난 운영진 1',
      [second!]: '떠난 운영진 2',
    })
  } finally {
    await close()
  }
})

test('학생회 번호를 칸으로 받아 여러 표를 잇는 조회에서도 같은 번호다', async () => {
  const { close, a, db, pg } = await setup()
  try {
    await markLeft(pg, a.people.plain.memberId, '2026-10-20T01:00:00Z')
    await markLeft(pg, a.people.planningMember.memberId, '2026-10-21T01:00:00Z')
    const rows = await db
      .select({ id: member.id, name: displayNameOf(member, cohort.councilId) })
      .from(councilMembership)
      .innerJoin(member, eq(member.id, councilMembership.memberId))
      .innerJoin(cohort, eq(cohort.id, councilMembership.cohortId))
      .where(eq(cohort.councilId, a.councilId))
    const names = new Map(rows.map(row => [row.id, row.name]))
    assert.equal(names.get(a.people.plain.memberId), '떠난 운영진 1')
    assert.equal(names.get(a.people.planningMember.memberId), '떠난 운영진 2')
    assert.equal(names.get(a.people.president.memberId), 'a president')
  } finally {
    await close()
  }
})

test('탈퇴하면 이름과 이메일이 비어야 하고, 탈퇴하지 않았으면 둘 다 있어야 한다(DB CHECK)', async () => {
  const { close, a, pg } = await setup()
  try {
    const id = a.people.plain.memberId
    await assert.rejects(pg.query('UPDATE member SET left_at = now() WHERE id = $1', [id]))
    await assert.rejects(pg.query('UPDATE member SET name = NULL WHERE id = $1', [id]))
    await assert.rejects(
      pg.query('UPDATE member SET left_at = now(), name = NULL WHERE id = $1', [id]),
    )
  } finally {
    await close()
  }
})

test('동의 기록은 로그인 계정을 지워도 남는다', async () => {
  const { close, a, pg } = await setup()
  try {
    const userId = a.people.plain.userId
    await pg.query(
      `INSERT INTO terms_agreement (user_id, terms_version, privacy_version) VALUES ($1, '2026-11-01', '2026-11-01')`,
      [userId],
    )
    await pg.query('DELETE FROM member_login WHERE user_id = $1', [userId])
    await pg.query('DELETE FROM users WHERE id = $1', [userId])
    const { rows } = await pg.query<{ withdrawn_at: Date | null }>(
      'SELECT withdrawn_at FROM terms_agreement WHERE user_id = $1',
      [userId],
    )
    assert.deepEqual(rows, [{ withdrawn_at: null }])
  } finally {
    await close()
  }
})
