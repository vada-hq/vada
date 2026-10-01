// Disposable live integration probe; never log credentials, callback URLs or raw errors.
import { randomBytes, randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { parseEnv } from 'node:util'
import { setTimeout as delay } from 'node:timers/promises'
import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import { shipments } from '../src/db/schema.js'
import { createDeliveryTracker } from '../src/deliveries/delivery-tracker.js'
import { createDeliveryJobs } from '../src/deliveries/job-repository.js'
import { createDeliveryWorker } from '../src/deliveries/worker.js'
import { createCallbackAddress, createDeliveryWebhook } from '../src/deliveries/webhook.js'

let stage = 'configuration'
// Explains a rejection without values: key names (schema only), value types and match against the seeded shipment.
async function bodyShape(request: Request, expected: { carrierId: string; trackingNumber: string }) {
  try {
    const text = await request.text()
    if (text.length > 4096) return ' body=too_large'
    let value: unknown
    try { value = JSON.parse(text) } catch { return ` body=invalid_json len=${text.length}` }
    if (!value || typeof value !== 'object' || Array.isArray(value)) return ` body=${Array.isArray(value) ? 'array' : typeof value}`
    const body = value as Record<string, unknown>
    const keys = Object.keys(body).slice(0, 20).map(key => `${/^[A-Za-z][A-Za-z0-9_]{0,39}$/.test(key) ? key : '?'}:${body[key] === null ? 'null' : typeof body[key]}`)
    return ` keys=${keys.join(',')} carrierMatch=${body.carrierId === expected.carrierId} numberMatch=${body.trackingNumber === expected.trackingNumber}`
  } catch { return ' body=unreadable' }
}
async function main() {
  const env = { ...parseEnv(readFileSync(new URL('../../../.env', import.meta.url), 'utf8')), ...process.env }
  if (!env.DATABASE_URL || !env.DELIVERY_TRACKER_CLIENT_ID || !env.DELIVERY_TRACKER_CLIENT_SECRET) throw new Error('CONFIGURATION')
  const address = createCallbackAddress(process.argv[2] ?? '', randomBytes(32).toString('hex'))
  const schema = `delivery_probe_${randomUUID().replaceAll('-', '')}`
  if (!/^delivery_probe_[a-f0-9]{32}$/.test(schema)) throw new Error('SCHEMA')
  const options = { max: 2, ssl: { rejectUnauthorized: true }, connect_timeout: 10, onnotice: () => {} }
  const admin = postgres(env.DATABASE_URL, options)
  // A pooled Neon connection may discard startup search_path. Use the same endpoint directly.
  const direct = new URL(env.DATABASE_URL)
  if (!direct.hostname.endsWith('.neon.tech')) throw new Error('EXPECTED_NEON')
  direct.hostname = direct.hostname.replace('-pooler.', '.')
  const client = postgres(direct.toString(), { ...options, max: 1, connection: { search_path: `${schema},pg_catalog`, statement_timeout: 15000 } })
  const provider = createDeliveryTracker({ clientId: env.DELIVERY_TRACKER_CLIENT_ID, clientSecret: env.DELIVERY_TRACKER_CLIENT_SECRET })
  const step = 3 * 60 * 60 * 1000
  const input = { carrierId: 'dev.track.dummy', trackingNumber: new Date((Math.floor(Date.now() / step) + 1) * step).toISOString().replace('.000Z', 'Z') }
  const id = randomUUID()
  let created = false
  let registrationAttempted = false
  let server: ReturnType<typeof serve> | undefined
  let stopped = false
  const stop = () => { stopped = true }
  process.once('SIGINT', stop)
  process.once('SIGTERM', stop)
  try {
    stage = 'isolated_database'
    await admin`CREATE SCHEMA ${admin(schema)}`
    created = true
    stage = 'clone_tables'
    // LIKE copies checks/indexes, not organization/user foreign keys; no real account is needed.
    await admin`CREATE TABLE ${admin(schema)}.shipments (LIKE public.shipments INCLUDING ALL)`
    await admin`CREATE TABLE ${admin(schema)}.shipment_jobs (LIKE public.shipment_jobs INCLUDING ALL)`
    stage = 'job_foreign_key'
    await admin`ALTER TABLE ${admin(schema)}.shipment_jobs ADD FOREIGN KEY (shipment_id) REFERENCES ${admin(schema)}.shipments(id)`
    await client`SET search_path TO ${client(schema)}, pg_catalog`
    const [scope] = await client`SELECT current_schema() AS name`
    stage = 'check_search_path'
    if (scope?.name !== schema) throw new Error('ISOLATION')
    const db = drizzle(client)
    stage = 'seed_shipment'
    await db.insert(shipments).values({ id, organizationId: 'probe', createdBy: 'probe', ...input })
    console.log('ISOLATED_DATABASE_READY')
    let callbackAt = 0
    const app = new Hono()
    app.onError((_, c) => c.body(null, 503))
    // Log every arrival, not only 202, to separate "never arrived" from "arrived and rejected".
    // Only method, coarse route, status and timing; never path segments, headers or body values.
    app.use('*', async (c, next) => {
      const at = new Date()
      const route = c.req.path === '/health' ? 'health' : c.req.path.startsWith('/api/delivery-webhooks/') ? 'webhook' : 'other'
      const shape = route === 'webhook' && c.req.method === 'POST' ? await bodyShape(c.req.raw.clone(), input) : ''
      await next()
      console.log(`REQUEST at=${at.toISOString()} method=${c.req.method.slice(0, 10)} route=${route} status=${c.res.status} ms=${Date.now() - at.getTime()}${shape}`)
      if (route === 'webhook' && c.res.status === 202) {
        callbackAt = at.getTime()
        console.log('CALLBACK_ACCEPTED_AND_JOB_COMMITTED')
      }
    })
    app.get('/health', c => c.text('delivery-probe'))
    app.route('/api', createDeliveryWebhook(db, address))
    stage = 'listener'
    await new Promise<void>((resolve, reject) => {
      server = serve({ fetch: app.fetch, hostname: '127.0.0.1', port: 8898 }, () => resolve())
      server.once('error', () => reject(new Error('LISTENER')))
    })
    stage = 'tunnel'
    const health = await fetch(new URL('/health', process.argv[2]), { headers: { 'ngrok-skip-browser-warning': 'true' }, signal: AbortSignal.timeout(15000) })
    if (!health.ok || await health.text() !== 'delivery-probe') throw new Error('TUNNEL')
    console.log('PUBLIC_TUNNEL_OK')
    const jobs = createDeliveryJobs(db)
    const worker = createDeliveryWorker(jobs, provider, address)
    stage = 'registration'
    await jobs.scheduleRenewals()
    registrationAttempted = true
    await worker.runOne()
    const [registered] = await db.select().from(shipments)
    if (!registered?.webhookExpiresAt) throw new Error('REGISTER')
    console.log('PROVIDER_REGISTRATION_OK: use console Webhook Trigger if needed')
    console.log(`Dummy number: ${input.trackingNumber}`)
    // Drain startup refresh before awaiting a callback-derived refresh.
    await worker.runOne()
    stage = 'callback_and_refresh'
    const deadline = Date.now() + 10 * 60 * 1000
    let lastState = ''
    while (!stopped && Date.now() < deadline) {
      await worker.runOne()
      const [row] = await db.select().from(shipments)
      const [counts] = await client`SELECT count(*)::int AS count FROM shipment_jobs WHERE kind='refresh' AND status='completed'`
      // Queue/DB progress after a callback: job counts per kind/status plus our own status/error codes.
      const jobRows = await client`SELECT kind, status, count(*)::int AS n FROM shipment_jobs GROUP BY kind, status ORDER BY kind, status`
      const state = `jobs=${jobRows.map(j => `${j.kind}:${j.status}=${j.n}`).join(',')} shipment=${row?.status} error=${row?.lastErrorCode ?? 'none'} checkedAt=${row?.lastCheckedAt?.toISOString() ?? 'none'}`
      if (state !== lastState) console.log(`STATE at=${new Date().toISOString()} ${state}`)
      lastState = state
      if (callbackAt && counts!.count >= 2 && row?.lastCheckedAt && row.lastCheckedAt.getTime() >= callbackAt && !row.lastErrorCode) {
        console.log(JSON.stringify({ result: 'LIVE_WEBHOOK_DB_UPDATE_OK', status: row.status, completedRefreshJobs: counts!.count }))
        return
      }
      await delay(5000)
    }
    throw new Error('CALLBACK_TIMEOUT_OR_STOP')
  } finally {
    if (registrationAttempted) {
      try {
        // Only this disposable registration is expired; product uses TTL-based unregister.
        await provider.register({ ...input, callbackUrl: address.url(id), expirationTime: new Date().toISOString() })
        console.log('PROBE_REMOTE_REGISTRATION_EXPIRED')
      } catch { console.log('PROBE_REMOTE_CLEANUP_FAILED: registration expires within 48h') }
    }
    if (server) await new Promise<void>(resolve => server!.close(() => resolve()))
    await client.end({ timeout: 2 })
    try {
      if (created) {
        await admin`DROP SCHEMA ${admin(schema)} CASCADE`
        console.log('PROBE_SCHEMA_REMOVED')
      }
    } finally { await admin.end({ timeout: 2 }) }
    process.removeListener('SIGINT', stop)
    process.removeListener('SIGTERM', stop)
  }
}
main().catch(() => { console.error(`DELIVERY_WEBHOOK_PROBE_FAILED stage=${stage}`); process.exitCode = 1 })
