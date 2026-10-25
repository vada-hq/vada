import assert from 'node:assert/strict'
import { test } from 'node:test'
import { sql } from 'drizzle-orm'
import { createTestDb } from '../db/test-db.js'
import { CLOCK_OFFSET_SETTING, createRecord, updateRecord } from './records.js'

const DAY_MS = 24 * 60 * 60 * 1000
const THREE_DAYS = 3 * DAY_MS
const WITHIN = 1000

type Db = Awaited<ReturnType<typeof createTestDb>>['db']
const setOffset = (db: Db, value: string, local = false) =>
  db.execute(sql`select set_config(${CLOCK_OFFSET_SETTING}, ${value}, ${local})`)
let counter = 0
const makeMember = (db: Db) =>
  db.transaction(async tx => {
    counter += 1
    const id = await createRecord(tx, {
      kind: 'member',
      councilId: null,
      actor: null,
      values: { name: `시계 ${counter}`, email: `clock-${counter}@example.test` },
    })
    const rows = await tx.execute(
      sql`select r.created_at::text as created, lower(v.valid)::text as started
        from record r join record_version v on v.record_id = r.id where r.id = ${id}`,
    )
    const row = (Array.isArray(rows) ? rows[0] : rows.rows[0]) as {
      created: string
      started: string
    }
    return { id, created: new Date(row.created), started: new Date(row.started) }
  })
const near = (actual: Date, expected: number) =>
  assert.ok(Math.abs(actual.getTime() - expected) < WITHIN, `${actual.toISOString()}`)

test('설정을 걸지 않은 연결의 기록 시각은 실제 시각이다', async () => {
  const { db, close } = await createTestDb()
  try {
    const made = await makeMember(db)
    near(made.created, Date.now())
    near(made.started, Date.now())
  } finally {
    await close()
  }
})

test('설정을 건 연결은 그 간격만큼 뒤의 기록 시각을 쓰고 판이 이어진다', async () => {
  const { db, close } = await createTestDb()
  try {
    await setOffset(db, `${THREE_DAYS} milliseconds`)
    const made = await makeMember(db)
    near(made.created, Date.now() + THREE_DAYS)
    near(made.started, Date.now() + THREE_DAYS)
    await db.transaction(tx =>
      updateRecord(tx, {
        kind: 'member',
        id: made.id,
        actor: null,
        reason: null,
        changes: { name: '바뀐 이름' },
      }),
    )
    const rows = await db.execute(
      sql`select version_no, lower(valid)::text as lo, upper(valid)::text as hi
        from record_version where record_id = ${made.id} order by version_no`,
    )
    const list = (Array.isArray(rows) ? rows : rows.rows) as { lo: string; hi: string | null }[]
    assert.equal(list.length, 2)
    assert.equal(list[0]!.hi, list[1]!.lo)
    near(new Date(list[1]!.lo), Date.now() + THREE_DAYS)
  } finally {
    await close()
  }
})

test('설정을 비우면 실제 시각으로 돌아오고, 거래 안에서만 건 설정은 거래가 끝나면 사라진다', async () => {
  const { db, close } = await createTestDb()
  try {
    await setOffset(db, `${THREE_DAYS} milliseconds`)
    await setOffset(db, '')
    near((await makeMember(db)).created, Date.now())
    const inside = await db.transaction(async tx => {
      await setOffset(tx as unknown as Db, `${THREE_DAYS} milliseconds`, true)
      return makeMember(tx as unknown as Db)
    })
    near(inside.created, Date.now() + THREE_DAYS)
    near((await makeMember(db)).created, Date.now())
  } finally {
    await close()
  }
})

test('다른 연결에는 새지 않는다', async () => {
  const first = await createTestDb()
  const second = await createTestDb()
  try {
    await setOffset(first.db, `${THREE_DAYS} milliseconds`)
    near((await makeMember(second.db)).created, Date.now())
    near((await makeMember(first.db)).created, Date.now() + THREE_DAYS)
  } finally {
    await first.close()
    await second.close()
  }
})
