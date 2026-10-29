import assert from 'node:assert/strict'
import { test } from 'node:test'
import { shutdown } from './shutdown.js'

function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>(done => (resolve = done))
  return { promise, resolve }
}

type Step = 'purge' | 'flush' | 'server' | 'idle' | 'wait' | 'settle' | 'db' | 'sentry'
function setup(options: { closes?: boolean; fails?: Step; idle?: boolean } = {}) {
  const calls: Step[] = []
  const deadline = deferred()
  const startedWaiting = deferred()
  const waits: number[] = []
  const signals: (AbortSignal | undefined)[] = []
  const settleLimits: number[] = []
  const dbOptions: { timeout: number }[] = []
  const step = (name: Step) => {
    calls.push(name)
    if (options.fails === name) throw new Error('secret')
  }
  const deps = {
    stopPurge: () => step('purge'),
    pending: {
      flush: () => step('flush'),
      settle: async (ms: number) => {
        settleLimits.push(ms)
        step('settle')
      },
    },
    server: {
      close: (closed: () => void) => {
        step('server')
        if (options.closes) closed()
      },
      ...(options.idle === false ? {} : { closeIdleConnections: () => step('idle') }),
    },
    client: {
      end: async (value: { timeout: number }) => {
        dbOptions.push(value)
        step('db')
      },
    },
    stopErrorReporting: async () => step('sentry'),
  }
  const pause = (ms: number, signal?: AbortSignal) => {
    waits.push(ms)
    signals.push(signal)
    startedWaiting.resolve()
    step('wait')
    return deadline.promise
  }
  return { deps, pause, calls, deadline, startedWaiting, waits, signals, settleLimits, dbOptions }
}

test('HTTP가 닫히지 않아도 상한 뒤 알림·DB·오류 보고를 차례로 닫는다', async () => {
  const s = setup()
  const done = shutdown(s.deps, s.pause)
  await s.startedWaiting.promise
  assert.deepEqual(s.calls, ['purge', 'flush', 'server', 'idle', 'wait'])
  assert.deepEqual(s.waits, [10_000])
  s.deadline.resolve()
  await done
  assert.deepEqual(s.calls, ['purge', 'flush', 'server', 'idle', 'wait', 'settle', 'db', 'sentry'])
  assert.deepEqual(s.settleLimits, [5000])
  assert.deepEqual(s.dbOptions, [{ timeout: 5 }])
  assert.equal(s.signals[0]?.aborted, true)
})

test('서버가 바로 닫히면 상한을 기다리지 않고 기다림을 취소한다', async () => {
  const s = setup({ closes: true })
  await shutdown(s.deps, s.pause)
  assert.deepEqual(s.calls, ['purge', 'flush', 'server', 'idle', 'wait', 'settle', 'db', 'sentry'])
  assert.equal(s.signals[0]?.aborted, true)
})

test('빈 연결 닫기가 없는 서버도 종료한다', async () => {
  const s = setup({ closes: true, idle: false })
  await shutdown(s.deps, s.pause)
  assert.deepEqual(s.calls, ['purge', 'flush', 'server', 'wait', 'settle', 'db', 'sentry'])
})

for (const fails of ['purge', 'flush', 'server', 'idle', 'wait', 'settle', 'db', 'sentry'] as const)
  test(`${fails} 단계가 던져도 다음 종료 단계를 막거나 밖으로 던지지 않는다`, async () => {
    const s = setup({ closes: true, fails })
    await assert.doesNotReject(shutdown(s.deps, s.pause))
    assert.ok(s.calls.indexOf('purge') < s.calls.indexOf('flush'))
    assert.ok(s.calls.indexOf('flush') < s.calls.indexOf('server'))
    assert.ok(s.calls.indexOf('server') < s.calls.indexOf('settle'))
    assert.ok(s.calls.indexOf('settle') < s.calls.indexOf('db'))
    assert.ok(s.calls.indexOf('db') < s.calls.indexOf('sentry'))
    assert.deepEqual(s.settleLimits, [5000])
    assert.deepEqual(s.dbOptions, [{ timeout: 5 }])
  })
