import { expect, test } from 'vitest'
import { NO_OWNER_LABEL, ownerLabel, whenLabel } from './event-view'

test('일시는 요일과 함께 한 줄로 보인다', () => {
  expect(whenLabel({ startsAt: '2026-10-25T14:00', endsAt: '2026-10-25T18:00' })).toBe(
    '10월 25일 (일) 14:00 ~ 18:00',
  )
  expect(whenLabel({ startsAt: '2026-10-24T14:00', endsAt: null })).toBe('10월 24일 (토) 14:00')
})

test('끝이 다른 날이면 끝에도 날짜를 쓰고, 시작이 없으면 날짜 미정이다', () => {
  expect(whenLabel({ startsAt: '2026-10-24T20:00', endsAt: '2026-10-25T02:00' })).toBe(
    '10월 24일 (토) 20:00 ~ 10월 25일 (일) 02:00',
  )
  expect(whenLabel({ startsAt: null, endsAt: null })).toBe('날짜 미정')
})

test('책임자가 없거나 떠났으면 그대로 알린다', () => {
  expect(ownerLabel(null)).toBe(NO_OWNER_LABEL)
  expect(ownerLabel({ id: 'm1', name: '김회장', current: true })).toBe('김회장')
  expect(ownerLabel({ id: 'm1', name: '김회장', current: false })).toBe('떠난 사람: 김회장')
})
