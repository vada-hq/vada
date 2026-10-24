import assert from 'node:assert/strict'
import { test } from 'node:test'
import { is } from 'drizzle-orm'
import { getTableConfig, PgTable } from 'drizzle-orm/pg-core'
import * as schema from './schema.js'
import { createTestDb } from './test-db.js'

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
