import assert from 'node:assert/strict'
import { test } from 'node:test'
import { BulkApplicantsSchema, EventApplicantsQuerySchema } from './registrations.js'

const ID = '019e0000-0000-7000-8000-000000000000'
// 명단은 한 번에 읽고 거르기·쪽 넘김은 화면이 한다(DEC-93). 질의 값은 하나도 받지 않는다.
test('행사 명단 쿼리: 빈 질의만 받고 예전 쪽·거르기·찾기·열람 토큰과 모르는 키를 거절한다', () => {
  assert.deepEqual(EventApplicantsQuerySchema.parse({}), {})
  for (const body of [
    { page: '1' },
    { search: '김' },
    { needsAttention: 'true' },
    { attendance: 'attended' },
    { accessToken: 'x' },
    { extra: true },
  ])
    assert.equal(EventApplicantsQuerySchema.safeParse(body).success, false)
})
test('일괄 참가자 요청: 1~50개의 중복 없는 UUID만 받는다', () => {
  assert.deepEqual(BulkApplicantsSchema.parse({ registrationIds: [ID] }), { registrationIds: [ID] })
  const ids = Array.from(
    { length: 51 },
    (_, index) => `019e0000-0000-7000-8000-${index.toString(16).padStart(12, '0')}`,
  )
  assert.equal(BulkApplicantsSchema.safeParse({ registrationIds: ids.slice(0, 50) }).success, true)
  for (const body of [
    {},
    { registrationIds: [] },
    { registrationIds: [ID, ID.toUpperCase()] },
    { registrationIds: ids },
    { registrationIds: [''] },
    { registrationIds: [' '] },
    { registrationIds: ['a\u0000'] },
    { registrationIds: ['\ud800'] },
    { registrationIds: [ID], extra: true },
  ])
    assert.equal(BulkApplicantsSchema.safeParse(body).success, false)
})
