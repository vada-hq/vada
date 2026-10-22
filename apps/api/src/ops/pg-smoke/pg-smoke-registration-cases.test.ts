import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createTestDb } from '../../db/test-db.js'
import { pgliteConnection } from '../../test-support/smoke-connection.js'
import { lastSeatTogetherCase, smokeCases } from './pg-smoke-cases.js'

// PGlite는 거래를 하나씩 돌려 잠금이 동시 처리를 막는지 증명하지 못한다. 준비와 판정의 모양만 본다.
const now = new Date('2026-10-19T03:00:00Z')

test('마지막 한 자리 동시 신청 사례가 점검 목록에 있다', () => {
  assert.ok(smokeCases.includes(lastSeatTogetherCase))
})

test('마지막 한 자리 동시 신청: 신청 하나와 나머지의 REGISTRATION_FULL (PGlite는 순서대로 돌려 모양만 본다)', async () => {
  const testDb = await createTestDb()
  try {
    const verdict = await lastSeatTogetherCase.run({
      connect: () => pgliteConnection(testDb),
      now,
      sessionLimitMs: 2000,
    })
    assert.equal(verdict.ok, true, JSON.stringify(verdict))
    assert.match(verdict.detail, /정원 참/)
  } finally {
    await testDb.close()
  }
})
