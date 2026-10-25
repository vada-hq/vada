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

// 지운 메시지의 바탕(0018, 기능 021 조각 8, DEC-54): 본문과 지운 시각은 함께 바뀌고, 파일의 이름과 저장소 위치는 함께 비워진다.
test('0018: 지운 메시지는 본문 없이 지운 시각만 있고, 비운 파일은 이름과 위치를 함께 비운다', async () => {
  const { pg, close } = await createTestDb()
  try {
    const { rows } = await pg.query<{ id: string }>(
      `INSERT INTO record (kind) VALUES ('chat_room'), ('message'), ('file'), ('file') RETURNING id`,
    )
    const [room, msg, photo, other] = rows.map(row => row.id)
    await pg.query(`INSERT INTO chat_room (id, type) VALUES ($1, 'all_members')`, [room])
    await pg.query(
      `INSERT INTO message (id, room_id, body, sent_at) VALUES ($1, $2, '안녕', '2026-10-25T03:00:00Z')`,
      [msg, room],
    )
    for (const [id, key] of [
      [photo, 'chat/a/b/1'],
      [other, 'chat/a/b/2'],
    ])
      await pg.query(
        `INSERT INTO file (id, name, media_type, size_bytes, storage_key, attached_to_id)
         VALUES ($1, 'photo-1.jpg', 'image/jpeg', 10, $2, $3)`,
        [id, key, msg],
      )
    // 본문만 비우거나 지운 시각만 넣으면 막힌다.
    await assert.rejects(pg.query('UPDATE message SET body = NULL WHERE id = $1', [msg]), {
      code: '23514',
    })
    await assert.rejects(pg.query('UPDATE message SET deleted_at = now() WHERE id = $1', [msg]), {
      code: '23514',
    })
    await pg.query('UPDATE message SET body = NULL, deleted_at = now() WHERE id = $1', [msg])
    // 이름이나 위치 하나만 비우면 막힌다. 둘 다 비운 파일은 여럿이어도 위치의 UNIQUE에 걸리지 않는다.
    await assert.rejects(pg.query('UPDATE file SET name = NULL WHERE id = $1', [photo]), {
      code: '23514',
    })
    await assert.rejects(pg.query('UPDATE file SET storage_key = NULL WHERE id = $1', [photo]), {
      code: '23514',
    })
    await pg.query('UPDATE file SET name = NULL, storage_key = NULL')
    const cleared = await pg.query<{ n: string }>(
      'SELECT count(*)::text AS n FROM file WHERE name IS NULL AND storage_key IS NULL',
    )
    assert.equal(cleared.rows[0]!.n, '2')
  } finally {
    await close()
  }
})
