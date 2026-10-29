import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createPendingPush } from './pending.js'

function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>(done => (resolve = done))
  return { promise, resolve }
}

test('settle은 기다리는 중에 새로 추적한 일까지 기다린다', async () => {
  const pending = createPendingPush(() => new Promise(() => {}))
  const first = deferred()
  const second = deferred()
  void pending.track(first.promise)
  let settled = false
  const done = pending.settle(5000).then(() => (settled = true))
  void pending.track(second.promise)
  first.resolve()
  await first.promise
  await new Promise<void>(resolve => setImmediate(resolve))
  assert.equal(settled, false)
  second.resolve()
  await done
  assert.equal(settled, true)
})

test('상한이 지나면 끝나지 않는 일과 거절이 있어도 던지지 않고 돌아온다', async () => {
  const deadline = deferred()
  const waits: number[] = []
  const pending = createPendingPush(ms => {
    waits.push(ms)
    return deadline.promise
  })
  void pending.track(new Promise<void>(() => {}))
  void pending.track(Promise.reject(new Error('secret')))
  const done = pending.settle(5000)
  deadline.resolve()
  await done
  assert.deepEqual(waits, [5000])
})

test('flush 등록은 바로 불리고 settle도 flush가 만든 일을 기다린다', async () => {
  const pending = createPendingPush(() => new Promise(() => {}))
  const job = deferred()
  let calls = 0
  pending.onFlush(() => {
    calls++
    void pending.track(job.promise)
  })
  pending.onFlush(() => {
    throw new Error('secret')
  })
  pending.flush()
  assert.equal(calls, 1)
  const done = pending.settle(5000)
  assert.equal(calls, 2)
  job.resolve()
  await done
})

test('주입한 기다림이 던져도 settle은 던지지 않는다', async () => {
  const pending = createPendingPush(() => {
    throw new Error('secret')
  })
  void pending.track(new Promise<void>(() => {}))
  await pending.settle(5000)
})
