import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createTestDb } from '../../db/test-db.js'
import { pgliteConnection } from '../../test-support/smoke-connection.js'
import { purchaseEstimateCase } from './pg-smoke-purchase-estimate-case.js'

test('예상가격 PG 점검 사례의 준비·판정이 맞다(실제 PG 실행은 진행 담당)', async () => {
  const testDb = await createTestDb()
  try {
    const result = await purchaseEstimateCase.run({
      connect: () => pgliteConnection(testDb),
      now: new Date('2026-10-25T03:00:00Z'),
      sessionLimitMs: 2000,
    })
    assert.equal(result.ok, true, JSON.stringify(result))
  } finally {
    await testDb.close()
  }
})
