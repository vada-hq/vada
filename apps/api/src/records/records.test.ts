import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { PGlite } from '@electric-sql/pglite'
import { createTestDb } from '../db/test-db.js'
import { clockNow, createRecord, updateRecord, updateRecords, type AnyRecordChange, type Tx } from './records.js'

type Version = { version_no: number; lower: string; upper: string | null; data: Record<string, unknown>; changed_by: string | null; reason: string | null }
const versionsOf = async (pg: PGlite, id: string) => (await pg.query<Version>(
  `SELECT version_no, lower(valid)::text AS lower, upper(valid)::text AS upper, data, changed_by, reason
   FROM record_version WHERE record_id = $1 ORDER BY version_no`, [id])).rows

// 학생회와 기수, 운영진 둘을 만든다. 운영진은 시스템이 만든 것으로 둔다(만든 사람 없음).
async function seed(tx: Tx) {
  const kim = await createRecord(tx, { kind: 'member', councilId: null, actor: null, values: { name: '김회장', email: 'kim@example.test' } })
  const lee = await createRecord(tx, { kind: 'member', councilId: null, actor: null, values: { name: '이부원', email: 'lee@example.test' } })
  const council = await createRecord(tx, { kind: 'council', councilId: null, actor: kim,
    values: { name: '컴퓨터학부 학생회', unit: 'department', schoolName: '한양대학교 ERICA' } })
  const cohort = await createRecord(tx, { kind: 'cohort', councilId: council, actor: kim, values: { name: '2026', startsOn: '2026-01-01', endsOn: '2026-12-31' } })
  return { kim, lee, council, cohort }
}

test('만들기는 기록, 하위 행, 판 1을 한 번에 만들고 판에 하위 행의 칸 값 전체를 담는다', async () => {
  const { db, pg, close } = await createTestDb()
  try {
    const { kim, council, cohort } = await db.transaction(seed)
    const [row] = (await pg.query<{ kind: string; council_id: string | null; created_by: string | null; created_at: string }>(
      'SELECT kind, council_id, created_by, created_at::text FROM record WHERE id = $1', [council])).rows
    assert.deepEqual({ ...row, created_at: undefined }, { kind: 'council', council_id: null, created_by: kim, created_at: undefined })
    const versions = await versionsOf(pg, council)
    assert.equal(versions.length, 1)
    assert.equal(versions[0]!.lower, row!.created_at)
    assert.equal(versions[0]!.upper, null)
    assert.equal(versions[0]!.changed_by, kim)
    assert.deepEqual(versions[0]!.data, { id: council, kind: 'council', name: '컴퓨터학부 학생회', unit: 'department', school_name: '한양대학교 ERICA',
      president_title: '회장', vice_president_title: '부회장', head_title: '부장', vice_head_title: '부부장' })
    // 기수는 하위 행에도 학생회 번호를 둔다. 모듈이 기록의 학생회 번호를 넣는다.
    assert.deepEqual((await pg.query('SELECT council_id FROM cohort WHERE id = $1', [cohort])).rows, [{ council_id: council }])
    assert.deepEqual((await pg.query('SELECT council_id FROM record WHERE id = $1', [cohort])).rows, [{ council_id: council }])
    // 시스템이 만든 운영진은 만든 사람과 판 1의 바꾼 사람을 비운다.
    assert.equal((await versionsOf(pg, kim))[0]!.changed_by, null)
  } finally {
    await close()
  }
})

test('바꾸기는 지금 판을 닫고 새 판을 열며, 바꾼 사람과 사유를 새 판에 둔다', async () => {
  const { db, pg, close } = await createTestDb()
  try {
    const { kim, lee, council } = await db.transaction(seed)
    await db.transaction(tx => updateRecord(tx, { kind: 'council', id: council, actor: lee, reason: null, changes: { name: '소프트웨어학부 학생회' } }))
    const versions = await versionsOf(pg, council)
    assert.deepEqual(versions.map(version => [version.version_no, version.changed_by, version.data.name]),
      [[1, kim, '컴퓨터학부 학생회'], [2, lee, '소프트웨어학부 학생회']])
    assert.equal(versions[0]!.upper, versions[1]!.lower)
    assert.equal(versions[1]!.upper, null)
    assert.deepEqual((await pg.query('SELECT name FROM council WHERE id = $1', [council])).rows, [{ name: '소프트웨어학부 학생회' }])
  } finally {
    await close()
  }
})

test('한 거래에서 두 번 바꿔도 판이 겹치거나 비지 않고 이어진다', async () => {
  const { db, pg, close } = await createTestDb()
  try {
    const { kim, council } = await db.transaction(seed)
    await db.transaction(async tx => {
      await updateRecord(tx, { kind: 'council', id: council, actor: kim, reason: null, changes: { name: '하나' } })
      await updateRecord(tx, { kind: 'council', id: council, actor: kim, reason: null, changes: { name: '둘' } })
    })
    const versions = await versionsOf(pg, council)
    assert.deepEqual(versions.map(version => version.data.name), ['컴퓨터학부 학생회', '하나', '둘'])
    for (let index = 1; index < versions.length; index++) {
      assert.equal(versions[index]!.lower, versions[index - 1]!.upper)
      assert.ok(versions[index - 1]!.lower < versions[index - 1]!.upper!, '판의 기간이 비지 않는다')
    }
  } finally {
    await close()
  }
})

test('확정한 기록은 사유 없이 바꿀 수 없고, 사유를 주면 판에 남는다', async () => {
  const { db, pg, close } = await createTestDb()
  try {
    const { kim, council } = await db.transaction(seed)
    await pg.query('UPDATE record SET confirmed_by = $1, confirmed_at = now() WHERE id = $2', [kim, council])
    for (const reason of [null, '', '   ']) {
      await assert.rejects(db.transaction(tx => updateRecord(tx, { kind: 'council', id: council, actor: kim, reason, changes: { name: '바꿈' } })),
        { code: 'REASON_REQUIRED', status: 400 })
    }
    assert.equal((await versionsOf(pg, council)).length, 1)
    await db.transaction(tx => updateRecord(tx, { kind: 'council', id: council, actor: kim, reason: '회칙 개정', changes: { name: '바꿈' } }))
    assert.equal((await versionsOf(pg, council))[1]!.reason, '회칙 개정')
  } finally {
    await close()
  }
})

test('학생회 번호 규칙: 학생회와 운영진만 비우고, 소속은 기수와 부서의 학생회와 같아야 한다', async () => {
  const { db, close } = await createTestDb()
  try {
    const first = await db.transaction(seed)
    const other = await db.transaction(async tx => {
      const council = await createRecord(tx, { kind: 'council', councilId: null, actor: first.kim, values: { name: '경영학부 학생회', unit: 'department', schoolName: '한양대학교 ERICA' } })
      const department = await createRecord(tx, { kind: 'department', councilId: council, actor: first.kim, values: { name: '재정부', role: 'finance' } })
      return { council, department }
    })
    const attempts: ((tx: Tx) => Promise<unknown>)[] = [
      tx => createRecord(tx, { kind: 'member', councilId: first.council, actor: null, values: { name: '박', email: 'park@example.test' } }),
      tx => createRecord(tx, { kind: 'council', councilId: first.council, actor: null, values: { name: 'x', unit: 'college', schoolName: 'y' } }),
      tx => createRecord(tx, { kind: 'cohort', councilId: null, actor: null, values: { name: '2027', startsOn: '2027-01-01', endsOn: '2027-12-31' } }),
      tx => createRecord(tx, { kind: 'council_membership', councilId: other.council, actor: first.kim,
        values: { memberId: first.lee, cohortId: first.cohort, startsAt: clockNow } }),
      tx => createRecord(tx, { kind: 'department_membership', councilId: first.council, actor: first.kim,
        values: { memberId: first.lee, departmentId: other.department, cohortId: first.cohort, startsAt: clockNow } }),
    ]
    for (const attempt of attempts) await assert.rejects(db.transaction(attempt))
  } finally {
    await close()
  }
})

test('회장이 없어지는 변경은 막고, 한 번에 거두고 주는 회장 넘기기는 받는다', async () => {
  const { db, pg, close } = await createTestDb()
  try {
    const { kim, lee, council, cohort } = await db.transaction(seed)
    const [president, member] = await db.transaction(async tx => [
      await createRecord(tx, { kind: 'council_membership', councilId: council, actor: kim, values: { memberId: kim, cohortId: cohort, councilRank: 'president', startsAt: clockNow } }),
      await createRecord(tx, { kind: 'council_membership', councilId: council, actor: kim, values: { memberId: lee, cohortId: cohort, startsAt: clockNow } }),
    ])
    for (const changes of [{ councilRank: null }, { councilRank: 'vice_president' as const }, { endsAt: clockNow }]) {
      await assert.rejects(db.transaction(tx => updateRecord(tx, { kind: 'council_membership', id: president!, actor: kim, reason: null, changes })),
        { code: 'PRESIDENT_REQUIRED', status: 409 })
    }
    await db.transaction(tx => updateRecords(tx, [
      { kind: 'council_membership', id: president!, actor: kim, reason: null, changes: { councilRank: null } },
      { kind: 'council_membership', id: member!, actor: kim, reason: null, changes: { councilRank: 'president' } },
    ]))
    assert.deepEqual((await pg.query('SELECT member_id FROM council_membership WHERE council_rank = $1', ['president'])).rows, [{ member_id: lee }])
    assert.deepEqual((await versionsOf(pg, president!)).map(version => version.data.council_rank), ['president', null])
    assert.deepEqual((await versionsOf(pg, member!)).map(version => version.data.council_rank), [null, 'president'])
  } finally {
    await close()
  }
})

test('주인 칸(학생회·기수·부서·운영진 번호)은 바꾸지 않는다. 같은 학생회인지는 만들 때만 보기 때문이다', async () => {
  const { db, pg, close } = await createTestDb()
  try {
    const { kim, lee, council, cohort } = await db.transaction(seed)
    const ids = await db.transaction(async tx => {
      const next = await createRecord(tx, { kind: 'cohort', councilId: council, actor: kim, values: { name: '2027', startsOn: '2027-01-01', endsOn: '2027-12-31' } })
      const department = await createRecord(tx, { kind: 'department', councilId: council, actor: kim, values: { name: '기획부' } })
      const membership = await createRecord(tx, { kind: 'council_membership', councilId: council, actor: kim, values: { memberId: lee, cohortId: cohort, startsAt: clockNow } })
      const placement = await createRecord(tx, { kind: 'department_membership', councilId: council, actor: kim,
        values: { memberId: lee, departmentId: department, cohortId: cohort, startsAt: clockNow } })
      return { next, department, membership, placement }
    })
    const attempts: AnyRecordChange[] = [
      { kind: 'cohort', id: cohort, actor: kim, reason: null, changes: { councilId: council } },
      { kind: 'council_membership', id: ids.membership, actor: kim, reason: null, changes: { cohortId: ids.next } },
      { kind: 'council_membership', id: ids.membership, actor: kim, reason: null, changes: { memberId: kim } },
      { kind: 'department_membership', id: ids.placement, actor: kim, reason: null, changes: { departmentId: ids.department } },
      // drizzle 칸 이름이 아닌 DB 칸 이름으로 넘겨도 막는다.
      { kind: 'department', id: ids.department, actor: kim, reason: null, changes: { council_id: council } as never },
    ]
    for (const change of attempts) await assert.rejects(db.transaction(tx => updateRecords(tx, [change])), /주인 칸/, change.kind)
    for (const id of [cohort, ids.membership, ids.placement, ids.department]) assert.equal((await versionsOf(pg, id)).length, 1)
  } finally {
    await close()
  }
})

test('없는 기록을 바꾸면 404다', async () => {
  const { db, close } = await createTestDb()
  try {
    await db.transaction(seed)
    await assert.rejects(db.transaction(tx => updateRecord(tx, { kind: 'council', id: '01900000-0000-7000-8000-000000000000', actor: null, reason: null, changes: { name: 'x' } })),
      { code: 'NOT_FOUND', status: 404 })
  } finally {
    await close()
  }
})
