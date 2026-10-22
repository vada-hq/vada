import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { PGlite } from '@electric-sql/pglite'
import { dateFromKorean, koreanOf } from '@vada/contracts'
import { createTestDb } from '../src/db/test-db.js'
import { eventStatusOf } from '../src/events/status.js'
import { DEMO_SCHOOL_NAME, seedDemoCouncil } from './demo-data.js'
import { seedTestCouncil } from './test-data.js'

const now = new Date('2026-10-22T03:00:00Z')

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

const count = async (pg: PGlite, table: string, where = 'true') =>
  Number(
    ((await pg.query(`SELECT count(*) AS n FROM ${table} WHERE ${where}`)).rows[0] as { n: string })
      .n,
  )

test('시연 학생회는 회장, 가상 운영진 7명, 부서 셋과 행사·업무·돈·메시지를 넣는다', async () => {
  const { db, pg, close } = await createTestDb()
  try {
    await googleUser(pg, 'u1')
    assert.equal(await seedDemoCouncil(db, 'u1', now), 'created')
    assert.equal(await count(pg, 'council', `school_name = '${DEMO_SCHOOL_NAME}'`), 1)
    assert.equal(await count(pg, 'member'), 8)
    // 가상 운영진은 로그인 계정이 없고, 이메일로 실제 로그인이 이어질 수 없다.
    assert.equal(await count(pg, 'member_login'), 1)
    assert.equal(await count(pg, 'member', "email LIKE '%@demo.vada.invalid'"), 7)
    assert.deepEqual((await pg.query('SELECT name, role FROM department ORDER BY name')).rows, [
      { name: '기획부', role: null },
      { name: '재정부', role: 'finance' },
      { name: '홍보부', role: null },
    ])
    assert.equal(await count(pg, 'fiscal_period'), 1)
    assert.equal(await count(pg, 'budget_item'), 3)
    assert.equal(await count(pg, 'account'), 2)
    assert.equal(await count(pg, 'account', "type = 'main'"), 1)
    assert.equal(await count(pg, 'task'), 6)
    assert.equal(await count(pg, 'task', 'event_id IS NOT NULL'), 4)
    assert.equal(await count(pg, 'message'), 4)
    assert.equal(await count(pg, 'request'), 2)
    assert.equal(await count(pg, 'expense'), 1)
    assert.equal(await count(pg, 'expense', 'reimbursed_at IS NULL AND paid_by IS NOT NULL'), 1)
    assert.equal(await count(pg, 'expense', 'account_id IS NOT NULL'), 1)
    // 회장은 전체방에 들어 있어 메시지가 보인다.
    assert.equal(
      await count(
        pg,
        'room_membership',
        "room_id IN (SELECT id FROM chat_room WHERE type = 'all_members' AND id IN (SELECT room_id FROM message)) AND member_id IN (SELECT member_id FROM member_login WHERE user_id = 'u1')",
      ),
      1,
    )
  } finally {
    await close()
  }
})

test('행사 셋은 끝남, 예정, 날짜 미정이다', async () => {
  const { db, pg, close } = await createTestDb()
  try {
    await googleUser(pg, 'u1')
    await seedDemoCouncil(db, 'u1', now)
    const rows = (await pg.query('SELECT starts_at, ends_at FROM event')).rows as {
      starts_at: Date | null
      ends_at: Date | null
    }[]
    const statuses = rows.map(row => eventStatusOf(row.starts_at, row.ends_at, now)).sort()
    assert.deepEqual(statuses, ['ended', 'tbd', 'upcoming'])
  } finally {
    await close()
  }
})

test('다시 돌리면 아무것도 바꾸지 않고 이미 있다로 멈춘다', async () => {
  const { db, pg, close } = await createTestDb()
  try {
    await googleUser(pg, 'u1')
    await seedDemoCouncil(db, 'u1', now)
    const before = await count(pg, 'record')
    const versions = await count(pg, 'record_version')
    assert.equal(await seedDemoCouncil(db, 'u1', now), 'exists')
    assert.equal(await count(pg, 'record'), before)
    assert.equal(await count(pg, 'record_version'), versions)
  } finally {
    await close()
  }
})

test('Google 계정이 없으면 아무것도 남지 않는다', async () => {
  const { db, pg, close } = await createTestDb()
  try {
    await pg.query("INSERT INTO users (id, name, email) VALUES ('x', 'x', 'x@example.test')")
    await assert.rejects(seedDemoCouncil(db, 'x', now), /An existing Google user is required/)
    assert.equal(await count(pg, 'council'), 0)
  } finally {
    await close()
  }
})

test('시험 학생회와 섞이지 않는다', async () => {
  const { db, pg, close } = await createTestDb()
  try {
    await googleUser(pg, 'u1')
    const testCouncil = await seedTestCouncil(db, 'u1', now)
    await seedDemoCouncil(db, 'u1', now)
    assert.equal(await count(pg, 'council'), 2)
    // 시험 학생회에는 시연 내용이 들어가지 않고, 시험 명령은 시연 학생회를 건드리지 않는다.
    assert.equal(
      await count(pg, 'event', `id IN (SELECT id FROM record WHERE council_id = '${testCouncil}')`),
      0,
    )
    assert.equal(await seedTestCouncil(db, 'u1', now), testCouncil)
    assert.equal(await count(pg, 'council'), 2)
    assert.equal(await count(pg, 'event'), 3)
  } finally {
    await close()
  }
})

// 한국 날짜 경계: 23:59:59와 다음 날 00:00:00에서 날짜가 하루씩 움직이고, 해가 바뀌어도 넣어진다.
for (const [label, instant, today] of [
  ['한국 23:59:59', '2026-10-22T14:59:59Z', '2026-10-22'],
  ['한국 다음 날 00:00:00', '2026-10-22T15:00:00Z', '2026-10-23'],
  ['한국 12-31 23:59:59', '2026-12-31T14:59:59Z', '2026-12-31'],
  ['한국 1-1 00:00:00', '2026-12-31T15:00:00Z', '2027-01-01'],
] as const)
  test(`날짜는 돌리는 날(한국) 기준이다 - ${label}`, async () => {
    const { db, pg, close } = await createTestDb()
    try {
      await googleUser(pg, 'u1')
      const at = new Date(instant)
      assert.equal(await seedDemoCouncil(db, 'u1', at), 'created')
      const rows = (await pg.query('SELECT starts_at, ends_at FROM event')).rows as {
        starts_at: Date | null
        ends_at: Date | null
      }[]
      const statuses = rows.map(row => eventStatusOf(row.starts_at, row.ends_at, at)).sort()
      assert.deepEqual(statuses, ['ended', 'tbd', 'upcoming'])
      const day = 86_400_000
      const todayStart = dateFromKorean(`${today}T00:00`).getTime()
      const starts = rows.flatMap(row => (row.starts_at ? [koreanOf(row.starts_at)] : [])).sort()
      assert.deepEqual(starts, [
        `${koreanOf(new Date(todayStart - 7 * day)).slice(0, 10)}T18:00`,
        `${koreanOf(new Date(todayStart + 10 * day)).slice(0, 10)}T18:00`,
      ])
      const paid = (await pg.query('SELECT paid_at FROM expense')).rows[0] as { paid_at: Date }
      assert.equal(
        koreanOf(paid.paid_at),
        `${koreanOf(new Date(todayStart - 6 * day)).slice(0, 10)}T00:00`,
      )
    } finally {
      await close()
    }
  })
