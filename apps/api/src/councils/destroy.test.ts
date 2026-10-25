import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createTestDb } from '../db/test-db.js'
import { ACCOUNT_TABLES, DESTROY_STEPS, KEPT_TABLES } from './destroy.js'

// 학생회 파기(기능 021 정한 것 15)가 표를 빠뜨리지 않는지 스키마로 본다. 새 표가 생기면 어느 쪽인지 정할 때까지 이 시험이 실패한다.
// 파기하는 표의 행을 가리키는 외래 키는 모두 모아, 가리키는 표도 파기하고 먼저 지우는지 본다.
type ForeignKey = { child: string; parent: string; columns: string; deferrable: boolean }

async function schemaOf() {
  const { pg, close } = await createTestDb()
  try {
    const tables = await pg.query<{ name: string }>(
      `SELECT table_name AS name FROM information_schema.tables
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY 1`,
    )
    const keys = await pg.query<ForeignKey>(
      `SELECT c.conrelid::regclass::text AS child, c.confrelid::regclass::text AS parent, c.condeferrable AS deferrable,
              (SELECT string_agg(a.attname, ',' ORDER BY k.n) FROM unnest(c.conkey) WITH ORDINALITY k(attnum, n)
                 JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.attnum) AS columns
         FROM pg_constraint c JOIN pg_namespace s ON s.oid = c.connamespace
        WHERE c.contype = 'f' AND s.nspname = 'public'`,
    )
    const columns = await pg.query<{ table_name: string; column_name: string }>(
      `SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = 'public'`,
    )
    return {
      tables: tables.rows.map(row => row.name),
      keys: keys.rows,
      hasColumn: (table: string, column: string) =>
        columns.rows.some(row => row.table_name === table && row.column_name === column),
    }
  } finally {
    await close()
  }
}

const destroyed: string[] = DESTROY_STEPS.map(step => step.table)

test('모든 표가 파기하는 표, 로그인 쪽 표, 남기는 표 가운데 한 곳에만 있다', async () => {
  const { tables, hasColumn } = await schemaOf()
  const classified = [...destroyed, ...ACCOUNT_TABLES, ...KEPT_TABLES]
  assert.equal(new Set(classified).size, classified.length, '두 곳에 있거나 두 번 지우는 표')
  assert.deepEqual([...classified].sort(), tables)
  for (const step of DESTROY_STEPS)
    assert.ok(hasColumn(step.table, step.column), `${step.table}.${step.column}`)
})

test('파기하는 표를 가리키는 외래 키의 표는 모두 파기하고, 가리키는 표를 먼저 지운다', async () => {
  const { keys } = await schemaOf()
  const order = (table: string) => destroyed.indexOf(table)
  for (const key of keys) {
    if (!destroyed.includes(key.parent)) continue
    // 남기는 운영진의 로그인 잇기는 남는다. 지우는 운영진은 로그인이 없는 사람뿐이다.
    if (key.child === 'member_login') continue
    assert.ok(destroyed.includes(key.child), `${key.child}(${key.columns}) → ${key.parent}`)
    // 같은 표 안의 외래 키(이전 행사·이전 기간)와 거래 끝에 보는 외래 키는 한 문장·한 거래 안이라 순서가 없다.
    if (key.child === key.parent || key.deferrable) continue
    assert.ok(
      order(key.child) < order(key.parent),
      `${key.child}(${key.columns})를 ${key.parent}보다 먼저 지운다`,
    )
  }
  // 신청자 열람 기록은 학생회를 파기해도 남으므로(DEC-72) 지우는 행을 가리키지 않는다.
  assert.ok(!keys.some(key => key.child === 'applicant_access_log'))
})
