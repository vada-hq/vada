import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createTestDb } from '../../db/test-db.js'
import { pgliteConnection } from '../../test-support/smoke-connection.js'
import { smokeCases } from './pg-smoke-cases.js'
import type { SmokeCase, SmokeVerdict } from './pg-smoke-kit.js'
import { sameSourceExpensesCase, sameSourceRequestsCase } from './pg-smoke-source-cases.js'

// PGlite는 거래를 하나씩 돌려 잠금이 실제로 동시 처리를 막는지는 증명하지 못한다(그것은 실제 PostgreSQL의 pg-smoke가 보인다).
// 여기서는 사례의 준비와 판정이 맞는지만 본다.
const now = new Date('2026-10-19T03:00:00Z')

async function run(smokeCase: SmokeCase): Promise<SmokeVerdict> {
  const testDb = await createTestDb()
  try {
    return await smokeCase.run({
      connect: () => pgliteConnection(testDb),
      now,
      sessionLimitMs: 2000,
    })
  } finally {
    await testDb.close()
  }
}

test('같은 메시지로 구매 요청 둘을 동시에: 하나만 생기고 뒤의 것은 SOURCE_MESSAGE_USED다 (모양만 본다)', async () => {
  const verdict = await run(sameSourceRequestsCase)
  assert.ok(verdict.ok, JSON.stringify(verdict))
  assert.match(verdict.detail, /하나만 생기고/)
})

test('같은 메시지로 지출 둘을 동시에: 하나만 생기고 뒤의 것은 SOURCE_MESSAGE_USED다 (모양만 본다)', async () => {
  const verdict = await run(sameSourceExpensesCase)
  assert.ok(verdict.ok, JSON.stringify(verdict))
  assert.match(verdict.detail, /하나만 생기고/)
})

test('두 사례는 실제 PostgreSQL 점검 목록에 들어 있다', () => {
  assert.ok(smokeCases.includes(sameSourceRequestsCase))
  assert.ok(smokeCases.includes(sameSourceExpensesCase))
})
