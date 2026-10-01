import assert from 'node:assert/strict'
import { test } from 'node:test'
import { runDeliveryLoop } from './loop.js'

test('loop survives errors, is sequential, renews on startup and stops cleanly', async () => {
  const controller = new AbortController()
  let calls = 0, renewals = 0, failures = 0, active = false
  await runDeliveryLoop({
    worker: { async runOne() { assert.equal(active, false); active = true; calls++; await Promise.resolve(); active = false; if (calls === 1) throw new Error('SECRET'); return false } },
    jobs: { async scheduleRenewals() { renewals++ } },
    signal: controller.signal,
    wait: async () => { if (calls === 3) controller.abort() },
    onFailure: () => { failures++ },
  })
  assert.equal(calls, 3); assert.equal(renewals, 1); assert.equal(failures, 1)
})
