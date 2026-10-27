import { DAY_MS, KOREAN_DATE_LENGTH } from '@vada/contracts'

// 달력 칸 계산. 날짜는 모두 한국 날짜 글('YYYY-MM-DD'), 달은 'YYYY-MM'이다. 업무 달력과 날짜 고르기가 같이 쓴다.
const WEEK_DAYS = 7
const MONTH_LENGTH = 7
export const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'] as const

const utc = (date: string) => new Date(`${date}T00:00:00Z`)
const dateText = (date: Date) => date.toISOString().slice(0, KOREAN_DATE_LENGTH)

export const addDays = (date: string, days: number) =>
  dateText(new Date(utc(date).getTime() + days * DAY_MS))
export const monthOf = (date: string) => date.slice(0, MONTH_LENGTH)
export const weekdayOf = (date: string) => utc(date).getUTCDay()

export function shiftMonth(month: string, by: number) {
  const [year = 0, number = 1] = month.split('-').map(Number)
  return dateText(new Date(Date.UTC(year, number - 1 + by, 1))).slice(0, MONTH_LENGTH)
}

export function monthLabel(month: string) {
  const [year, number] = month.split('-').map(Number)
  return `${year}년 ${number}월`
}

// '10월 24일 (토)'
export function dayLabel(date: string) {
  const [, month, day] = date.split('-').map(Number)
  return `${month}월 ${day}일 (${WEEKDAYS[weekdayOf(date)]})`
}

// 그 달을 덮는 주들. 한국 달력처럼 일요일에 시작한다.
export function weeksOf(month: string): string[][] {
  const first = `${month}-01`
  const next = `${shiftMonth(month, 1)}-01`
  const weeks: string[][] = []
  for (
    let start = addDays(first, -weekdayOf(first));
    start < next;
    start = addDays(start, WEEK_DAYS)
  )
    weeks.push(Array.from({ length: WEEK_DAYS }, (_, index) => addDays(start, index)))
  return weeks
}
