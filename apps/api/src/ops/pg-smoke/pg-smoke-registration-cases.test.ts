import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createTestDb } from '../../db/test-db.js'
import { pgliteConnection } from '../../test-support/smoke-connection.js'
import {
  cancelAndCheckInCase,
  completeAndApplyCase,
  completeAndConfirmCase,
  completeAndSpendCase,
  confirmAndCancelTogetherCase,
  confirmTogetherCase,
  lastSeatTogetherCase,
  sameQrTogetherCase,
  smokeCases,
} from './pg-smoke-cases.js'

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

test('출석 동시 처리 사례 둘이 점검 목록에 있다', () => {
  assert.ok(smokeCases.includes(sameQrTogetherCase))
  assert.ok(smokeCases.includes(cancelAndCheckInCase))
  assert.ok(smokeCases.includes(confirmTogetherCase))
  for (const added of [
    confirmAndCancelTogetherCase,
    completeAndSpendCase,
    completeAndConfirmCase,
    completeAndApplyCase,
  ])
    assert.ok(smokeCases.includes(added), added.name)
})

for (const [smokeCase, detail] of [
  [sameQrTogetherCase, /already/],
  [cancelAndCheckInCase, /취소와 출석/],
  [confirmTogetherCase, /DEPOSIT_EXISTS/],
  [confirmAndCancelTogetherCase, /환불 대기/],
  [completeAndSpendCase, /EVENT_COMPLETED/],
  [completeAndConfirmCase, /입금 확인/],
  [completeAndApplyCase, /REGISTRATION_NOT_OPEN/],
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
