import assert from 'node:assert/strict'
import { test } from 'node:test'
import { drainDeliveryJobs, runDeliveryLoop } from './loop.js'

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

test('drain schedules renewals once, runs due jobs sequentially and ends when the queue is empty', async () => {
  let renewals = 0, calls = 0, active = false
  const order: string[] = []
  const result = await drainDeliveryJobs({
    worker: { async runOne() { assert.equal(active, false); active = true; order.push('job'); calls++; await Promise.resolve(); active = false; return calls <= 3 } },
    jobs: { async scheduleRenewals() { order.push('renew'); renewals++ } },
  })
  assert.deepEqual(result, { processed: 3, drained: true })
  assert.equal(renewals, 1); assert.equal(calls, 4)
  assert.equal(order[0], 'renew')
})

test('drain with nothing due finishes immediately', async () => {
  let calls = 0
  assert.deepEqual(await drainDeliveryJobs({ worker: { async runOne() { calls++; return false } }, jobs: { async scheduleRenewals() {} } }), { processed: 0, drained: true })
  assert.equal(calls, 1)
})

test('drain stops at the job limit or time budget and reports work may remain', async () => {
  const busy = { async runOne() { return true } }
  const jobs = { async scheduleRenewals() {} }
  assert.deepEqual(await drainDeliveryJobs({ worker: busy, jobs, maxJobs: 2 }), { processed: 2, drained: false })
  let now = 0
  const result = await drainDeliveryJobs({ worker: { async runOne() { now += 400; return true } }, jobs, budgetMs: 1000, now: () => now })
  assert.deepEqual(result, { processed: 3, drained: false })
})

test('drain surfaces infrastructure failures instead of ending successfully', async () => {
  let calls = 0
  await assert.rejects(drainDeliveryJobs({ worker: { async runOne() { calls++; throw new Error('DB') } }, jobs: { async scheduleRenewals() {} } }), /DB/)
  assert.equal(calls, 1)
  await assert.rejects(drainDeliveryJobs({ worker: { async runOne() { calls++; return false } }, jobs: { async scheduleRenewals() { throw new Error('RENEW') } } }), /RENEW/)
  assert.equal(calls, 1)
})
