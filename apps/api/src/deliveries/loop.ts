import { setTimeout as delay } from 'node:timers/promises'

type Options = {
  worker: { runOne(): Promise<boolean> }
  jobs: { scheduleRenewals(): Promise<void> }
  signal: AbortSignal
  wait?: () => Promise<void>
  onFailure?: () => void
}

export async function runDeliveryLoop({ worker, jobs, signal, wait, onFailure }: Options) {
  let nextRenewal = 0
  while (!signal.aborted) {
    try {
      if (Date.now() >= nextRenewal) {
        await jobs.scheduleRenewals()
        nextRenewal = Date.now() + 60_000
      }
      if (!signal.aborted) await worker.runOne()
    } catch { onFailure?.() }
    if (!signal.aborted) {
      try { if (wait) await wait(); else await delay(5000, undefined, { signal }) }
      catch { if (!signal.aborted) throw new Error('DELIVERY_WORKER_WAIT_FAILED') }
    }
  }
}
