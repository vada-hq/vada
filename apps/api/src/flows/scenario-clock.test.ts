import assert from 'node:assert/strict'
import { test } from 'node:test'
import { drizzle } from 'drizzle-orm/postgres-js'
import { sql } from 'drizzle-orm'
import postgres from 'postgres'
import { createTestDb } from '../db/test-db.js'
import type { Db } from '../db/types.js'
import { clockNow } from '../records/records.js'
import { createScenarioClock } from './scenario-clock.js'

const START = new Date('2026-11-01T03:00:00Z')
const STEP_MS = 50
const readNow = async (db: Db) => {
  const result = await db.execute(sql`select (${clockNow})::text as t`)
  const rows = (Array.isArray(result) ? result : (result as { rows: unknown[] }).rows) as {
    t: string
  }[]
  return new Date(rows[0]!.t).getTime()
}

test('실제 시각이 밀려도 같은 시나리오 시각의 DB 시계는 뒤로 가지 않는다', async () => {
  const { db, close } = await createTestDb()
  try {
    let real = Date.now()
    const clock = await createScenarioClock(db, START, 'connection', () => new Date(real))
    const first = await readNow(db)
    real += STEP_MS
    await clock.sync()
    assert.ok((await readNow(db)) >= first)
    real += STEP_MS
    await clock.sync()
    assert.ok((await readNow(db)) >= first)
  } finally {
    await close()
  }
})

test('범위가 DB 종류와 맞지 않으면 던진다', async () => {
  const { db, close } = await createTestDb()
  const client = postgres('postgres://nobody@127.0.0.1:1/none', { max: 1 })
  try {
    const now = () => new Date()
    // 연결 풀에는 연결 범위를 걸 수 없다(연결이 섞이고 풀러를 거치면 다른 클라이언트에 샌다).
    await assert.rejects(() => createScenarioClock(drizzle(client), START, 'connection', now))
    // 거래 핸들이 아닌 곳에는 거래 범위가 한 문장으로 끝나 시계가 소리 없이 0이 된다.
    await assert.rejects(() => createScenarioClock(db, START, 'transaction', now))
    await db.transaction(async tx => {
      const inner = tx as unknown as Db
      await assert.rejects(() =>
        createScenarioClock(inner, new Date(Date.now() + 1e7), 'transaction', now),
      )
      const clock = await createScenarioClock(inner, new Date(Date.now() - 1e7), 'transaction', now)
      await assert.rejects(() => clock.advanceBy(2e7))
    })
  } finally {
    await client.end()
    await close()
  }
})
