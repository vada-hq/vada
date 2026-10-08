import assert from 'node:assert/strict'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import { migrate } from 'drizzle-orm/pglite/migrator'
import { getTableConfig } from 'drizzle-orm/pg-core'
import * as schema from './schema.js'

test('구매 스키마는 품목·제출·생성·기록·근거 표를 내보내고, 모르는 값은 비워 둔다', () => {
  for (const name of ['purchaseItems', 'purchaseSubmissions', 'purchaseGenerations', 'purchaseItemEvents', 'purchaseItemSources',
    'coupangProducts', 'purchaseCandidates', 'purchaseCandidateShares']) {
    assert.ok(name in schema, `Missing table: ${name}`)
  }
  // 옛 요청서 표와 연결 칸은 0013에서 지웠다.
  for (const name of ['purchaseRequests', 'purchaseRequestSources', 'purchaseRequestHistory']) assert.ok(!(name in schema), `Old table: ${name}`)
  assert.ok(!('requestId' in schema.purchaseItems) && !('position' in schema.purchaseItems) && !('requestId' in schema.shipmentItems))
  const items = schema.purchaseItems
  for (const column of [items.productName, items.selectedOption, items.optionRequired, items.quantity, items.packagingUnit,
    items.estimatedUnitPrice, items.note, items.neededBy, items.submissionId, items.decidedAt, items.purchasedAt, items.receivedAt]) {
    assert.equal(column.notNull, false)
  }
  assert.equal(items.status.default, 'draft')
  assert.equal(items.version.default, 1)
  assert.ok(items.updatedAt.onUpdateFn)
  assert.deepEqual(getTableConfig(schema.purchaseItemSources).primaryKeys[0]?.columns.map(column => column.name), ['item_id', 'message_id'])
})

test('생성 기록·제출 기록·근거는 학생회 경계와 고유 키를 지킨다', async (t) => {
  const pg = new PGlite()
  try {
    await migrate(drizzle(pg), { migrationsFolder: fileURLToPath(new URL('../../migrations', import.meta.url)) })
    await pg.exec(`
      INSERT INTO users(id,name,email) VALUES ('u','기획','u@test.local');
      INSERT INTO organizations(id,name) VALUES ('o','Council'),('other','Other');
      INSERT INTO departments(id,organization_id,name) VALUES ('d','o','기획부'),('od','other','기획부');
      INSERT INTO events(id,organization_id,name,created_by) VALUES ('e','o','Event','u'),('oe','other','Other','u');
      INSERT INTO chat_rooms(id,organization_id,event_id) VALUES ('room','o','e');
      INSERT INTO messages(id,chat_room_id,author_id,content) VALUES ('m','room','u','테이블 2개');
    `)
    const generation = (id: string, key: string, event = 'e', links = '[]') => pg.query(
      'INSERT INTO purchase_generations(id,organization_id,event_id,requester_id,idempotency_key,links) VALUES ($1,$2,$3,$4,$5,$6)',
      [id, 'o', event, 'u', key, links])
    await t.test('the same requester cannot reuse a generation key', async () => {
      await generation('g1', 'k')
      await assert.rejects(generation('g2', 'k'), { code: '23505' })
      await assert.rejects(generation('g3', ' '), { constraint: 'purchase_generations_key_not_blank' })
      await assert.rejects(generation('g4', 'k'.repeat(129)), { constraint: 'purchase_generations_key_length' })
      await assert.rejects(generation('g5', 'k5', 'e', '{}'), { constraint: 'purchase_generations_links_array' })
      await assert.rejects(generation('g6', 'k6', 'oe'), { code: '23503' })
    })
    await t.test('submissions keep a department of the same council', async () => {
      const submission = (id: string, department: string | null) => pg.query(
        'INSERT INTO purchase_submissions(id,organization_id,event_id,requester_id,department_id) VALUES ($1,$2,$3,$4,$5)',
        [id, 'o', 'e', 'u', department])
      await submission('s1', 'd')
      await submission('s2', null)
      await assert.rejects(submission('s3', 'od'), { code: '23503' })
      await assert.rejects(pg.exec("DELETE FROM departments WHERE id = 'd'"), { code: '23001' })
    })
    await t.test('sources are unique per item and keep their message; item fields are constrained', async () => {
      await pg.exec(`INSERT INTO purchase_items(id,organization_id,event_id,requester_id,generation_id,product_url)
        VALUES ('i','o','e','u','g1','https://www.coupang.com/vp/products/1')`)
      await pg.exec("INSERT INTO purchase_item_sources(item_id,message_id) VALUES ('i','m')")
      await assert.rejects(pg.exec("INSERT INTO purchase_item_sources(item_id,message_id) VALUES ('i','m')"), { code: '23505' })
      await assert.rejects(pg.exec("INSERT INTO purchase_item_sources(item_id,message_id) VALUES ('i','missing')"), { code: '23503' })
      await assert.rejects(pg.exec("DELETE FROM messages WHERE id = 'm'"), { code: '23001' })
      await assert.rejects(pg.exec("UPDATE purchase_items SET warnings = '{}' WHERE id = 'i'"), { constraint: 'purchase_items_warnings_array' })
      await assert.rejects(pg.exec("UPDATE purchase_items SET version = 0 WHERE id = 'i'"), { constraint: 'purchase_items_version_positive' })
      await assert.rejects(pg.exec("UPDATE purchase_items SET status = 'processing' WHERE id = 'i'"), { code: '23514' })
      await assert.rejects(pg.exec("UPDATE purchase_items SET generation_id = 'g-missing' WHERE id = 'i'"), { code: '23503' })
    })
  } finally {
    await pg.close()
  }
})
