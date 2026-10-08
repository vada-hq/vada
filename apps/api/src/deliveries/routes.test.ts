import assert from 'node:assert/strict'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import { migrate } from 'drizzle-orm/pglite/migrator'
import { createDeliveryRoutes } from './routes.js'
import { createApp } from '../app.js'

test('delivery API limits writes, links approved items across events and persists retry receipts', async t => {
  const pg = new PGlite()
  try {
    const db = drizzle(pg)
    await migrate(db, { migrationsFolder: fileURLToPath(new URL('../../migrations', import.meta.url)) })
    await pg.exec(`
      INSERT INTO users(id,name,email) VALUES ('p','Planner','p@test.local'),('f','Finance','f@test.local'),('x','Other','x@test.local');
      INSERT INTO organizations(id,name) VALUES ('a','A'),('b','B');
      INSERT INTO departments(id,organization_id,name,handles_finance) VALUES ('p','a','Planning',false),('f','a','Finance',true),('x','b','Other',true);
      INSERT INTO memberships(id,user_id,organization_id,department_id) VALUES ('p','p','a','p'),('f','f','a','f'),('x','x','b','x');
      INSERT INTO events(id,organization_id,name,created_by) VALUES ('e','a','Event','p'),('e2','a','Other event','p'),('x','b','Secret','x');
      INSERT INTO purchase_submissions(id,organization_id,event_id,requester_id,department_id) VALUES ('s','a','e','p','p'),('s2','a','e2','p','p'),('sx','b','x','x','x');
      INSERT INTO purchase_items(id,organization_id,event_id,requester_id,submission_id,status,decided_by,decided_at,product_url,product_name,quantity) VALUES
        ('i','a','e','p','s','approved','f',now(),'https://example.test/1','Tape',2),('i2','a','e','p','s','approved','f',now(),'https://example.test/2','Water',1),
        ('i3','a','e2','p','s2','approved','f',now(),'https://example.test/3','Other',1),('xi','b','x','x','sx','approved','x',now(),'https://example.test/5','Foreign',1);
      INSERT INTO purchase_items(id,organization_id,event_id,requester_id,product_url,product_name,quantity) VALUES ('di','a','e','p','https://example.test/4','Secret draft',1);
    `)
    let userId: string | null = null
    let calls = 0
    let mode = 'ok'
    const provider = {
      carriers: async () => ({ carriers: [{ id: 'kr.coupangls', name: '쿠팡 로지스틱스' }], nextCursor: null }),
      lookup: async () => {
        calls++
        if (mode === 'fail') throw new Error('SECRET_PROVIDER_PAYLOAD')
        if (mode === 'revoke') await pg.exec("UPDATE departments SET handles_finance=false WHERE id='f'")
        return { status: 'in_transit' as const, providerStatus: 'IN_TRANSIT', lastEventAt: '2026-09-30T06:00:00.000Z', checkedAt: '2026-09-30T07:00:00.000Z' }
      },
    }
    const origin = 'http://127.0.0.1:5180'
    const session = async () => userId ? { user: { id: userId } } : null
    const routes = createDeliveryRoutes(db, session, provider)
    const app = createApp({ auth: { handler: async () => new Response() }, trustedOrigin: origin, deliveries: routes })
    const root = '/api/organizations/a'
    const input = { carrierId: 'kr.coupangls', trackingNumber: '000123456789', purchaseItemIds: ['i','i2'], idempotencyKey: 'key' }
    const post = (path: string, body: unknown, requestOrigin = origin) => app.request(path, { method: 'POST', headers: { Origin: requestOrigin, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const create = (body = input) => post(`${root}/shipments`, body)
    let id = ''
    await t.test('carrier list is restricted to finance; malformed and oversized bodies are rejected', async () => {
      assert.equal((await app.request(`${root}/delivery-carriers`)).status, 401)
      userId = 'p'; assert.equal((await app.request(`${root}/delivery-carriers`)).status, 403)
      userId = 'f'; assert.equal((await app.request(`${root}/delivery-carriers`)).status, 200)
      assert.equal((await app.request(`${root}/shipments`, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'text/plain' }, body: '{}' })).status, 415)
      assert.equal((await app.request(`${root}/shipments`, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: '{' })).status, 400)
      assert.equal((await post(`${root}/shipments`, { extra: 'x'.repeat(33000) })).status, 413)
      userId = null
    })
    await t.test('auth, finance and strict inputs fail before external calls', async () => {
      assert.equal((await create()).status, 401)
      userId = 'x'; assert.equal((await create()).status, 403)
      userId = 'p'; assert.equal((await create()).status, 403)
      assert.equal((await post(`${root}/delivery-lookups`, { carrierId: input.carrierId, trackingNumber: input.trackingNumber })).status, 403)
      userId = 'f'
      assert.equal((await post(`${root}/shipments`, input, 'https://evil.test')).status, 403)
      for (const body of [null, {}, { ...input, status: 'delivered' }, { ...input, carrierId: '' }, { ...input, trackingNumber: 123 }, { ...input, purchaseItemIds: ['i','i'] }]) {
        assert.equal((await post(`${root}/shipments`, body)).status, 400)
      }
      assert.equal((await create({ ...input, purchaseItemIds: ['xi'] })).status, 404)
      assert.equal((await create({ ...input, purchaseItemIds: ['di'] })).status, 409)
      assert.equal(calls, 0)
    })
    await t.test('preview does not persist; provider failures and revocation do not save', async () => {
      const preview = await post(`${root}/delivery-lookups`, { carrierId: input.carrierId, trackingNumber: input.trackingNumber })
      assert.equal(preview.status, 200)
      assert.equal((await pg.query('SELECT id FROM shipments')).rows.length, 0)
      mode = 'fail'
      const failed = await create()
      assert.equal(failed.status, 502)
      assert.ok(!(await failed.text()).includes('SECRET_PROVIDER_PAYLOAD'))
      mode = 'revoke'; assert.equal((await create()).status, 403)
      assert.equal((await pg.query('SELECT id FROM shipments')).rows.length, 0)
      await pg.exec("UPDATE departments SET handles_finance=true WHERE id='f'")
      mode = 'ok'
    })
    await t.test('registration saves shipment, links, receipt and pending job atomically and marks the items purchased', async () => {
      const result = await create()
      assert.equal(result.status, 201)
      id = (await result.json()).shipmentId
      assert.ok(id)
      assert.equal((await pg.query('SELECT id FROM shipments')).rows.length, 1)
      assert.equal((await pg.query('SELECT id FROM shipment_items')).rows.length, 2)
      assert.deepEqual((await pg.query('SELECT kind,status FROM shipment_jobs')).rows, [{ kind: 'register', status: 'pending' }])
      // 송장이 생기면 산 물건이다. 구매함 표시와 기록이 붙는다.
      assert.deepEqual((await pg.query("SELECT id, purchased_by, version FROM purchase_items WHERE id IN ('i','i2') ORDER BY id")).rows,
        [{ id: 'i', purchased_by: 'f', version: 2 }, { id: 'i2', purchased_by: 'f', version: 2 }])
      assert.deepEqual((await pg.query('SELECT item_id, action FROM purchase_item_events ORDER BY item_id')).rows,
        [{ item_id: 'i', action: 'purchased' }, { item_id: 'i2', action: 'purchased' }])
      const previousCalls = calls
      assert.equal((await create()).status, 200)
      assert.equal(calls, previousCalls)
      assert.equal((await create({ ...input, trackingNumber: 'another' })).status, 409)
      assert.equal((await create({ ...input, idempotencyKey: 'other-key' })).status, 201)
      assert.equal((await pg.query('SELECT id FROM shipment_items')).rows.length, 2)
      assert.equal((await pg.query('SELECT id FROM purchase_item_events')).rows.length, 2)
    })
    await t.test('late persistence failure rolls back shipment, links and jobs', async () => {
      await pg.exec(`CREATE FUNCTION reject_receipt() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'TEST_ONLY'; END $$;
        CREATE TRIGGER reject_receipt BEFORE INSERT ON shipment_registrations FOR EACH ROW EXECUTE FUNCTION reject_receipt();`)
      try {
        assert.equal((await create({ ...input, trackingNumber: 'rollback', idempotencyKey: 'rollback' })).status, 500)
        assert.equal((await pg.query('SELECT id FROM shipments')).rows.length, 1)
        assert.equal((await pg.query('SELECT id FROM shipment_items')).rows.length, 2)
        assert.equal((await pg.query('SELECT id FROM shipment_jobs')).rows.length, 1)
      } finally { await pg.exec('DROP TRIGGER reject_receipt ON shipment_registrations; DROP FUNCTION reject_receipt();') }
    })
    await t.test('the event delivery list is gone; purchase item lists carry shipments instead', async () => {
      userId = 'p'
      assert.equal((await app.request(`${root}/events/e/deliveries`)).status, 404)
      userId = 'f'
    })
    await t.test('unlink is tenant protected, retains history and old retries cannot reconnect', async () => {
      const linkIds = (await pg.query<{ id: string }>('SELECT id FROM shipment_items WHERE unlinked_at IS NULL')).rows.map(row => row.id)
      userId = 'p'; assert.equal((await post(`${root}/shipments/${id}/unlink`, { linkIds })).status, 403)
      userId = 'f'
      assert.equal((await post(`${root}/shipments/${id}/unlink`, { linkIds: ['xi'] })).status, 404)
      // 앱 서버 시계가 DB보다 느린 상황. 연결 시각은 DB 시계로 기록되므로 등록 직후 해제가 시각 제약을 깨면 안 된다.
      await pg.exec("UPDATE shipment_items SET linked_at = now() + interval '5 seconds' WHERE unlinked_at IS NULL")
      assert.equal((await post(`${root}/shipments/${id}/unlink`, { linkIds })).status, 200)
      assert.equal((await post(`${root}/shipments/${id}/unlink`, { linkIds })).status, 200)
      assert.equal((await create()).status, 200)
      assert.equal((await pg.query('SELECT id FROM shipment_items WHERE unlinked_at IS NULL')).rows.length, 0)
      assert.deepEqual((await pg.query('SELECT tracking_active FROM shipments')).rows, [{ tracking_active: false }])
      assert.equal((await pg.query("SELECT id FROM shipment_jobs WHERE kind='unregister' AND status='pending'")).rows.length, 1)
      assert.equal((await create({ ...input, idempotencyKey: 'reconnect' })).status, 201)
      assert.equal((await post(`${root}/shipments/${id}/unlink`, { linkIds })).status, 200)
      assert.equal((await pg.query('SELECT id FROM shipment_items WHERE unlinked_at IS NULL')).rows.length, 2)
      assert.equal((await pg.query('SELECT id FROM shipment_items WHERE unlinked_at IS NOT NULL')).rows.length, 2)
    })
    await t.test('split shipments stay separate, one shipment can hold items of two events, and approval is unchanged', async () => {
      assert.equal((await create({ ...input, trackingNumber: 'split-2', purchaseItemIds: ['i'], idempotencyKey: 'split' })).status, 201)
      assert.deepEqual((await pg.query(`SELECT purchase_item_id, count(*)::int AS n FROM shipment_items WHERE unlinked_at IS NULL
        GROUP BY purchase_item_id ORDER BY purchase_item_id`)).rows, [{ purchase_item_id: 'i', n: 2 }, { purchase_item_id: 'i2', n: 1 }])
      assert.equal((await create({ ...input, trackingNumber: 'cross', purchaseItemIds: ['i2', 'i3'], idempotencyKey: 'cross' })).status, 201)
      assert.deepEqual((await pg.query("SELECT DISTINCT status FROM purchase_items WHERE id IN ('i','i2','i3')")).rows, [{ status: 'approved' }])
      assert.ok((await pg.query<{ purchased_at: Date | null }>("SELECT purchased_at FROM purchase_items WHERE id = 'i3'")).rows[0]!.purchased_at)
    })
  } finally { await pg.close() }
})

test('미배정 구성원은 재정 전용 배송 기능을 쓰지 못한다', async () => {
  const pg = new PGlite()
  try {
    const db = drizzle(pg)
    await migrate(db, { migrationsFolder: fileURLToPath(new URL('../../migrations', import.meta.url)) })
    await pg.exec(`
      INSERT INTO users(id,name,email) VALUES ('n','New','n@test.local');
      INSERT INTO organizations(id,name) VALUES ('a','A');
      INSERT INTO memberships(id,user_id,organization_id,department_id) VALUES ('n','n','a',NULL);
    `)
    const app = createApp({ auth: { handler: async () => new Response() }, trustedOrigin: 'http://127.0.0.1:5180',
      deliveries: createDeliveryRoutes(db, async () => ({ user: { id: 'n' } }), {} as never) })
    const response = await app.request('/api/organizations/a/delivery-carriers')
    assert.equal(response.status, 403)
    assert.deepEqual(await response.json(), { error: 'FORBIDDEN' })
  } finally {
    await pg.close()
  }
})

test('회장단은 재정 전용 배송 조회를 쓸 수 있다', async () => {
  const pg = new PGlite()
  try {
    const db = drizzle(pg)
    await migrate(db, { migrationsFolder: fileURLToPath(new URL('../../migrations', import.meta.url)) })
    await pg.exec(`
      INSERT INTO users(id,name,email) VALUES ('l','Leader','l@test.local');
      INSERT INTO organizations(id,name) VALUES ('a','A');
      INSERT INTO departments(id,organization_id,name,is_leadership) VALUES ('lead','a','회장단',true);
      INSERT INTO memberships(id,user_id,organization_id,department_id) VALUES ('l','l','a','lead');
    `)
    const lookup = { status: 'in_transit' as const, providerStatus: 'IN_TRANSIT', lastEventAt: null, checkedAt: '2026-10-08T00:00:00.000Z' }
    const provider = { carriers: async () => ({ carriers: [], nextCursor: null }), lookup: async () => lookup }
    const origin = 'http://127.0.0.1:5180'
    const app = createApp({ auth: { handler: async () => new Response() }, trustedOrigin: origin,
      deliveries: createDeliveryRoutes(db, async () => ({ user: { id: 'l' } }), provider) })
    const response = await app.request('/api/organizations/a/delivery-lookups', { method: 'POST',
      headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ carrierId: 'kr.cjlogistics', trackingNumber: '1234' }) })
    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), lookup)
  } finally {
    await pg.close()
  }
})
