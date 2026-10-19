import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { PGlite } from '@electric-sql/pglite'
import { createTestDb } from '../src/db/test-db.js'
import {
  assignTestMember,
  parseTestDataArgs,
  seedTestCouncil,
  stepOf,
  TEST_INVITE_CODE,
} from './test-data.js'
import { UNREADABLE_TARGET, UNSHOWN_TARGET_MESSAGE } from '../src/db/migrate-check.js'

const now = new Date('2026-10-19T03:00:00Z')

async function googleUser(pg: PGlite, id: string) {
  await pg.query('INSERT INTO users (id, name, email) VALUES ($1, $1, $2)', [
    id,
    `${id}@example.test`,
  ])
  await pg.query(
    "INSERT INTO accounts (id, user_id, provider_id, account_id) VALUES ($1, $2, 'google', $3)",
    [`a-${id}`, id, `sub-${id}`],
  )
}

test('시험 학생회는 다시 돌려도 하나이고, 회장, 초대 코드 TESTDATA, 재정부와 기획부를 맞춘다', async () => {
  const { db, pg, close } = await createTestDb()
  try {
    await googleUser(pg, 'u1')
    await googleUser(pg, 'u2')
    await pg.query(
      "INSERT INTO users (id, name, email) VALUES ('no-google', 'x', 'x@example.test')",
    )
    await assert.rejects(
      seedTestCouncil(db, 'no-google', now),
      /An existing Google user is required/,
    )
    const first = await seedTestCouncil(db, 'u1', now)
    // 화면에서 코드를 바꾼 뒤에 다시 돌려도 TESTDATA로 돌아온다.
    await pg.query("UPDATE invite_code SET code = 'ZZZZ2222'")
    assert.equal(await seedTestCouncil(db, 'u1', now), first)
    assert.equal((await pg.query('SELECT 1 FROM council')).rows.length, 1)
    assert.deepEqual((await pg.query('SELECT code FROM invite_code')).rows, [
      { code: TEST_INVITE_CODE },
    ])
    assert.deepEqual((await pg.query('SELECT name, role FROM department ORDER BY id')).rows, [
      { name: '재정부', role: 'finance' },
      { name: '기획부', role: null },
    ])
    assert.deepEqual(
      (
        await pg.query(`SELECT ml.user_id FROM council_membership cm JOIN member_login ml ON ml.member_id = cm.member_id
      WHERE cm.council_rank = 'president'`)
      ).rows,
      [{ user_id: 'u1' }],
    )
    // 학생회에 들지 않은 계정은 회장이 아니다.
    await assert.rejects(seedTestCouncil(db, 'u2', now), /Test council has another president/)
  } finally {
    await close()
  }
})

test('부서원 넣기는 다시 돌려도 같고, 이미 다른 부서인 사람은 바꾸지 않는다', async () => {
  const { db, pg, close } = await createTestDb()
  try {
    for (const user of ['u1', 'u2', 'u3']) await googleUser(pg, user)
    await assert.rejects(assignTestMember(db, 'u2', 'planning', now), /Seed the test council first/)
    await seedTestCouncil(db, 'u1', now)
    await assignTestMember(db, 'u2', 'planning', now)
    await assignTestMember(db, 'u2', 'planning', now)
    await assert.rejects(
      assignTestMember(db, 'u2', 'finance', now),
      /Existing department assignment cannot be overwritten/,
    )
    await assignTestMember(db, 'u3', 'finance', now)
    const rows =
      await pg.query(`SELECT ml.user_id, d.name FROM department_membership dm JOIN department d ON d.id = dm.department_id
      JOIN member_login ml ON ml.member_id = dm.member_id WHERE dm.ends_at IS NULL ORDER BY ml.user_id`)
    assert.deepEqual(rows.rows, [
      { user_id: 'u2', name: '기획부' },
      { user_id: 'u3', name: '재정부' },
    ])
    assert.equal((await pg.query('SELECT 1 FROM council_membership')).rows.length, 3)
    // 회장이 아닌 운영진(이미 학생회 안에 있는 u2)이 seed를 돌려도 회장을 가져가지 못한다.
    await assert.rejects(seedTestCouncil(db, 'u2', now), /Test council has another president/)
    assert.deepEqual(
      (
        await pg.query(`SELECT ml.user_id FROM council_membership cm JOIN member_login ml ON ml.member_id = cm.member_id
      WHERE cm.council_rank = 'president'`)
      ).rows,
      [{ user_id: 'u1' }],
    )
    assert.deepEqual((await pg.query('SELECT code FROM invite_code')).rows, [
      { code: TEST_INVITE_CODE },
    ])
  } finally {
    await close()
  }
})

test('시험 데이터 인자: --apply 없이는 미리 보기이고, 오타와 개수 틀림은 거절한다', () => {
  assert.deepEqual(parseTestDataArgs(['seed', 'u1', '--apply']), {
    command: 'seed',
    userId: 'u1',
    apply: true,
  })
  assert.deepEqual(parseTestDataArgs(['seed', 'u1']), {
    command: 'seed',
    userId: 'u1',
    apply: false,
  })
  assert.deepEqual(parseTestDataArgs(['assign', 'u2', 'planning', '--apply']), {
    command: 'assign',
    userId: 'u2',
    department: 'planning',
    apply: true,
  })
  assert.deepEqual(parseTestDataArgs(['assign', 'u2', 'finance']), {
    command: 'assign',
    userId: 'u2',
    department: 'finance',
    apply: false,
  })
  const rejected = [
    [],
    ['seed'],
    ['seed', '--apply'],
    ['seed', ' ', '--apply'],
    ['seed', ''],
    ['seed', 'u1', '--aply'],
    ['seed', 'u1', '--apply', '--apply'],
    ['seed', 'u1', 'extra'],
    ['seed', 'u1', '--apply', 'extra'],
    ['Seed', 'u1', '--apply'],
    ['seeds', 'u1', '--apply'],
    ['assign'],
    ['assign', 'u2'],
    ['assign', 'u2', '--apply'],
    ['assign', 'u2', 'planing', '--apply'],
    ['assign', 'u2', 'Planning', '--apply'],
    ['assign', 'u2', 'toString', '--apply'],
    ['assign', 'u2', 'planning', '--aply'],
    ['assign', 'u2', 'planning', '--apply', 'extra'],
    ['assign', '--apply', 'planning'],
    ['assign', ' ', 'planning', '--apply'],
    ['apply', 'u1', '--apply'],
  ]
  for (const args of rejected) assert.equal(parseTestDataArgs(args), null, JSON.stringify(args))
})

test('시험 데이터는 --apply가 없으면 미리 보기로 -- --apply를 안내하고, 대상을 보여 줄 수 없으면 적용하지 않는다', () => {
  const seed = { command: 'seed', userId: 'u1', apply: false } as const
  const assign = { command: 'assign', userId: 'u2', department: 'planning', apply: false } as const
  const preview = stepOf(seed, 'host/db')
  assert.equal(preview.step, 'preview')
  assert.ok('message' in preview && preview.message.includes('-- --apply'), JSON.stringify(preview))
  const assignPreview = stepOf(assign, UNREADABLE_TARGET)
  assert.equal(assignPreview.step, 'preview')
  assert.ok('message' in assignPreview && assignPreview.message.includes('기획부'))
  assert.deepEqual(stepOf({ ...seed, apply: true }, 'host/db'), { step: 'apply' })
  assert.deepEqual(stepOf({ ...assign, apply: true }, 'host/db'), { step: 'apply' })
  assert.deepEqual(stepOf({ ...seed, apply: true }, UNREADABLE_TARGET), {
    step: 'stop',
    message: UNSHOWN_TARGET_MESSAGE,
  })
})
