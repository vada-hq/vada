import assert from 'node:assert/strict'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync, copyFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import { migrate } from 'drizzle-orm/pglite/migrator'
import { getTableConfig } from 'drizzle-orm/pg-core'
import * as schema from './schema.js'

// 나중 마이그레이션이 더한 칸(예: organizations.invite_code)은 빼고, 원래 있던 칸의 값만 비교한다.
const sameColumns = (rows: Record<string, unknown>[], before: Record<string, unknown>[]) =>
  rows.map((row, index) => Object.fromEntries(Object.keys(before[index] ?? row).map(key => [key, row[key]])))

test('purchase schema exports the four approved tables', () => {
  for (const name of ['purchaseRequests', 'purchaseItems', 'purchaseRequestSources', 'purchaseRequestHistory']) {
    assert.ok(name in schema, `Missing table: ${name}`)
  }
})

test('purchase schema keeps incomplete fields nullable and sources use a composite key', () => {
  const { purchaseRequests: requests, purchaseItems: items, purchaseRequestSources: sources, purchaseRequestHistory: history } = schema
  for (const column of [requests.purpose, requests.neededBy, requests.estimatedShippingCost,
    items.productName, items.selectedOption, items.optionRequired, items.quantity,
    items.packagingUnit, items.estimatedUnitPrice, items.productSnapshot, items.productFetchedAt]) {
    assert.equal(column.notNull, false)
    assert.equal(column.hasDefault, false)
  }
  for (const table of [requests, items, history]) {
    assert.equal(table.id.primary, true)
    assert.equal(table.createdAt.notNull, true)
    assert.equal(table.createdAt.hasDefault, true)
  }
  assert.equal(requests.status.default, 'draft')
  assert.equal(requests.version.default, 1)
  assert.ok(requests.updatedAt.onUpdateFn)
  assert.deepEqual(getTableConfig(sources).primaryKeys[0]?.columns.map(column => column.name), ['request_id', 'message_id'])
  assert.ok(getTableConfig(requests).columns.every(column => !column.name.includes('total')))
})

test('purchase migration preserves existing data and enforces purchase constraints', async (t) => {
  const pg = new PGlite()
  const previous = mkdtempSync(join(tmpdir(), 'vada-purchase-migration-'))
  try {
    const folder = fileURLToPath(new URL('../../migrations', import.meta.url))
    const journal = JSON.parse(readFileSync(join(folder, 'meta/_journal.json'), 'utf8'))
    const oldJournal = { ...journal, entries: journal.entries.slice(0, 4) }
    mkdirSync(join(previous, 'meta'))
    writeFileSync(join(previous, 'meta/_journal.json'), JSON.stringify(oldJournal))
    for (const entry of oldJournal.entries) copyFileSync(join(folder, `${entry.tag}.sql`), join(previous, `${entry.tag}.sql`))
    const db = drizzle(pg)
    await migrate(db, { migrationsFolder: previous })
    await pg.exec(`
      INSERT INTO users(id,name,email) VALUES ('u','Planner','u@test.local'),('f','Finance','f@test.local');
      INSERT INTO organizations(id,name) VALUES ('o','Council'),('other','Other');
      INSERT INTO departments(id,organization_id,name) VALUES ('d','o','Planning'),('other-d','other','Other');
      INSERT INTO memberships(id,user_id,organization_id,department_id) VALUES ('member','u','o','d');
      INSERT INTO events(id,organization_id,name,created_by) VALUES ('e','o','Event','u'),('other-e','other','Other','u');
      INSERT INTO chat_rooms(id,organization_id,event_id) VALUES ('room','o','e');
      INSERT INTO messages(id,chat_room_id,author_id,content) VALUES ('message','room','u','테이블 2개');
    `)
    const tables = ['users', 'organizations', 'departments', 'memberships', 'events', 'chat_rooms', 'messages']
    const before = await Promise.all(tables.map(table => pg.query<Record<string, unknown>>(`SELECT * FROM ${table} ORDER BY id`)))
    await migrate(db, { migrationsFolder: folder })
    const after = await Promise.all(tables.map(table => pg.query<Record<string, unknown>>(`SELECT * FROM ${table} ORDER BY id`)))
    // 0010은 학생회마다 회장단 행을 새로 만든다. 원래 있던 행만 비교한다.
    const kept = after.map((result, index) => result.rows.filter(row => before[index]!.rows.some(old => old.id === row.id)))
    assert.deepEqual(kept.map((rows, index) => sameColumns(rows, before[index]!.rows)), before.map(result => result.rows))

    const request = (id: string, key = id, event = 'e', department = 'd', requester = 'u') => pg.query(
      'INSERT INTO purchase_requests(id,organization_id,event_id,requester_id,department_id,idempotency_key) VALUES ($1,$2,$3,$4,$5,$6)',
      [id, 'o', event, requester, department, key],
    )
    await request('r')
    await t.test('drafts keep unknown values null and use version 1', async () => {
      assert.deepEqual((await pg.query('SELECT status,version,purpose,needed_by,estimated_shipping_cost FROM purchase_requests')).rows,
        [{ status: 'draft', version: 1, purpose: null, needed_by: null, estimated_shipping_cost: null }])
    })
    await t.test('request identity, tenant boundaries, status and cost are constrained', async () => {
      await assert.rejects(request('dup', 'r'), { code: '23505' })
      await request('finance-key', 'r', 'e', 'd', 'f')
      await assert.rejects(request('bad', 'bad', 'other-e'), { code: '23503' })
      await assert.rejects(request('bad', 'bad', 'e', 'other-d'), { code: '23503' })
      await assert.rejects(request('bad', 'bad', 'e', 'd', 'missing'), { code: '23503' })
      await assert.rejects(request('bad', '  '), { code: '23514' })
      for (const update of ["status='processing'", 'version=0', 'estimated_shipping_cost=-1']) {
        await assert.rejects(pg.exec(`UPDATE purchase_requests SET ${update} WHERE id='r'`), { code: '23514' })
      }
      await pg.exec("UPDATE purchase_requests SET estimated_shipping_cost=0 WHERE id='r'")
    })
    await t.test('multiple items distinguish order quantity, packaging and separate source fields', async () => {
      await pg.exec(`
        INSERT INTO purchase_items(id,request_id,position,product_url) VALUES ('i1','r',0,'https://www.coupang.com/vp/products/1');
        INSERT INTO purchase_items(id,request_id,position,product_url,product_name,selected_option,option_required,quantity,packaging_unit,estimated_unit_price,product_snapshot,product_fetched_at)
        VALUES ('i2','r',1,'https://www.coupang.com/vp/products/2','생수','500ml',true,2,'40개입',10590,'{"name":"생수, 500ml, 40개","price":10590}',now());
      `)
      assert.deepEqual((await pg.query('SELECT quantity,option_required,estimated_unit_price,product_snapshot,product_fetched_at FROM purchase_items WHERE id=\'i1\'')).rows,
        [{ quantity: null, option_required: null, estimated_unit_price: null, product_snapshot: null, product_fetched_at: null }])
      const original = (await pg.query("SELECT product_snapshot,product_fetched_at FROM purchase_items WHERE id='i2'")).rows
      await pg.exec("UPDATE purchase_items SET product_name='수정한 이름',estimated_unit_price=11000 WHERE id='i2'")
      assert.deepEqual((await pg.query("SELECT product_snapshot,product_fetched_at FROM purchase_items WHERE id='i2'")).rows, original)
      for (const update of ['quantity=0', 'quantity=-1', 'estimated_unit_price=-1', 'position=-1', "product_url=' '", "product_snapshot='[]'", 'product_fetched_at=NULL']) {
        await assert.rejects(pg.exec(`UPDATE purchase_items SET ${update} WHERE id='i2'`), { code: '23514' })
      }
      await assert.rejects(pg.exec("UPDATE purchase_items SET position=0 WHERE id='i2'"), { code: '23505' })
      await assert.rejects(pg.exec("UPDATE purchase_items SET request_id='missing' WHERE id='i2'"), { code: '23503' })
    })
    await t.test('sources are unique per request and retain their message', async () => {
      await pg.exec("INSERT INTO purchase_request_sources(request_id,message_id) VALUES ('r','message')")
      await assert.rejects(pg.exec("INSERT INTO purchase_request_sources(request_id,message_id) VALUES ('r','message')"), { code: '23505' })
      await assert.rejects(pg.exec("INSERT INTO purchase_request_sources(request_id,message_id) VALUES ('r','missing')"), { code: '23503' })
      await assert.rejects(pg.exec("INSERT INTO purchase_request_sources(request_id,message_id) VALUES ('missing','message')"), { code: '23503' })
      await assert.rejects(pg.exec("DELETE FROM messages WHERE id='message'"), { code: '23001' })
    })
    await t.test('history records one action per version and requires rejection reason', async () => {
      const history = (id: string, action: string, reason: string | null = null, version = 2, actor = 'f') => pg.query(
        'INSERT INTO purchase_request_history(id,request_id,actor_id,action,version,changes,reason) VALUES ($1,$2,$3,$4,$5,$6,$7)',
        [id, 'r', actor, action, version, JSON.stringify({ status: { before: 'submitted', after: 'rejected' } }), reason],
      )
      for (const reason of [null, '', ' \t\n']) await assert.rejects(history('bad', 'rejected', reason), { code: '23514' })
      await assert.rejects(history('bad', 'processing'), { code: '23514' })
      await assert.rejects(history('bad', 'updated', null, 0), { code: '23514' })
      await assert.rejects(history('bad', 'updated', null, 1, 'missing'), { code: '23503' })
      await history('h', 'rejected', '수량 확인 필요')
      await assert.rejects(history('dup', 'updated'), { code: '23505' })
      await assert.rejects(pg.exec("UPDATE purchase_request_history SET changes='[]' WHERE id='h'"), { code: '23514' })
    })
    await t.test('membership removal and reapplying migrations preserve purchase records', async () => {
      await pg.exec("DELETE FROM memberships WHERE id='member'")
      await migrate(db, { migrationsFolder: folder })
      assert.deepEqual((await pg.query("SELECT requester_id,department_id FROM purchase_requests WHERE id='r'")).rows, [{ requester_id: 'u', department_id: 'd' }])
      assert.equal((await pg.query('SELECT id FROM purchase_items')).rows.length, 2)
      assert.equal((await pg.query('SELECT id FROM purchase_request_history')).rows.length, 1)
      assert.equal((await pg.query('SELECT id FROM drizzle.__drizzle_migrations')).rows.length, journal.entries.length)
      await assert.rejects(pg.exec("DELETE FROM purchase_requests WHERE id='r'"), { code: '23001' })
      await assert.rejects(pg.exec("DELETE FROM departments WHERE id='d'"), { code: '23001' })
    })
  } finally {
    await pg.close()
    // 이 테스트가 만든 전용 임시 폴더만 정리한다.
    rmSync(previous, { recursive: true, force: true })
  }
})
