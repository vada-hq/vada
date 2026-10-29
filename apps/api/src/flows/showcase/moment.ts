import { DAY_MS, dateFromKorean, dayTime, KOREAN_DATE_LENGTH, monthDay } from '@vada/contracts'
import type { Day, Moment } from './content/types.js'

// 내용 파일의 상대 때를 돌리는 날(한국 날짜) 기준의 실제 날짜와 시각으로 바꾼다.
// 'D-4 22:41'은 나흘 전 22:41(한국), 'D+1'은 다음 날, 'D0'은 돌리는 날이다. 글 안의 '{{D+1}}'은 '10월 31일 (토)', '{{D-1 주}}'는 '10월 5주'다.
const DAY = /^D(0|[+-][1-9]\d*)$/
const MOMENT = /^(D(?:0|[+-][1-9]\d*)) ((?:[01]\d|2[0-3]):[0-5]\d)$/
const PLACEHOLDER = /\{\{(D(?:0|[+-][1-9]\d*))( 주)?\}\}/g
const THURSDAY_FROM_MONDAY = 3
const DAYS_IN_WEEK = 7

// 'YYYY-MM-DD' 글자끼리 날 수를 더한다(시간대와 상관없이 달력으로).
const plusDays = (date: string, days: number) =>
  new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS)
    .toISOString()
    .slice(0, KOREAN_DATE_LENGTH)

function offsetOf(day: string): number {
  const match = DAY.exec(day)
  if (!match) throw new Error(`날짜 꼴이 아니다: '${day}' (예: D0, D+1, D-4)`)
  return Number(match[1])
}

// 그 날이 든 주(월~일)의 목요일이 든 달과 그 달의 몇째 주인지(한국 산업 표준의 주차 셈). '10월 5주'.
function weekLabel(date: string) {
  const weekday = new Date(`${date}T00:00:00Z`).getUTCDay()
  const thursday = plusDays(
    date,
    THURSDAY_FROM_MONDAY - ((weekday + DAYS_IN_WEEK - 1) % DAYS_IN_WEEK),
  )
  const [, month, day] = thursday.split('-').map(Number)
  return `${month}월 ${Math.ceil(day! / DAYS_IN_WEEK)}주`
}

// '10월 31일 (토)'(화면의 날짜 꼴)
const dayLabelOf = (date: string) => `${monthDay(date)} (${dayTime(`${date}T00:00`).weekday})`

export function createCalendar(runDay: string) {
  const dayOf = (day: Day) => plusDays(runDay, offsetOf(day))
  const koreanOfMoment = (moment: Moment) => {
    const match = MOMENT.exec(moment)
    if (!match) throw new Error(`때 꼴이 아니다: '${moment}' (예: D-4 22:41)`)
    return `${dayOf(match[1] as Day)}T${match[2]}`
  }
  const text = (value: string) => {
    const filled = value.replace(PLACEHOLDER, (_, day: Day, week?: string) =>
      week ? weekLabel(dayOf(day)) : dayLabelOf(dayOf(day)),
    )
    if (filled.includes('{{')) throw new Error(`모르는 자리 글: '${value}'`)
    return filled
  }
  return {
    dayOf,
    // 한국 시각 'YYYY-MM-DDTHH:mm'(계약의 일시 꼴)
    koreanOf: koreanOfMoment,
    dateOf: (moment: Moment) => dateFromKorean(koreanOfMoment(moment)),
    text,
  }
}
export type Calendar = ReturnType<typeof createCalendar>
