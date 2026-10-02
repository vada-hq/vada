// Disposable live probe of `run-worker.ts --once`; never log credentials, callback URLs or raw errors.
import { spawn } from 'node:child_process'
import { randomBytes, randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { parseEnv } from 'node:util'
import postgres from 'postgres'
import { createDeliveryTracker } from '../src/deliveries/delivery-tracker.js'
import { createCallbackAddress } from '../src/deliveries/webhook.js'

let stage = 'configuration'

// The scheduled runner starts the product entry point exactly like this and reads its exit code.
function once(env: NodeJS.ProcessEnv) {
  return new Promise<{ code: number | null; lines: string[] }>(resolve => {
    const child = spawn(process.execPath, ['--import', 'tsx', 'src/deliveries/run-worker.ts', '--once'],
      { cwd: fileURLToPath(new URL('..', import.meta.url)), env, stdio: ['ignore', 'pipe', 'pipe'] })
    const lines: string[] = []
    // Relay only the worker's fixed status lines, never unexpected output.
    const keep = (line: string) => { if (line.trim()) lines.push(/^DELIVERY_[A-Z_]+/.test(line) ? line.slice(0, 120) : '(output suppressed)') }
    const tails: string[] = []
    for (const [index, stream] of [child.stdout, child.stderr].entries()) {
      tails[index] = ''
      // A chunk can end mid-line; keep the tail until its newline arrives.
      stream!.setEncoding('utf8').on('data', (chunk: string) => {
        const parts = (tails[index] + chunk).split(/\r?\n/)
        tails[index] = parts.pop() ?? ''
        parts.forEach(keep)
      })
    }
    // 'close' fires after both pipes are drained; 'exit' can arrive before the last status line.
    child.once('close', code => { tails.forEach(keep); resolve({ code, lines }) })
  })
}

async function main() {
  const env = { ...parseEnv(readFileSync(new URL('../../../.env', import.meta.url), 'utf8')), ...process.env }
  if (!env.DATABASE_URL || !env.DELIVERY_TRACKER_CLIENT_ID || !env.DELIVERY_TRACKER_CLIENT_SECRET) throw new Error('CONFIGURATION')
  // No callback is awaited here; any public HTTPS origin works and the registration is expired on exit.
  const publicUrl = process.argv[2] ?? ''
  const secret = randomBytes(32).toString('hex')
  const address = createCallbackAddress(publicUrl, secret)
  const schema = `delivery_probe_${randomUUID().replaceAll('-', '')}`
  if (!/^delivery_probe_[a-f0-9]{32}$/.test(schema)) throw new Error('SCHEMA')
  const options = { max: 2, ssl: { rejectUnauthorized: true }, connect_timeout: 10, onnotice: () => {} }
  const admin = postgres(env.DATABASE_URL, options)
  // Neon ignores a startup search_path parameter but honors options=-c on a direct (non-pooled) endpoint.
  const isolated = new URL(env.DATABASE_URL)
  if (!isolated.hostname.endsWith('.neon.tech') || isolated.searchParams.has('options')) throw new Error('EXPECTED_NEON')
  isolated.hostname = isolated.hostname.replace('-pooler.', '.')
  isolated.searchParams.set('options', `-c search_path=${schema},public`)
  const provider = createDeliveryTracker({ clientId: env.DELIVERY_TRACKER_CLIENT_ID, clientSecret: env.DELIVERY_TRACKER_CLIENT_SECRET })
  const step = 3 * 60 * 60 * 1000
  const input = { carrierId: 'dev.track.dummy', trackingNumber: new Date((Math.floor(Date.now() / step) + 1) * step).toISOString().replace('.000Z', 'Z') }
  const id = randomUUID()
  let created = false
  let attempted = false
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
        (SELECT n.nspname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.oid = 'shipment_jobs'::regclass) AS jobs`
      if (scope?.shipments !== schema || scope.jobs !== schema) throw new Error('ISOLATION')
    } finally { await check.end({ timeout: 2 }) }
    stage = 'seed_shipment'
    await admin`INSERT INTO ${admin(schema)}.shipments (id, organization_id, created_by, carrier_id, tracking_number) VALUES (${id}, 'probe', 'probe', ${input.carrierId}, ${input.trackingNumber})`
    console.log('ISOLATED_DATABASE_READY')

    const childEnv = { ...process.env, DATABASE_URL: isolated.toString(), DELIVERY_ENABLED: 'true', DELIVERY_TRACKING_ENABLED: 'true',
      DELIVERY_PUBLIC_URL: publicUrl, DELIVERY_WEBHOOK_SECRET: secret,
      DELIVERY_TRACKER_CLIENT_ID: env.DELIVERY_TRACKER_CLIENT_ID, DELIVERY_TRACKER_CLIENT_SECRET: env.DELIVERY_TRACKER_CLIENT_SECRET }
    const read = async () => {
      const [row] = await admin`SELECT status, last_error_code, last_checked_at, webhook_expires_at FROM ${admin(schema)}.shipments WHERE id = ${id}`
      const jobs = await admin`SELECT kind, status, count(*)::int AS n FROM ${admin(schema)}.shipment_jobs GROUP BY kind, status ORDER BY kind, status`
      return { row, jobs, text: `jobs=${jobs.map(j => `${j.kind}:${j.status}=${j.n}`).join(',') || 'none'} shipment=${row?.status} error=${row?.last_error_code ?? 'none'} checked=${Boolean(row?.last_checked_at)} registered=${Boolean(row?.webhook_expires_at)}` }
    }
    const completed = (jobs: readonly Record<string, unknown>[], kind: string) => Number(jobs.find(j => j.kind === kind && j.status === 'completed')?.n ?? 0)

    // Run 1 must register and apply the follow-up lookup in one pass, then exit 0.
    stage = 'first_run'
    attempted = true
    let started = Date.now()
    const first = await once(childEnv)
    const afterFirst = await read()
    console.log(`RUN 1 exit=${first.code} seconds=${((Date.now() - started) / 1000).toFixed(1)} | ${first.lines.join(' | ')}`)
    console.log(`STATE after run 1: ${afterFirst.text}`)
    if (first.code !== 0 || !afterFirst.row?.webhook_expires_at || !afterFirst.row.last_checked_at || afterFirst.row.last_error_code
      || completed(afterFirst.jobs, 'register') !== 1 || completed(afterFirst.jobs, 'refresh') !== 1) throw new Error('FIRST_RUN')

    // Run 2 has nothing due: it must exit 0 without creating or repeating work.
    stage = 'second_run'
    started = Date.now()
    const second = await once(childEnv)
    const afterSecond = await read()
    console.log(`RUN 2 exit=${second.code} seconds=${((Date.now() - started) / 1000).toFixed(1)} | ${second.lines.join(' | ')}`)
    console.log(`STATE after run 2: ${afterSecond.text}`)
    if (second.code !== 0 || afterSecond.text !== afterFirst.text || !second.lines.some(line => line.includes('processed=0'))) throw new Error('SECOND_RUN')
    console.log('LIVE_ONCE_MODE_OK')
  } finally {
    if (attempted) {
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
  }
}
main().catch(() => { console.error(`DELIVERY_ONCE_PROBE_FAILED stage=${stage}`); process.exitCode = 1 })
