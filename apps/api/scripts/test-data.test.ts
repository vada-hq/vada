import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { PGlite } from '@electric-sql/pglite'
import { createTestDb } from '../src/db/test-db.js'
import { assignTestMember, seedTestCouncil, TEST_INVITE_CODE } from './test-data.js'

const now = new Date('2026-10-19T03:00:00Z')

async function googleUser(pg: PGlite, id: string) {
  await pg.query('INSERT INTO users (id, name, email) VALUES ($1, $1, $2)', [id, `${id}@example.test`])
  await pg.query("INSERT INTO accounts (id, user_id, provider_id, account_id) VALUES ($1, $2, 'google', $3)", [`a-${id}`, id, `sub-${id}`])
}

test('시험 학생회는 다시 돌려도 하나이고, 회장, 초대 코드 TESTDATA, 재정부와 기획부를 맞춘다', async () => {
  const { db, pg, close } = await createTestDb()
  try {
    await googleUser(pg, 'u1')
    await googleUser(pg, 'u2')
    await pg.query("INSERT INTO users (id, name, email) VALUES ('no-google', 'x', 'x@example.test')")
    await assert.rejects(seedTestCouncil(db, 'no-google', now))
    const first = await seedTestCouncil(db, 'u1', now)
    // 화면에서 코드를 바꾼 뒤에 다시 돌려도 TESTDATA로 돌아온다.
    await pg.query("UPDATE invite_code SET code = 'ZZZZ2222'")
    assert.equal(await seedTestCouncil(db, 'u1', now), first)
    assert.equal((await pg.query('SELECT 1 FROM council')).rows.length, 1)
    assert.deepEqual((await pg.query('SELECT code FROM invite_code')).rows, [{ code: TEST_INVITE_CODE }])
    assert.deepEqual((await pg.query('SELECT name, role FROM department ORDER BY id')).rows, [{ name: '재정부', role: 'finance' }, { name: '기획부', role: null }])
    assert.deepEqual((await pg.query(`SELECT ml.user_id FROM council_membership cm JOIN member_login ml ON ml.member_id = cm.member_id
      WHERE cm.council_rank = 'president'`)).rows, [{ user_id: 'u1' }])
    await assert.rejects(seedTestCouncil(db, 'u2', now))
  } finally {
    await close()
  }
})

test('부서원 넣기는 다시 돌려도 같고, 이미 다른 부서인 사람은 바꾸지 않는다', async () => {
  const { db, pg, close } = await createTestDb()
  try {
    for (const user of ['u1', 'u2', 'u3']) await googleUser(pg, user)
    await assert.rejects(assignTestMember(db, 'u2', 'planning', now))
    await seedTestCouncil(db, 'u1', now)
    await assignTestMember(db, 'u2', 'planning', now)
    await assignTestMember(db, 'u2', 'planning', now)
    await assert.rejects(assignTestMember(db, 'u2', 'finance', now))
    await assignTestMember(db, 'u3', 'finance', now)
    const rows = await pg.query(`SELECT ml.user_id, d.name FROM department_membership dm JOIN department d ON d.id = dm.department_id
      JOIN member_login ml ON ml.member_id = dm.member_id WHERE dm.ends_at IS NULL ORDER BY ml.user_id`)
    assert.deepEqual(rows.rows, [{ user_id: 'u2', name: '기획부' }, { user_id: 'u3', name: '재정부' }])
    assert.equal((await pg.query('SELECT 1 FROM council_membership')).rows.length, 3)
  } finally {
    await close()
  }
})
