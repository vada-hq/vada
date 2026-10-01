// Disposable live probe of the real API server and worker processes; never log credentials, callback URLs or raw errors.
import { spawn, type ChildProcess } from 'node:child_process'
import { randomBytes, randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { createServer, request as forward, type Server } from 'node:http'
import { fileURLToPath } from 'node:url'
import { parseEnv } from 'node:util'
import { setTimeout as delay } from 'node:timers/promises'
import postgres from 'postgres'
import { createDeliveryTracker } from '../src/deliveries/delivery-tracker.js'
import { createCallbackAddress } from '../src/deliveries/webhook.js'

const TUNNEL_PORT = 8898
const SERVER_PORT = 8899
let stage = 'configuration'

function start(name: string, entry: string, env: NodeJS.ProcessEnv) {
  const child = spawn(process.execPath, ['--import', 'tsx', entry], { cwd: fileURLToPath(new URL('..', import.meta.url)), env, stdio: ['ignore', 'pipe', 'pipe'] })
  // Children are product entry points; relay only their own fixed status lines, never unexpected output.
  for (const stream of [child.stdout, child.stderr]) {
    let rest = ''
    stream!.setEncoding('utf8').on('data', (chunk: string) => {
      const lines = (rest + chunk).split(/\r?\n/)
      rest = lines.pop() ?? ''
      for (const line of lines) if (line.trim()) console.log(`[${name}] ${/^(DELIVERY_[A-Z_]+|VADA |서버 )/.test(line) ? line.slice(0, 120) : '(output suppressed)'}`)
    })
  }
  child.once('exit', code => console.log(`[${name}] exited code=${code ?? 'killed'}`))
  return child
}
const ended = (child?: ChildProcess) => new Promise<void>(resolve => {
  if (!child || child.exitCode !== null || child.signalCode !== null) return resolve()
  child.once('exit', () => resolve())
  child.kill()
})

async function main() {
  const env = { ...parseEnv(readFileSync(new URL('../../../.env', import.meta.url), 'utf8')), ...process.env }
  if (!env.DATABASE_URL || !env.DELIVERY_TRACKER_CLIENT_ID || !env.DELIVERY_TRACKER_CLIENT_SECRET) throw new Error('CONFIGURATION')
  const publicUrl = process.argv[2] ?? ''
  const secret = randomBytes(32).toString('hex')
  const address = createCallbackAddress(publicUrl, secret)
  const schema = `delivery_probe_${randomUUID().replaceAll('-', '')}`
  if (!/^delivery_probe_[a-f0-9]{32}$/.test(schema)) throw new Error('SCHEMA')
  const options = { max: 2, ssl: { rejectUnauthorized: true }, connect_timeout: 10, onnotice: () => {} }
  const admin = postgres(env.DATABASE_URL, options)
  // The real processes only take DATABASE_URL. Neon ignores a startup search_path parameter but honors
  // options=-c on a direct (non-pooled) endpoint, so delivery tables resolve to the disposable schema
  // and everything else stays on public. Verified per run below before any process starts.
  const isolated = new URL(env.DATABASE_URL)
  if (!isolated.hostname.endsWith('.neon.tech') || isolated.searchParams.has('options')) throw new Error('EXPECTED_NEON')
  isolated.hostname = isolated.hostname.replace('-pooler.', '.')
  isolated.searchParams.set('options', `-c search_path=${schema},public`)
  const provider = createDeliveryTracker({ clientId: env.DELIVERY_TRACKER_CLIENT_ID, clientSecret: env.DELIVERY_TRACKER_CLIENT_SECRET })
  const step = 3 * 60 * 60 * 1000
  const input = { carrierId: 'dev.track.dummy', trackingNumber: new Date((Math.floor(Date.now() / step) + 1) * step).toISOString().replace('.000Z', 'Z') }
  const id = randomUUID()
  let created = false
  let workerStarted = false
  let server: ChildProcess | undefined
  let worker: ChildProcess | undefined
  let proxy: Server | undefined
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
    await admin`ALTER TABLE ${admin(schema)}.shipment_jobs ADD FOREIGN KEY (shipment_id) REFERENCES ${admin(schema)}.shipments(id)`
    stage = 'check_search_path'
    const check = postgres(isolated.toString(), { ...options, max: 1 })
    try {
      const [scope] = await check`SELECT (SELECT n.nspname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.oid = 'shipments'::regclass) AS shipments,
        (SELECT n.nspname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.oid = 'shipment_jobs'::regclass) AS jobs,
        (SELECT n.nspname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.oid = 'users'::regclass) AS users`
      if (scope?.shipments !== schema || scope.jobs !== schema || scope.users !== 'public') throw new Error('ISOLATION')
    } finally { await check.end({ timeout: 2 }) }
    stage = 'seed_shipment'
    await admin`INSERT INTO ${admin(schema)}.shipments (id, organization_id, created_by, carrier_id, tracking_number) VALUES (${id}, 'probe', 'probe', ${input.carrierId}, ${input.trackingNumber})`
    console.log('ISOLATED_DATABASE_READY')

    stage = 'server_process'
    const shared = { DATABASE_URL: isolated.toString(), DELIVERY_ENABLED: 'true', DELIVERY_TRACKING_ENABLED: 'true', DELIVERY_PUBLIC_URL: publicUrl, DELIVERY_WEBHOOK_SECRET: secret }
    server = start('server', 'src/serve.ts', { ...process.env, ...shared, PORT: String(SERVER_PORT), HOST: '127.0.0.1' })
    const local = `http://127.0.0.1:${SERVER_PORT}/api/health`
    for (let i = 0; ; i++) {
      if (server.exitCode !== null || i >= 60) throw new Error('SERVER')
      if (await fetch(local, { signal: AbortSignal.timeout(2000) }).then(r => r.ok, () => false)) break
      await delay(500)
    }
    console.log('REAL_SERVER_PROCESS_READY')

    stage = 'listener'
    let callbackAt = 0
    // The tunnel must not expose the whole API. Forward only health and the webhook route, and log
    // method, coarse route, status and timing; never path segments, headers or body.
    proxy = createServer((req, res) => {
      const at = new Date()
      const path = req.url ?? ''
      const route = req.method === 'GET' && path === '/api/health' ? 'health' : req.method === 'POST' && path.startsWith('/api/delivery-webhooks/') ? 'webhook' : 'blocked'
      const done = (status: number) => {
        console.log(`REQUEST at=${at.toISOString()} method=${(req.method ?? '').slice(0, 10)} route=${route} status=${status} ms=${Date.now() - at.getTime()}`)
        if (route === 'webhook' && status === 202) { callbackAt = at.getTime(); console.log('CALLBACK_ACCEPTED_BY_REAL_SERVER') }
      }
      if (route === 'blocked') { req.resume(); res.writeHead(404).end(); return done(404) }
      const upstream = forward({ host: '127.0.0.1', port: SERVER_PORT, method: req.method, path, headers: req.headers }, answer => {
        res.writeHead(answer.statusCode ?? 502, answer.headers)
        answer.pipe(res)
        answer.once('end', () => done(answer.statusCode ?? 502))
      })
      upstream.once('error', () => { if (!res.headersSent) res.writeHead(502); res.end(); done(502) })
      req.pipe(upstream)
    })
    await new Promise<void>((resolve, reject) => {
      proxy!.once('error', () => reject(new Error('LISTENER')))
      proxy!.listen(TUNNEL_PORT, '127.0.0.1', () => resolve())
    })
    stage = 'tunnel'
    const health = await fetch(new URL('/api/health', publicUrl), { headers: { 'ngrok-skip-browser-warning': 'true' }, signal: AbortSignal.timeout(15000) })
    if (!health.ok) throw new Error('TUNNEL')
    console.log('PUBLIC_TUNNEL_OK')

    stage = 'worker_process'
    workerStarted = true
    worker = start('worker', 'src/deliveries/run-worker.ts', { ...process.env, ...shared,
      DELIVERY_TRACKER_CLIENT_ID: env.DELIVERY_TRACKER_CLIENT_ID, DELIVERY_TRACKER_CLIENT_SECRET: env.DELIVERY_TRACKER_CLIENT_SECRET })

    stage = 'registration'
    let registered = false
    let lastState = ''
    const deadline = Date.now() + 10 * 60 * 1000
    while (!stopped && Date.now() < deadline) {
      if (server.exitCode !== null || worker.exitCode !== null) throw new Error('PROCESS_EXITED')
      const [row] = await admin`SELECT status, last_error_code, last_checked_at, webhook_expires_at FROM ${admin(schema)}.shipments WHERE id = ${id}`
      const jobs = await admin`SELECT kind, status, count(*)::int AS n FROM ${admin(schema)}.shipment_jobs GROUP BY kind, status ORDER BY kind, status`
      const state = `jobs=${jobs.map(j => `${j.kind}:${j.status}=${j.n}`).join(',') || 'none'} shipment=${row?.status} error=${row?.last_error_code ?? 'none'} checkedAt=${row?.last_checked_at?.toISOString() ?? 'none'}`
      if (state !== lastState) console.log(`STATE at=${new Date().toISOString()} ${state}`)
      lastState = state
      if (!registered && row?.webhook_expires_at) {
        registered = true
        stage = 'callback_and_refresh'
        console.log('PROVIDER_REGISTRATION_OK: use console Webhook Trigger now')
        console.log(`Dummy number: ${input.trackingNumber}`)
      }
      const refreshed = jobs.find(j => j.kind === 'refresh' && j.status === 'completed')?.n ?? 0
      if (callbackAt && refreshed >= 2 && row?.last_checked_at && row.last_checked_at.getTime() >= callbackAt && !row.last_error_code) {
        console.log(JSON.stringify({ result: 'LIVE_SERVER_WORKER_DB_UPDATE_OK', status: row.status, completedRefreshJobs: refreshed }))
        return
      }
      await delay(3000)
    }
    throw new Error('CALLBACK_TIMEOUT_OR_STOP')
  } finally {
    // Stop writers before removing their tables.
    await ended(worker)
    await ended(server)
    if (proxy) await new Promise<void>(resolve => { proxy!.closeAllConnections(); proxy!.close(() => resolve()) })
    if (workerStarted) {
      try {
        // Only this disposable registration is expired; product uses TTL-based unregister.
        await provider.register({ ...input, callbackUrl: address.url(id), expirationTime: new Date().toISOString() })
        console.log('PROBE_REMOTE_REGISTRATION_EXPIRED')
      } catch { console.log('PROBE_REMOTE_CLEANUP_FAILED: registration expires within 48h') }
    }
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
main().catch(() => { console.error(`DELIVERY_SERVER_PROBE_FAILED stage=${stage}`); process.exitCode = 1 })
