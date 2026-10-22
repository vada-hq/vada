import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createTestDb } from '../../db/test-db.js'
import { pgliteConnection } from '../../test-support/smoke-connection.js'
import {
  publishAndCompleteCase,
  publishAndSpendCase,
  publishTogetherCase,
  smokeCases,
} from './pg-smoke-cases.js'

// PGlite는 거래를 하나씩 돌려 잠금이 동시 처리를 막는지 증명하지 못한다. 준비와 판정의 모양만 본다.
const now = new Date('2026-10-19T03:00:00Z')

test('결산 공개 사례 셋이 점검 목록에 있다', () => {
  for (const added of [publishTogetherCase, publishAndSpendCase, publishAndCompleteCase])
    assert.ok(smokeCases.includes(added), added.name)
})

for (const [smokeCase, detail] of [
  [publishTogetherCase, /결산 기록 1개/],
  [publishAndSpendCase, /이월금/],
  [publishAndCompleteCase, /참가비/],
] as const)
  test(`${smokeCase.name}: 준비와 판정이 맞다 (PGlite는 순서대로 돌려 모양만 본다)`, async () => {
    const testDb = await createTestDb()
    try {
      const verdict = await smokeCase.run({
        connect: () => pgliteConnection(testDb),
        now,
        sessionLimitMs: 2000,
      })
      assert.equal(verdict.ok, true, JSON.stringify(verdict))
      assert.match(verdict.detail, detail)
    } finally {
      await testDb.close()
    }
  })
