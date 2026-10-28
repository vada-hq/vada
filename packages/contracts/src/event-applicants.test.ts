import assert from 'node:assert/strict'
import { test } from 'node:test'
import { BulkApplicantsSchema, EventApplicantsQuerySchema } from './registrations.js'

const ID = '019e0000-0000-7000-8000-000000000000'
test('행사 명단 쿼리: 첫 쪽 기본값과 필터를 읽고 빈 검색·상한 초과·제어 문자·모르는 값을 거절한다', () => {
  assert.deepEqual(EventApplicantsQuerySchema.parse({}), { page: 1 })
  assert.deepEqual(
    EventApplicantsQuerySchema.parse({
      page: '2',
      needsAttention: 'false',
      deposit: 'none',
      registration: 'active',
      attendance: 'not_attended',
    }),
    {
      page: 2,
      needsAttention: false,
      deposit: 'none',
      registration: 'active',
      attendance: 'not_attended',
    },
  )
  assert.equal(EventApplicantsQuerySchema.safeParse({ search: '😀'.repeat(50) }).success, true)
  for (const body of [
    { page: 0 },
    { page: 100001 },
    { page: 1.5 },
    { search: '' },
    { search: '  ' },
    { search: '😀'.repeat(51) },
    { search: '\u0000' },
    { search: '\ud800' },
    { needsAttention: true },
    { attendance: 'bad' },
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
