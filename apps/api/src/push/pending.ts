import { setTimeout } from 'node:timers/promises'

type Wait = (ms: number, signal?: AbortSignal) => Promise<void>
const wait: Wait = async (ms, signal) => {
  await setTimeout(ms, undefined, { signal })
}

function flushAll(flushers: ReadonlySet<() => void>) {
  for (const run of flushers) {
    try {
      run()
    } catch {
      // 한 타이머의 실패가 나머지 알림을 막지 않는다.
    }
  }
}

// 종료 전에 메모리에서 시작한 알림을 마친다. 영구 보관은 하지 않는다(outbox는 나중).
export function createPendingPush(pause: Wait = wait) {
  const active = new Set<Promise<void>>()
  const flushers = new Set<() => void>()
  function track<T>(promise: Promise<T>) {
    const done = promise.then(
      () => {},
      () => {},
    )
    active.add(done)
    void done.then(() => {
      active.delete(done)
    })
    return promise
  }
  const flush = () => flushAll(flushers)
  async function settle(limitMs: number) {
    const controller = new AbortController()
    let expired = false
    const deadline = Promise.resolve()
      .then(() => pause(limitMs, controller.signal))
      .then(
        () => {
          expired = true
        },
        () => {
          expired = true
        },
      )
    try {
      flush()
      while (active.size && !expired) await Promise.race([Promise.all(active), deadline])
    } finally {
      controller.abort()
    }
  }
  return {
    track,
    onFlush: (run: () => void) => {
      flushers.add(run)
    },
    flush,
    settle,
  }
}
export type PendingPush = ReturnType<typeof createPendingPush>
