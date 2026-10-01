// Read-only live diagnostics. Never print configuration values or raw exceptions.
import { readFileSync } from 'node:fs'
import { parseEnv } from 'node:util'
import postgres from 'postgres'
import { createDeliveryTracker } from '../src/deliveries/delivery-tracker.js'

async function main() {
  let local: ReturnType<typeof parseEnv> = {}
  try { local = parseEnv(readFileSync(new URL('../../../.env', import.meta.url), 'utf8')) }
  catch { console.log('LOCAL_CONFIGURATION_UNAVAILABLE') }
  const env = { ...local, ...process.env }
  if (!env.DATABASE_URL) console.log('DB_CONFIGURATION_MISSING')
  else {
    const client = postgres(env.DATABASE_URL, { max: 1, ssl: { rejectUnauthorized: true }, connect_timeout: 10,
      connection: { statement_timeout: 10000 }, onnotice: () => {},
    })
    try {
      await client.begin('read only', async tx => {
        await tx`SELECT 1`
        console.log('DB_AUTHENTICATION_OK')
        const rows = await tx`SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('shipments','shipment_items','shipment_jobs','shipment_registrations')`
        const found = new Set(rows.map(row => row.table_name))
        for (const name of ['shipments', 'shipment_items', 'shipment_jobs', 'shipment_registrations']) {
          console.log(JSON.stringify({ table: name, exists: found.has(name) }))
        }
        const columns = await tx`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='shipments' AND column_name='tracking_version'`
        console.log(JSON.stringify({ trackingVersionColumn: columns.length === 1 }))
      })
    } catch { console.log('DB_CHECK_FAILED') }
    finally { await client.end({ timeout: 2 }) }
  }
  const clientId = env.DELIVERY_TRACKER_CLIENT_ID ?? env.DELIVERY_TEST_CLIENT_ID
  const clientSecret = env.DELIVERY_TRACKER_CLIENT_SECRET ?? env.DELIVERY_TEST_CLIENT_SECRET
  console.log(JSON.stringify({ deliveryClientIdConfigured: Boolean(clientId?.trim()), deliveryClientSecretConfigured: Boolean(clientSecret?.trim()), webhookSecretConfigured: Boolean(env.DELIVERY_WEBHOOK_SECRET?.trim()), publicUrlConfigured: Boolean(env.DELIVERY_PUBLIC_URL?.trim()) }))
  if (clientId && clientSecret) {
    try {
      const step = 3 * 60 * 60 * 1000
      const trackingNumber = new Date((Math.floor(Date.now() / step) + 1) * step).toISOString().replace('.000Z', 'Z')
      const result = await createDeliveryTracker({ clientId, clientSecret }).lookup({ carrierId: 'dev.track.dummy', trackingNumber })
      console.log(JSON.stringify({ result: 'DELIVERY_AUTHENTICATED_LOOKUP_OK', status: result.status }))
    } catch { console.log('DELIVERY_AUTHENTICATED_LOOKUP_FAILED') }
  } else console.log('DELIVERY_AUTHENTICATED_LOOKUP_SKIPPED_MISSING_CONFIGURATION')
}
main().catch(() => { console.error('DELIVERY_LIVE_CHECK_FAILED'); process.exitCode = 1 })
