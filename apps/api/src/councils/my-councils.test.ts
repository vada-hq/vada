import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createTestDb } from '../db/test-db.js'
import { clockNow, createRecord } from '../records/records.js'
import { seedCouncil } from '../test-support/council.js'
import { myCouncils } from './queries.js'

// 2026-10-19 12:00 KST
const noon = new Date('2026-10-19T03:00:00Z')

test('내 학생회 목록의 줄마다 그 학생회의 유형과 학교가 있다. 두 학생회에 든 사람도 학생회마다 다르게 받는다', async () => {
  const { db, pg, close } = await createTestDb()
  try {
    const a = await seedCouncil(db, pg, 'a')
    const b = await seedCouncil(db, pg, 'b')
    // 두 학생회는 이름 말고 같은 모양이다. 유형과 학교만 다르게 둬서, 학생회를 잘못 이으면 줄이 틀린다.
    await pg.query(
      "UPDATE council SET unit = 'university', school_name = '서울대학교' WHERE id = $1",
      [b.councilId],
    )
    await db.transaction(tx =>
      createRecord(tx, {
        kind: 'council_membership',
        councilId: b.councilId,
        actor: null,
        values: { memberId: a.people.plain.memberId, cohortId: b.cohortId, startsAt: clockNow },
      }),
    )
    const rows = await myCouncils(db, a.people.plain.userId, noon)
    assert.deepEqual(
      rows
        .map(({ id, unit, schoolName }) => ({ id, unit, schoolName }))
        .sort((x, y) => x.id.localeCompare(y.id)),
      [
        { id: a.councilId, unit: 'department', schoolName: '한양대학교 ERICA' },
        { id: b.councilId, unit: 'university', schoolName: '서울대학교' },
      ].sort((x, y) => x.id.localeCompare(y.id)),
    )
    assert.deepEqual(
      (await myCouncils(db, b.people.president.userId, noon)).map(row => [
        row.unit,
        row.schoolName,
      ]),
      [['university', '서울대학교']],
    )
  } finally {
    await close()
  }
})
