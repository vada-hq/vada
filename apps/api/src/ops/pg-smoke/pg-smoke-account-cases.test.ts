import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createTestDb } from '../../db/test-db.js'
import { pgliteConnection } from '../../test-support/smoke-connection.js'
import { closeAndSpendCase, mainAccountTogetherCase } from './pg-smoke-account-cases.js'
import { smokeCases } from './pg-smoke-cases.js'
import type { SmokeCase, SmokeVerdict } from './pg-smoke-kit.js'

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

test('대표 계좌를 동시에 만들기: 하나만 만들어지고 나머지는 MAIN_ACCOUNT_EXISTS다 (모양만 본다)', async () => {
  const verdict = await run(mainAccountTogetherCase)
  assert.ok(verdict.ok, JSON.stringify(verdict))
  assert.match(verdict.detail, /대표 계좌는 하나뿐/)
})

test('계좌 닫기와 지출 적기: 닫기가 먼저면 거절, 지출이 먼저면 둘 다 된다 (모양만 본다)', async () => {
  const verdict = await run(closeAndSpendCase)
  assert.ok(verdict.ok, JSON.stringify(verdict))
  assert.match(verdict.detail, /닫기가 먼저면/)
})

test('두 사례는 실제 PostgreSQL 점검 목록에 들어 있다', () => {
  assert.ok(smokeCases.includes(mainAccountTogetherCase))
  assert.ok(smokeCases.includes(closeAndSpendCase))
})
