import assert from 'node:assert/strict'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import { migrate } from 'drizzle-orm/pglite/migrator'
import * as schema from './schema.js'

test('delivery schema exports tracking tables and registration receipts', () => {
  for (const name of ['shipments', 'shipmentItems', 'shipmentJobs', 'shipmentRegistrations']) assert.ok(name in schema, name)
})

test('delivery migration preserves purchases and enforces shipment boundaries', async t => {
  const pg = new PGlite()
  try {
    const folder = fileURLToPath(new URL('../../migrations', import.meta.url))
    const journal = JSON.parse(readFileSync(join(folder, 'meta/_journal.json'), 'utf8'))
    // 0004까지 기존 스키마로 실제 품목을 만든 뒤 새 마이그레이션을 적용한다.
    for (const entry of journal.entries.slice(0, 5)) await pg.exec(readFileSync(join(folder, `${entry.tag}.sql`), 'utf8'))
    await pg.exec(`
      INSERT INTO users(id,name,email) VALUES ('u','User','u@example.test');
      INSERT INTO organizations(id,name) VALUES ('o','Council'),('other','Other');
      INSERT INTO departments(id,organization_id,name) VALUES ('d','o','Finance'),('od','other','Finance');
      INSERT INTO events(id,organization_id,name,created_by) VALUES ('e','o','Event','u'),('oe','other','Other','u');
      INSERT INTO purchase_requests(id,organization_id,event_id,requester_id,department_id,idempotency_key,status)
        VALUES ('r','o','e','u','d','r','approved'),('or','other','oe','u','od','or','approved');
      INSERT INTO purchase_items(id,request_id,position,product_url) VALUES ('i','r',0,'https://example.test/1'),('i2','r',1,'https://example.test/2'),('oi','or',0,'https://example.test/3');
      INSERT INTO purchase_request_history(id,request_id,actor_id,action,version,changes) VALUES ('h','r','u','approved',2,'{}'),('oh','or','u','approved',2,'{}');
    `)
    const before = (await pg.query('SELECT * FROM purchase_items ORDER BY id')).rows
    assert.ok(journal.entries.length > 5, 'delivery migration missing')
    for (const entry of journal.entries.slice(5)) await pg.exec(readFileSync(join(folder, `${entry.tag}.sql`), 'utf8'))
    const after = (await pg.query<Record<string, unknown>>('SELECT * FROM purchase_items ORDER BY id')).rows
    // 0012가 품목 칸을 더한다. 원래 있던 칸만 비교한다.
    assert.deepEqual(after.map(row => Object.fromEntries(Object.keys(before[0]!).map(key => [key, row[key]]))), before)
    const shipment = (id: string, number = id, org = 'o') => pg.query(
      'INSERT INTO shipments(id,organization_id,carrier_id,tracking_number,created_by) VALUES ($1,$2,$3,$4,$5)', [id, org, 'kr.coupangls', number, 'u'])
    const link = (id: string, ship = 's', item = 'i', request = 'r', org = 'o') => pg.query(
      'INSERT INTO shipment_items(id,shipment_id,purchase_item_id,request_id,organization_id,linked_by) VALUES ($1,$2,$3,$4,$5,$6)', [id, ship, item, request, org, 'u'])
    await shipment('s', '000123')
    await shipment('s2')
    await shipment('os', '000123', 'other')
    await t.test('identity, unknown defaults and status are constrained', async () => {
      assert.deepEqual((await pg.query("SELECT tracking_number,status,last_checked_at,last_error_code FROM shipments WHERE id='s'")).rows,
        [{ tracking_number: '000123', status: 'unknown', last_checked_at: null, last_error_code: null }])
      await assert.rejects(shipment('dup', '000123'), { code: '23505' })
      await assert.rejects(shipment('bad', '  '), { code: '23514' })
      for (const assignment of ["status='approved'", "carrier_id=' '"]) await assert.rejects(pg.exec(`UPDATE shipments SET ${assignment} WHERE id='s'`), { code: '23514' })
    })
    await t.test('combined and split deliveries retain unlink history without crossing councils', async () => {
      await link('l')
      await link('l2', 's', 'i2')
      await link('l3', 's2', 'i')
      await assert.rejects(link('dup'), { code: '23505' })
      await assert.rejects(link('cross', 's', 'oi', 'or'), { code: '23503' })
      await assert.rejects(link('wrong-request', 's', 'oi', 'r'), { code: '23503' })
      await assert.rejects(link('wrong-ship', 'os'), { code: '23503' })
      await assert.rejects(pg.exec("UPDATE shipment_items SET unlinked_at=now() WHERE id='l'"), { code: '23514' })
      await assert.rejects(pg.exec("UPDATE shipment_items SET unlinked_at=linked_at-interval '1 day',unlinked_by='u' WHERE id='l'"), { code: '23514' })
      await pg.exec("UPDATE shipment_items SET unlinked_at=now(),unlinked_by='u' WHERE id='l'")
      await link('relinked')
      assert.equal((await pg.query('SELECT id FROM shipment_items')).rows.length, 4)
      await assert.rejects(pg.exec("DELETE FROM purchase_items WHERE id='i'"), { code: '23001' })
      await assert.rejects(pg.exec("DELETE FROM shipments WHERE id='s'"), { code: '23001' })
    })
    await t.test('durable jobs constrain lease, retry count and active duplicates', async () => {
      await pg.exec("INSERT INTO shipment_jobs(id,shipment_id,kind) VALUES ('j','s','refresh')")
      await assert.rejects(pg.exec("INSERT INTO shipment_jobs(id,shipment_id,kind) VALUES ('dup','s','refresh')"), { code: '23505' })
      for (const assignment of ["kind='invalid'", "status='invalid'", 'attempts=-1', "status='running'", 'locked_until=now()']) {
        await assert.rejects(pg.exec(`UPDATE shipment_jobs SET ${assignment} WHERE id='j'`), { code: '23514' })
      }
      await pg.exec("UPDATE shipment_jobs SET status='running',locked_until=now()+interval '1 minute',attempts=1 WHERE id='j'")
      await pg.exec("UPDATE shipment_jobs SET status='completed',locked_until=NULL WHERE id='j'")
      await pg.exec("INSERT INTO shipment_jobs(id,shipment_id,kind) VALUES ('next','s','refresh')")
      await assert.rejects(pg.exec("INSERT INTO shipment_jobs(id,shipment_id,kind) VALUES ('orphan','missing','refresh')"), { code: '23503' })
    })
  } finally { await pg.close() }
})

test('all migrations apply from scratch and can be reapplied', async () => {
  const pg = new PGlite()
  try {
    const db = drizzle(pg)
    const migrationsFolder = fileURLToPath(new URL('../../migrations', import.meta.url))
    await migrate(db, { migrationsFolder })
    await migrate(db, { migrationsFolder })
    assert.equal((await pg.query("SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename IN ('shipments','shipment_items','shipment_jobs')")).rows.length, 3)
  } finally { await pg.close() }
})
