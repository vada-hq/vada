import assert from 'node:assert/strict'
import { test } from 'node:test'
import { is } from 'drizzle-orm'
import { getTableConfig, PgTable } from 'drizzle-orm/pg-core'
import * as schema from './schema.js'
import { createTestDb, migratedUntil } from './test-db.js'

type Column = { table: string; column: string; type: string; notNull: boolean }
const key = (column: Column) => `${column.table}.${column.column}`
const byKey = (a: Column, b: Column) => key(a).localeCompare(key(b))

// 조회용 정의(schema.ts)와 마이그레이션을 적용한 DB가 같은지 본다: 표, 칸, 타입, NULL 여부(바탕 spec '맞춤 검사').
test('조회용 표 정의가 마이그레이션 DB의 표·칸·타입·NULL 여부와 같다', async () => {
  const tables = Object.values(schema as Record<string, unknown>).filter(
    (value): value is PgTable => is(value, PgTable),
  )
  const defined: Column[] = tables
    .flatMap(table => {
      const config = getTableConfig(table)
      return config.columns.map(column => ({
        table: config.name,
        column: column.name,
        type: column.getSQLType(),
        notNull: column.notNull,
      }))
    })
    .sort(byKey)
  const { pg, close } = await createTestDb()
  try {
    const { rows } = await pg.query<{
      table_name: string
      column_name: string
      data_type: string
      numeric_precision: number | null
      numeric_scale: number | null
      is_nullable: 'YES' | 'NO'
    }>(
      `SELECT table_name, column_name, data_type, numeric_precision, numeric_scale, is_nullable
       FROM information_schema.columns WHERE table_schema = 'public'`,
    )
    const actual: Column[] = rows
      .map(row => ({
        table: row.table_name,
        column: row.column_name,
        type:
          row.data_type === 'numeric'
            ? `numeric(${row.numeric_precision}, ${row.numeric_scale})`
            : row.data_type,
        notNull: row.is_nullable === 'NO',
      }))
      .sort(byKey)
    assert.deepEqual(
      [...new Set(defined.map(column => column.table))].sort(),
      [...new Set(actual.map(column => column.table))].sort(),
    )
    assert.deepEqual(defined, actual)
  } finally {
    await close()
  }
})

// 결재 기록의 결과 허용 값(0013): 품목 취소를 더했고 기존 값은 그대로다.
test('결재 기록의 결과 CHECK가 cancelled를 허용하고 모르는 값은 막는다', async () => {
  const { pg, close } = await createTestDb()
  try {
    const { rows } = await pg.query<{ def: string }>(
      `SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint
       WHERE conrelid = 'approval'::regclass AND conname = 'approval_outcome_check'`,
    )
    const allowed = [...(rows[0]?.def.matchAll(/'([a-z_]+)'/g) ?? [])].map(match => match[1])
    assert.deepEqual(
      allowed.sort((a, b) => (a ?? '').localeCompare(b ?? '')),
      ['approved', 'audited', 'cancelled', 'completed', 'completion_cancelled', 'rejected'],
    )
  } finally {
    await close()
  }
})

// Google 값 비우기(0017, 기능 021 조각 3, DEC-53): 이미 저장된 사진 주소와 토큰을 비우고, 다시 들어가지 못하게 막는다.
test('0017은 저장된 Google 사진과 토큰·만료 시각을 비우고 다른 값은 두며, 새로 넣는 사진과 토큰을 막는다', async () => {
  const { pg, applyTarget } = await migratedUntil('0017_google_values_cleared')
  try {
    await pg.query(
      `INSERT INTO users (id, name, email, image) VALUES
         ('u1', '김', 'kim@example.test', 'https://lh3.googleusercontent.com/a/photo'),
         ('u2', '이', 'lee@example.test', NULL)`,
    )
    await pg.query(
      `INSERT INTO accounts (id, user_id, account_id, provider_id, access_token, refresh_token, id_token,
         access_token_expires_at, refresh_token_expires_at, scope) VALUES
         ('a1', 'u1', 'g-1', 'google', 'ya29.access', '1//refresh', 'eyJ.id',
          '2026-10-25T10:00:00Z', '2027-04-25T10:00:00Z', 'openid email profile'),
         ('a2', 'u2', 'g-2', 'google', NULL, NULL, 'eyJ.only-id', NULL, NULL, 'openid')`,
    )
    await applyTarget()

    const users = await pg.query<{ id: string; name: string; email: string; image: string | null }>(
      'SELECT id, name, email, image FROM users ORDER BY id',
    )
    assert.deepEqual(users.rows, [
      { id: 'u1', name: '김', email: 'kim@example.test', image: null },
      { id: 'u2', name: '이', email: 'lee@example.test', image: null },
    ])
    const accounts = await pg.query(
      `SELECT id, account_id, provider_id, access_token, refresh_token, id_token,
         access_token_expires_at, refresh_token_expires_at, scope FROM accounts ORDER BY id`,
    )
    assert.deepEqual(accounts.rows, [
      {
        id: 'a1',
        account_id: 'g-1',
        provider_id: 'google',
        access_token: null,
        refresh_token: null,
        id_token: null,
        access_token_expires_at: null,
        refresh_token_expires_at: null,
        scope: 'openid email profile',
      },
      {
        id: 'a2',
        account_id: 'g-2',
        provider_id: 'google',
        access_token: null,
        refresh_token: null,
        id_token: null,
        access_token_expires_at: null,
        refresh_token_expires_at: null,
        scope: 'openid',
      },
    ])

    // 로그인(조각 2)처럼 값 없이 넣고 바꾸는 것은 된다.
    await pg.query("INSERT INTO users (id, name, email) VALUES ('u3', '박', 'park@example.test')")
    await pg.query(
      "INSERT INTO accounts (id, user_id, account_id, provider_id) VALUES ('a3', 'u3', 'g-3', 'google')",
    )
    await pg.query("UPDATE accounts SET scope = 'openid' WHERE id = 'a3'")
    // 사진이나 토큰 셋 가운데 하나라도 넣으면 CHECK가 막는다.
    await assert.rejects(
      pg.query(
        "INSERT INTO users (id, name, email, image) VALUES ('u4', '최', 'choi@example.test', 'https://x.test/p')",
      ),
      { code: '23514' },
    )
    await assert.rejects(pg.query("UPDATE users SET image = 'https://x.test/p' WHERE id = 'u1'"), {
      code: '23514',
    })
    for (const column of ['access_token', 'refresh_token', 'id_token']) {
      await assert.rejects(
        pg.query(`UPDATE accounts SET ${column} = 'token' WHERE id = 'a1'`),
        { code: '23514' },
        column,
      )
      await assert.rejects(
        pg.query(
          `INSERT INTO accounts (id, user_id, account_id, provider_id, ${column})
           VALUES ('a-${column}', 'u3', 'g-${column}', 'google', 'token')`,
        ),
        { code: '23514' },
        column,
      )
    }
  } finally {
    await pg.close()
  }
})
