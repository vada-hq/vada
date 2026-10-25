import { KOREAN_DATE_LENGTH, koreanOf, koreanYearOf } from '@vada/contracts'

const TIME_FROM = KOREAN_DATE_LENGTH + 1
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

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

// 한국 시각 'YYYY-MM-DDTHH:mm' → '10월 25일 (토) 14:00'. 요일은 날짜만으로 센다(시간대에 기대지 않는다).
export function dayTime(value: string) {
  const [date = '', time = ''] = value.split('T')
  const [year = 0, month = 1, day = 1] = date.split('-').map(Number)
  const weekday = WEEKDAYS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()]
  return { date, time, weekday, text: `${monthDay(date)} (${weekday}) ${time}` }
}

// 올해가 아니면 앞에 '2026년'을 붙인다.
function withYear(date: string, label: string, now: Date) {
  const [year = ''] = date.split('-')
  return year === koreanYearOf(now) ? label : `${year}년 ${label}`
}

// ISO 시각 → '10월 25일 (토)'(한국 날짜). 올해가 아니면 앞에 '2026년'을 붙인다.
export function dayLabel(iso: string, now: Date = new Date()) {
  const { date, weekday } = dayTime(koreanOf(new Date(iso)))
  return withYear(date, `${monthDay(date)} (${weekday})`, now)
}

// ISO 시각 → '10월 25일 (토) 14:00'(한국 시각). 올해가 아니면 앞에 '2026년'을 붙인다.
export function dayTimeLabel(iso: string, now: Date = new Date()) {
  const { date, text } = dayTime(koreanOf(new Date(iso)))
  return withYear(date, text, now)
}
