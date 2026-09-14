import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { DASHBOARD_FIXTURES, FILTERED_FIXTURES } from './data-fixtures'

const PARAMETER_CASES: Record<string, string>[] = [
  {},
  {
    eventId: 'E-01',
    meetingId: 'MTG-01',
    taskId: 'T-01',
    requestId: 'PR-2026-0031',
    itemId: 'ITEM-01',
    roomId: 'ROOM-01',
    memberId: 'M-01',
    status: 'all',
    scope: 'all',
    stage: 'review',
    tab: 'todo',
    filter: 'all',
    type: 'all',
    page: '1',
    setupMode: 'copyBase',
    inviteCode: 'AB12CD34',
    checkInToken: 'A7K2M9',
    receiptToken: 'RCPT-A7K2M9',
    surveyToken: 'SVY-4f2a91c7',
    month: '2026-07',
  },
  {
    eventId: 'E-02',
    meetingId: 'MTG-09',
    taskId: 'T-03',
    requestId: '',
    status: 'done',
    scope: 'mine',
    stage: 'spent',
    tab: 'inProgress',
    query: '주간',
    filter: 'mine',
    type: 'meeting',
    page: '2',
    setupMode: 'new',
    month: '2026-06',
  },
  {
    eventId: 'UNKNOWN',
    meetingId: 'UNKNOWN',
    taskId: 'UNKNOWN',
    requestId: 'UNKNOWN',
    memberId: 'UNKNOWN',
    query: '없는 값',
    inviteCode: 'UNKNOWN',
    checkInToken: 'UNKNOWN',
    receiptToken: 'UNKNOWN',
    surveyToken: 'UNKNOWN',
  },
]

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical)
  if (value === null || typeof value !== 'object') return value
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nested]) => [key, canonical(nested)]),
  )
}

function fixtureFingerprint(): string {
  const direct = Object.fromEntries(
    Object.entries(DASHBOARD_FIXTURES).sort(([left], [right]) => left.localeCompare(right)),
  )
  const filtered = Object.fromEntries(
    Object.entries(FILTERED_FIXTURES)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, resolve]) => [key, PARAMETER_CASES.map((params) => resolve(params))]),
  )
  return createHash('sha256')
    .update(JSON.stringify(canonical({ direct, filtered })))
    .digest('hex')
}

describe('개발용 fixture 공개 계약', () => {
  // data-fixtures.ts를 도메인별로 나누는 동안만 두는 특성 검사다. 실제 fixture 값을
  // 바꾸는 작업은 이 기준값 변경을 별도 변경으로 드러내야 한다.
  it('도메인 모듈로 나눠도 키와 대표 응답이 그대로다', () => {
    expect(fixtureFingerprint()).toBe('d9c690ca6ea6c400c4823a49ee5c6117d215c3b6463d2c83c6b1ccbec079fb0a')
  })
})
