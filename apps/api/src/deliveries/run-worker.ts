import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import { trackingConfig } from './tracking-config.js'
import { createDeliveryTracker } from './delivery-tracker.js'
import { createDeliveryJobs } from './job-repository.js'
import { createDeliveryWorker } from './worker.js'
import { drainDeliveryJobs, runDeliveryLoop } from './loop.js'

async function main() {
  // 별도 프로세스. 환경변수는 배포 플랫폼/호출자가 주입하며 파일에서 읽지 않는다.
  const config = trackingConfig(process.env)
  if (!config || !process.env.DATABASE_URL?.trim()) throw new Error('DELIVERY_WORKER_NOT_CONFIGURED')
  const client = postgres(process.env.DATABASE_URL, { max: 2, ssl: { rejectUnauthorized: true }, connect_timeout: 15,
    connection: { statement_timeout: 30_000 }, onnotice: () => {},
  })
  const stop = new AbortController()
  const shutdown = () => stop.abort()
  process.once('SIGINT', shutdown); process.once('SIGTERM', shutdown)
  const jobs = createDeliveryJobs(drizzle(client))
  const provider = createDeliveryTracker({ clientId: process.env.DELIVERY_TRACKER_CLIENT_ID, clientSecret: process.env.DELIVERY_TRACKER_CLIENT_SECRET })
  const worker = createDeliveryWorker(jobs, provider, config.address)
  try {
    console.log('DELIVERY_WORKER_STARTED')
    // --once: 상시 프로세스 없이 예약 실행기가 주기적으로 호출한다. 실패는 종료 코드로 알린다.
    if (process.argv.includes('--once')) {
      const result = await drainDeliveryJobs({ worker, jobs })
      console.log(`DELIVERY_WORKER_DRAINED processed=${result.processed} remaining=${result.drained ? 'none' : 'possible'}`)
    } else await runDeliveryLoop({ worker, jobs, signal: stop.signal, onFailure: () => console.error('DELIVERY_WORKER_TICK_FAILED') })
  } finally {
    process.removeListener('SIGINT', shutdown); process.removeListener('SIGTERM', shutdown)
    await client.end({ timeout: 5 })
  }
}
main().catch(() => { console.error('DELIVERY_WORKER_STOPPED: configuration or infrastructure failure'); process.exitCode = 1 })
