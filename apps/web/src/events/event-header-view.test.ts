import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { dueText, nextLabel } from './event-header-view'

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-31T03:00:00Z'))
})
afterEach(() => {
  vi.useRealTimers()
})

test('다음 일정은 올해가 아니면 연도를 붙인다', () => {
  expect(nextLabel({ kind: 'start', startsAt: '2027-03-02T10:00' })).toBe(
    '다음 일정 · 2027년 3월 2일 (화) 10:00 행사 시작',
  )
  expect(nextLabel({ kind: 'task', dueDate: '2027-01-04', title: '장소 예약' })).toBe(
    '다음 일정 · 2027년 1월 4일 (월) 장소 예약',
  )
  expect(nextLabel({ kind: 'start', startsAt: '2026-11-02T10:00' })).toBe(
    '다음 일정 · 11월 2일 (월) 10:00 행사 시작',
  )
})

test('날짜만 있는 마감도 올해가 아니면 연도를 붙인다', () => {
  expect(dueText('2027-01-04')).toBe('2027년 1월 4일 (월)')
  expect(dueText('2026-11-04')).toBe('11월 4일 (수)')
})
