import assert from 'node:assert/strict'
import { test } from 'node:test'
import { getTableName } from 'drizzle-orm'
import { createTestDb } from '../db/test-db.js'
import { BUDGET_ITEM_REFERENCES } from './item-facts.js'

// '쓰인 적 있음'(지우기 막기)은 예산 항목을 가리키는 칸을 손으로 적은 목록으로 센다. 마이그레이션 DB의 budget_item 외래 키와
// 맞대어, 새 표가 예산 항목을 가리키게 되면 이 시험이 실패해 목록에 더하게 한다(빠지면 쓰인 항목을 지우려다 외래 키 오류가 난다).
test('예산 항목을 가리키는 칸 목록이 DB의 budget_item 외래 키와 같다', async () => {
  const { pg, close } = await createTestDb()
  try {
    const { rows } = await pg.query<{ ref: string }>(
      `SELECT c.conrelid::regclass::text || '.' || a.attname AS ref
       FROM pg_constraint c
       JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
       WHERE c.contype = 'f' AND c.confrelid = 'budget_item'::regclass
       ORDER BY ref`,
    )
    const listed = BUDGET_ITEM_REFERENCES.map(
      column => `${getTableName(column.table)}.${column.name}`,
    ).sort()
    assert.deepEqual(
      rows.map(row => row.ref),
      listed,
    )
  } finally {
    await close()
  }
})
