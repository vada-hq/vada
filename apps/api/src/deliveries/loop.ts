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

type DrainOptions = Pick<Options, 'worker' | 'jobs'> & { maxJobs?: number; budgetMs?: number; now?: () => number }

// 예약 실행용. 갱신 대상을 예약하고 지금 실행할 수 있는 작업을 비운 뒤 끝낸다.
// 오류를 삼키지 않는다. 실패로 종료해야 예약 실행 기록에서 장애가 드러난다.
export async function drainDeliveryJobs({ worker, jobs, maxJobs = 200, budgetMs = 4 * 60_000, now = Date.now }: DrainOptions) {
  const stopAt = now() + budgetMs
  await jobs.scheduleRenewals()
  let processed = 0
  while (processed < maxJobs && now() < stopAt) {
    if (!await worker.runOne()) return { processed, drained: true }
    processed++
  }
  return { processed, drained: false }
}
