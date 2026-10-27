import { expect, test } from 'vitest'
import { greetingDate } from './home-time'

test('인사 카드의 날짜는 홈의 오늘에 요일을 붙인다', () => {
  expect(greetingDate('2026-10-26')).toBe('10월 26일 (월)')
  expect(greetingDate('2026-10-25')).toBe('10월 25일 (일)')
})
