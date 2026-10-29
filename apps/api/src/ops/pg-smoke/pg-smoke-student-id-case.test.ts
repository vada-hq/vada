import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createTestDb } from '../../db/test-db.js'
import { pgliteConnection } from '../../test-support/smoke-connection.js'
import { smokeCases } from './pg-smoke-cases.js'
import { sameStudentIdTogetherCase } from './pg-smoke-student-id-case.js'

// PGlite는 거래를 하나씩 돌려 잠금이 동시 신청을 막는지 증명하지 못한다. 준비와 판정의 모양만 본다.
test('같은 학번 동시 신청 사례가 점검 목록에 있고 준비와 판정이 맞다', async () => {
  assert.ok(smokeCases.includes(sameStudentIdTogetherCase))
  const testDb = await createTestDb()
  try {
    const verdict = await sameStudentIdTogetherCase.run({
      connect: () => pgliteConnection(testDb),
      now: new Date('2026-10-19T03:00:00Z'),
      sessionLimitMs: 2000,
    })
    assert.equal(verdict.ok, true, JSON.stringify(verdict))
    assert.match(verdict.detail, /DUPLICATE_STUDENT_ID/)
  } finally {
    await testDb.close()
  }
})
