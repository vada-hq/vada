import { KOREAN_DATE_LENGTH, koreanOf } from '@vada/contracts'

const TIME_FROM = KOREAN_DATE_LENGTH + 1

// "2026-10-25" → "10월 25일"
export function monthDay(date: string) {
  const [, month, day] = date.split('-')
  return `${Number(month)}월 ${Number(day)}일`
}

// ISO 시각 → '10월 20일 14:03'(한국 시각)
export function monthDayTime(iso: string) {
  const korean = koreanOf(new Date(iso))
  return `${monthDay(korean.slice(0, KOREAN_DATE_LENGTH))} ${korean.slice(TIME_FROM)}`
}
