import assert from 'node:assert/strict'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import { migrate } from 'drizzle-orm/pglite/migrator'
import { Hono } from 'hono'
import { createDeliveryJobs } from './job-repository.js'
import { createDeliveryWorker } from './worker.js'
import { createDeliveryWebhook, createCallbackAddress } from './webhook.js'

test('durable delivery worker and untrusted callbacks', async t => {
  const pg = new PGlite()
  try {
    const db = drizzle(pg)
    await migrate(db, { migrationsFolder: fileURLToPath(new URL('../../migrations', import.meta.url)) })
    await pg.exec(`INSERT INTO users(id,name,email) VALUES ('u','U','u@test.local');
      INSERT INTO organizations(id,name) VALUES ('o','O');
      INSERT INTO shipments(id,organization_id,carrier_id,tracking_number,created_by) VALUES ('s','o','kr.coupangls','000123','u');`)
    let now = new Date('2026-10-01T00:00:00Z')
    const clock = () => new Date(now)
    const jobs = createDeliveryJobs(db, clock)
    const address = createCallbackAddress('https://example.test', 's'.repeat(64))
    const hook = new Hono().route('/api', createDeliveryWebhook(db, address, clock))
    const call = (url: string, body: unknown = { carrierId: 'kr.coupangls', trackingNumber: '000123' }) => hook.request(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    let lookups = 0, registrations = 0, fail = false
    let status: 'in_transit' | 'delivered' = 'in_transit'
    const worker = createDeliveryWorker(jobs, {
      async register() { registrations++ },
      async lookup() { lookups++; if (fail) throw new Error('SECRET'); return { status, providerStatus: status.toUpperCase(), lastEventAt: now.toISOString(), checkedAt: now.toISOString() } },
    }, address, clock)
    await t.test('invalid tokens and payloads enqueue nothing; valid duplicates merge', async () => {
      assert.equal((await call('/api/delivery-webhooks/s/bad')).status, 404)
      assert.equal((await call(address.url('s'), { carrierId: 'kr.coupangls', trackingNumber: 'foreign' })).status, 400)
      assert.equal((await call(address.url('s'), { projectId: 'p', carrierId: 'kr.coupangls', trackingNumber: 'foreign' })).status, 400)
      assert.equal((await call(address.url('s'), { projectId: 'p', carrierId: 1, trackingNumber: '000123' })).status, 400)
      assert.equal((await pg.query('SELECT id FROM shipment_jobs')).rows.length, 0)
      assert.equal((await call(address.url('s'))).status, 202)
      // 실제 공급자는 문서에 없는 projectId를 함께 보낸다. 모르는 필드는 읽지 않고 무시한다.
      assert.equal((await call(address.url('s'), { projectId: 'p', carrierId: 'kr.coupangls', trackingNumber: '000123', status: 'DELIVERED' })).status, 202)
      assert.equal((await pg.query('SELECT id FROM shipment_jobs')).rows.length, 1)
      assert.equal((await pg.query<{ status: string }>('SELECT status FROM shipments')).rows[0].status, 'unknown')
      assert.equal(lookups, 0)
    })
    await t.test('refresh applies authenticated lookup; failures preserve last state and retry', async () => {
      assert.equal(await worker.runOne(), true)
      assert.equal((await pg.query<{ status: string }>('SELECT status FROM shipments')).rows[0].status, 'in_transit')
      now = new Date(now.getTime() + 61_000)
      await call(address.url('s')); fail = true
      await worker.runOne()
      const row = (await pg.query<{ status: string; last_error_code: string }>('SELECT status,last_error_code FROM shipments')).rows[0]
      assert.equal(row.status, 'in_transit'); assert.equal(row.last_error_code, 'DELIVERY_REFRESH_FAILED')
      assert.ok(!JSON.stringify((await pg.query('SELECT * FROM shipment_jobs')).rows).includes('SECRET'))
      assert.equal(await worker.runOne(), false)
      now = new Date(now.getTime() + 61_000); fail = false
      assert.equal(await worker.runOne(), true)
    })
    await t.test('renewal schedules once and registers 48-hour callback', async () => {
      await jobs.scheduleRenewals(); await jobs.scheduleRenewals()
      assert.equal((await pg.query("SELECT id FROM shipment_jobs WHERE kind='register' AND status='pending'")).rows.length, 1)
      await worker.runOne(); assert.equal(registrations, 1)
      await worker.runOne() // 등록 직후 보완 조회
      await jobs.scheduleRenewals(); assert.equal(await worker.runOne(), false)
    })
    await t.test('lease recovery fences old worker; another kind cannot run concurrently', async () => {
      now = new Date(now.getTime() + 61_000); await call(address.url('s'))
      const old = (await jobs.claim())!
      assert.ok(old)
      await pg.exec("INSERT INTO shipment_jobs(id,shipment_id,kind,run_after) VALUES ('r','s','register','2026-10-01T00:00:00Z')")
      assert.equal(await jobs.claim(), null)
      now = new Date(now.getTime() + 61_000)
      const recovered = (await jobs.claim())!
      assert.equal(recovered.job.id, old.job.id)
      assert.equal(recovered.job.attempts, old.job.attempts + 1)
      assert.equal(await jobs.finish(old, { kind: 'refresh', result: { status: 'delivered', providerStatus: 'DELIVERED', lastEventAt: now.toISOString(), checkedAt: now.toISOString() } }), false)
      await jobs.finish(recovered, { kind: 'skip' })
      await worker.runOne()
      await worker.runOne() // 등록 직후 보완 조회
    })
    await t.test('inactive callbacks do nothing; generation changes invalidate in-flight lookup', async () => {
      now = new Date(now.getTime() + 61_000); await call(address.url('s'))
      const old = (await jobs.claim())!
      await pg.exec('UPDATE shipments SET tracking_active=false, tracking_version=2')
      assert.equal((await call(address.url('s'))).status, 202)
      assert.equal((await pg.query("SELECT id FROM shipment_jobs WHERE kind='refresh' AND status='pending'")).rows.length, 0)
      await jobs.finish(old, { kind: 'refresh', result: { status: 'delivered', providerStatus: 'DELIVERED', lastEventAt: now.toISOString(), checkedAt: now.toISOString() } })
      assert.equal((await pg.query<{ status: string }>('SELECT status FROM shipments')).rows[0].status, 'in_transit')
      await worker.runOne() // TTL-based unsubscribe: no remote cancellation race
      await pg.exec('UPDATE shipments SET tracking_active=true, tracking_version=3')
      // 동일 송장 재연결 뒤 과거 알림도 현재 상태를 재조회하는 신호로만 사용한다.
      assert.equal((await call(address.url('s'))).status, 202)
      status = 'delivered'
      now = new Date(now.getTime() + 61_000)
      await worker.runOne()
      assert.deepEqual((await pg.query('SELECT status,tracking_active FROM shipments')).rows, [{ status: 'delivered', tracking_active: false }])
    })
    await t.test('old events cannot regress state and callbacks arriving during work are durable', async () => {
      await worker.runOne() // 완료 배송의 추적 종료
      await pg.exec("INSERT INTO shipments(id,organization_id,carrier_id,tracking_number,created_by,status,last_event_at,last_checked_at) VALUES ('t','o','kr.coupangls','0001234','u','in_transit','2026-10-01T02:00:00Z','2026-10-01T02:00:00Z')")
      const body = { carrierId: 'kr.coupangls', trackingNumber: '0001234' }
      await call(address.url('t'), body)
      const claim = (await jobs.claim())!
      await call(address.url('t'), body); await call(address.url('t'), body)
      assert.equal((await pg.query("SELECT id FROM shipment_jobs WHERE shipment_id='t' AND status='pending'")).rows.length, 1)
      await jobs.finish(claim, { kind: 'refresh', result: { status: 'pending', providerStatus: 'INFORMATION_RECEIVED', lastEventAt: '2026-10-01T01:00:00Z', checkedAt: now.toISOString() } })
      assert.equal((await pg.query<{ status: string }>("SELECT status FROM shipments WHERE id='t'")).rows[0].status, 'in_transit')
      const next = await createDeliveryJobs(db, clock).claim() // 재시작한 저장소도 대기 작업을 읽는다.
      assert.ok(next)
      await jobs.finish(next, { kind: 'skip' })
    })
    await t.test('five failures stop automatic immediate retry; renewal cooldown prevents hot loop', async () => {
      await pg.exec("INSERT INTO shipment_jobs(id,shipment_id,kind,run_after) VALUES ('fail','t','register','2026-10-01T00:00:00Z')")
      for (let i = 1; i <= 5; i++) {
        now = new Date(now.getTime() + 61 * 60_000)
        const claim = (await jobs.claim())!
        assert.equal(claim.job.attempts, i)
        await jobs.finish(claim, { kind: 'error' })
      }
      assert.equal((await pg.query<{ status: string }>("SELECT status FROM shipment_jobs WHERE id='fail'")).rows[0].status, 'failed')
      await jobs.scheduleRenewals(); assert.equal(await jobs.claim(), null)
      now = new Date(now.getTime() + 25 * 60 * 60_000)
      await jobs.scheduleRenewals()
      const retry = await jobs.claim()
      assert.ok(retry); assert.equal(retry.job.attempts, 1)
      await jobs.finish(retry, { kind: 'skip' })
    })
    await t.test('callback returns failure unless queue commit succeeds', async () => {
      await pg.exec(`CREATE FUNCTION fail_callback_queue() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'SECRET'; END $$;
        CREATE TRIGGER fail_callback_queue BEFORE INSERT ON shipment_jobs FOR EACH ROW EXECUTE FUNCTION fail_callback_queue();`)
      try {
        const response = await call(address.url('t'), { carrierId: 'kr.coupangls', trackingNumber: '0001234' })
        assert.equal(response.status, 503)
        assert.ok(!(await response.text()).includes('SECRET'))
      } finally { await pg.exec('DROP TRIGGER fail_callback_queue ON shipment_jobs; DROP FUNCTION fail_callback_queue();') }
    })
  } finally { await pg.close() }
})

test('an exhausted lease is retired without hiding due work on other shipments', async () => {
  const pg = new PGlite()
  try {
    const db = drizzle(pg)
    await migrate(db, { migrationsFolder: fileURLToPath(new URL('../../migrations', import.meta.url)) })
    await pg.exec(`INSERT INTO users(id,name,email) VALUES ('u','U','u@test.local');
      INSERT INTO organizations(id,name) VALUES ('o','O');
      INSERT INTO shipments(id,organization_id,carrier_id,tracking_number,created_by) VALUES ('a','o','kr.coupangls','1','u'), ('b','o','kr.coupangls','2','u');
      INSERT INTO shipment_jobs(id,shipment_id,kind,status,attempts,locked_until,run_after) VALUES
        ('stuck','a','refresh','running',5,'2026-09-30T00:00:00Z','2026-09-30T00:00:00Z'),
        ('due','b','refresh','pending',0,NULL,'2026-09-30T00:00:00Z');`)
    const jobs = createDeliveryJobs(db, () => new Date('2026-10-01T00:00:00Z'))
    // 예약 실행은 claim이 null이면 큐가 비었다고 보고 끝낸다. 소진 처리만 하고 null을 돌려주면 남은 작업이 다음 실행까지 밀린다.
    const claim = await jobs.claim()
    assert.equal(claim?.job.id, 'due')
    assert.deepEqual((await pg.query("SELECT status,last_error_code FROM shipment_jobs WHERE id='stuck'")).rows, [{ status: 'failed', last_error_code: 'DELIVERY_LEASE_EXHAUSTED' }])
    await jobs.finish(claim!, { kind: 'skip' })
    assert.equal(await jobs.claim(), null)
  } finally { await pg.close() }
})
