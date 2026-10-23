import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { PGlite } from '@electric-sql/pglite'
import { sql } from 'drizzle-orm'
import type { Db, Tx } from '../src/db/types.js'
import { createTestDb } from '../src/db/test-db.js'
import { actorOf } from '../src/access/actor.js'
import { createFiscalPeriod } from '../src/budget/service.js'
import { roomMap } from '../src/test-support/chat.js'
import {
  assignTestMember,
  parseTestDataArgs,
  seedTestCouncil,
  stepOf,
  TEST_INVITE_CODE,
} from './test-data.js'
import { seedTestPeriods } from './test-data-periods.js'
import { UNREADABLE_TARGET, UNSHOWN_TARGET_MESSAGE } from '../src/ops/migrate/migrate-check.js'

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
    // 부서를 배정하면 부서방이 맞춰진다.
    const councilId = (await pg.query<{ id: string }>('SELECT id FROM council')).rows[0]!.id
    const rooms = await roomMap(pg, councilId)
    assert.deepEqual(rooms['dept:기획부']?.length, 1)
    assert.deepEqual(rooms['dept:재정부']?.length, 1)
    assert.equal(rooms.all?.length, 3)
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

test('이미 있는 시험 학생회를 다시 맞출 때도 학생회 행을 잠근 거래 안에서 방을 맞춘다', async () => {
  const { db, pg, close } = await createTestDb()
  try {
    await googleUser(pg, 'u1')
    await seedTestCouncil(db, 'u1', now)
    // 끝나기 직전(커밋 전) 이 거래가 학생회 행을 잠갔는지 본다. 행 잠금은 xmax에 이 거래 번호를 남긴다.
    let locked: unknown
    const probe = {
      transaction: (run: (tx: Tx) => Promise<unknown>) =>
        db.transaction(async tx => {
          const result = await run(tx)
          const rows = (await tx.execute(
            sql`SELECT xmax::text = pg_current_xact_id()::xid::text AS locked FROM council`,
          )) as unknown as { rows: { locked: boolean }[] }
          locked = rows.rows[0]?.locked
          return result
        }),
    } as unknown as Db
    await seedTestCouncil(probe, 'u1', now)
    assert.equal(locked, true)
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
  assert.ok(
    'message' in preview &&
      preview.message.includes('npm run test-data --workspace @vada/api -- seed u1 --apply'),
    JSON.stringify(preview),
  )
  const assignPreview = stepOf(assign, UNREADABLE_TARGET)
  assert.equal(assignPreview.step, 'preview')
  assert.ok(
    'message' in assignPreview &&
      assignPreview.message.includes('기획부') &&
      assignPreview.message.includes(
        'npm run test-data --workspace @vada/api -- assign u2 planning --apply',
      ),
    JSON.stringify(assignPreview),
  )
  assert.deepEqual(stepOf({ ...seed, apply: true }, 'host/db'), { step: 'apply' })
  assert.deepEqual(stepOf({ ...assign, apply: true }, 'host/db'), { step: 'apply' })
  assert.deepEqual(stepOf({ ...seed, apply: true }, UNREADABLE_TARGET), {
    step: 'stop',
    message: UNSHOWN_TARGET_MESSAGE,
  })
})

test('시험 기간 두기: 끝난 기간을 지금 기간의 이전 기간으로 잇고, 다시 돌려도 바꾸지 않는다', async () => {
  const { db, pg, close } = await createTestDb()
  try {
    for (const user of ['u1', 'u2']) await googleUser(pg, user)
    await seedTestCouncil(db, 'u1', now)
    await assignTestMember(db, 'u2', 'finance', now)
    // 회장은 재정부가 아니라 예산 서비스가 막는다.
    await assert.rejects(seedTestPeriods(db, 'u1', now))
    assert.equal(await seedTestPeriods(db, 'u2', now), 'created')
    const periods = async () =>
      (
        await pg.query(`SELECT p.name, p.starts_on::text AS starts_on, p.ends_on::text AS ends_on, prev.name AS previous
          FROM fiscal_period p LEFT JOIN fiscal_period prev ON prev.id = p.previous_period_id ORDER BY p.starts_on`)
      ).rows
    const created = [
      { name: '시험 1학기', starts_on: '2025-07-04', ends_on: '2025-12-31', previous: null },
      { name: '2026', starts_on: '2026-01-01', ends_on: '2026-12-31', previous: '시험 1학기' },
    ]
    assert.deepEqual(await periods(), created)
    assert.equal((await pg.query('SELECT 1 FROM budget')).rows.length, 2)
    assert.equal(await seedTestPeriods(db, 'u2', now), 'unchanged')
    assert.deepEqual(await periods(), created)
  } finally {
    await close()
  }
})

test('시험 기간 두기: 시험 학생회가 없거나 겹치는 기간이 있으면 멈춘다', async () => {
  const { db, pg, close } = await createTestDb()
  try {
    for (const user of ['u1', 'u2']) await googleUser(pg, user)
    await assert.rejects(seedTestPeriods(db, 'u2', now), /Seed the test council first/)
    await seedTestCouncil(db, 'u1', now)
    await assignTestMember(db, 'u2', 'finance', now)
    // 지금 기간이 없고 앞쪽 날짜가 겹치는 기간이 있다.
    const councilId = (await pg.query<{ id: string }>('SELECT id FROM council')).rows[0]!.id
    await db.transaction(async tx => {
      await createFiscalPeriod(tx, (await actorOf(tx, 'u2', councilId, now))!, {
        name: '겹침',
        startsOn: '2025-10-01',
        endsOn: '2025-12-01',
      })
    })
    await assert.rejects(seedTestPeriods(db, 'u2', now), { code: 'FISCAL_PERIOD_CONFLICT' })
    assert.equal((await pg.query('SELECT 1 FROM fiscal_period')).rows.length, 1)
  } finally {
    await close()
  }
})

test('시험 기간 인자와 안내', () => {
  assert.deepEqual(parseTestDataArgs(['periods', 'u2', '--apply']), {
    command: 'periods',
    userId: 'u2',
    apply: true,
  })
  assert.equal(parseTestDataArgs(['periods', 'u2', 'finance']), null)
  assert.equal(parseTestDataArgs(['periods', '--apply']), null)
  const preview = stepOf({ command: 'periods', userId: 'u2', apply: false }, 'host/db')
  assert.equal(preview.step, 'preview')
  assert.match(preview.step === 'preview' ? preview.message : '', /-- periods u2 --apply/)
})
