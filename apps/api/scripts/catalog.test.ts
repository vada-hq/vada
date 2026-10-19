import assert from 'node:assert/strict'
import { test } from 'node:test'
import { PGlite } from '@electric-sql/pglite'
import { createTestDb } from '../src/db/test-db.js'
import { catalogDifferences, describeDatabase, excludedTablesIn } from './catalog.js'
import { NOT_IN_DESIGN } from './design-sql.js'

test('설계 검사의 비교는 설계 밖 표를 빼고, 한쪽에만 있는 제약을 찾아낸다', async () => {
  const design = await createTestDb()
  const migrated = await createTestDb()
  try {
    const lines = await describeDatabase(design.pg, NOT_IN_DESIGN)
    assert.ok(lines.includes('표 council'))
    assert.ok(
      lines.some(line =>
        line.startsWith('제약 department department_council_id_name_key UNIQUE (council_id, name)'),
      ),
    )
    for (const table of NOT_IN_DESIGN)
      assert.ok(
        !lines.some(line => line.startsWith(`표 ${table}`) || line.includes(` ${table}.`)),
        table,
      )
    assert.deepEqual(
      catalogDifferences(lines, await describeDatabase(migrated.pg, NOT_IN_DESIGN)),
      { onlyInDesign: [], onlyInMigration: [] },
    )
    await migrated.pg.exec(
      'ALTER TABLE department DROP CONSTRAINT department_council_id_name_key; CREATE INDEX extra_idx ON member (name);',
    )
    const differences = catalogDifferences(
      lines,
      await describeDatabase(migrated.pg, NOT_IN_DESIGN),
    )
    assert.deepEqual(
      differences.onlyInDesign.filter(line => line.startsWith('제약')),
      ['제약 department department_council_id_name_key UNIQUE (council_id, name)'],
    )
    assert.deepEqual(differences.onlyInMigration, [
      '인덱스 member CREATE INDEX extra_idx ON public.member USING btree (name)',
    ])
  } finally {
    await design.close()
    await migrated.close()
  }
})

test('설계 SQL이 설계 밖 표 이름을 쓰면 비교에서 빠지지 않고 드러난다', async () => {
  const migrated = await createTestDb()
  try {
    // 마이그레이션을 적용한 DB는 설계 밖 표 7개를 모두 가진다.
    assert.deepEqual(await excludedTablesIn(migrated.pg, NOT_IN_DESIGN), [...NOT_IN_DESIGN].sort())
    assert.deepEqual(await excludedTablesIn(migrated.pg, new Set(['no_such_table'])), [])
  } finally {
    await migrated.close()
  }
  const design = new PGlite()
  try {
    await design.exec('CREATE TABLE council (id int); CREATE TABLE users (id int);')
    assert.deepEqual(await excludedTablesIn(design, NOT_IN_DESIGN), ['users'])
  } finally {
    await design.close()
  }
})
