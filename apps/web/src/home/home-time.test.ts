import { afterEach, expect, test, vi } from 'vitest'
import { milestoneText } from './event-lane-view'
import { greetingDate } from './home-time'

afterEach(() => {
  vi.useRealTimers()
})

test('인사 카드의 날짜는 홈의 오늘에 요일을 붙인다', () => {
  expect(greetingDate('2026-10-26')).toBe('10월 26일 (월)')
  expect(greetingDate('2026-10-25')).toBe('10월 25일 (일)')
})

test('홈 행사 칸의 다음 일정은 올해가 아니면 연도를 붙인다', () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-12-20T03:00:00Z'))
  const lane = (date: string) => ({
    milestone: { kind: 'registration_close' as const, date, days: 12 },
  })
  expect(milestoneText(lane('2027-01-01') as never)?.dateText).toBe('2027년 1월 1일 (금)')
  expect(milestoneText(lane('2026-12-30') as never)?.dateText).toBe('12월 30일 (수)')
})
