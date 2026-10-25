import { expect, test } from 'vitest'
import { dayLabel, dayTimeLabel } from './korean-date-text'

test('결재 날짜는 한국 날짜와 요일이고, 올해가 아니면 연도가 앞에 붙는다', () => {
  const now = new Date('2026-12-01T00:00:00Z')
  expect(dayLabel('2026-10-24T15:30:00.000Z', now)).toBe('10월 25일 (일)')
  expect(dayLabel('2025-12-31T14:59:00.000Z', now)).toBe('2025년 12월 31일 (수)')
})

test('시각은 한국 날짜, 요일, 시각이고, 올해가 아니면 연도가 앞에 붙는다', () => {
  const now = new Date('2026-12-01T00:00:00Z')
  expect(dayTimeLabel('2026-10-18T15:30:00.000Z', now)).toBe('10월 19일 (월) 00:30')
  expect(dayTimeLabel('2026-10-18T14:59:00.000Z', now)).toBe('10월 18일 (일) 23:59')
  expect(dayTimeLabel('2025-12-31T14:59:00.000Z', now)).toBe('2025년 12월 31일 (수) 23:59')
})
