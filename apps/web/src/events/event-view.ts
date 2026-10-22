import type { EventStatus, EventSummary } from '@vada/contracts'
import { monthDay } from '@/lib/korean-date-text'

export const EVENT_STATUS_LABEL: Record<EventStatus, string> = {
  tbd: '날짜 미정',
  upcoming: '예정',
  ongoing: '진행 중',
  ended: '끝남',
}
export const EVENT_STATUS_TONE: Record<EventStatus, 'warning' | 'info' | 'success' | 'neutral'> = {
  tbd: 'warning',
  upcoming: 'info',
  ongoing: 'success',
  ended: 'neutral',
}

export const NO_OWNER_LABEL = '책임자 없음'
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

// 한국 시각 'YYYY-MM-DDTHH:mm' → '10월 25일 (토) 14:00'. 요일은 날짜만으로 센다(시간대에 기대지 않는다).
function dayTime(value: string) {
  const [date = '', time = ''] = value.split('T')
  const [year = 0, month = 1, day = 1] = date.split('-').map(Number)
  const weekday = WEEKDAYS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()]
  return { date, time, text: `${monthDay(date)} (${weekday}) ${time}` }
}

export const momentLabel = (value: string) => dayTime(value).text

// '10월 25일 (토) 14:00 ~ 18:00'. 끝이 다른 날이면 끝에도 날짜를 쓴다. 시작이 없으면 '날짜 미정'이다.
export function whenLabel(event: Pick<EventSummary, 'startsAt' | 'endsAt'>) {
  if (event.startsAt === null) return EVENT_STATUS_LABEL.tbd
  const start = dayTime(event.startsAt)
  if (event.endsAt === null) return start.text
  const end = dayTime(event.endsAt)
  return `${start.text} ~ ${end.date === start.date ? end.time : end.text}`
}

export function ownerLabel(owner: EventSummary['owner']) {
  if (!owner) return NO_OWNER_LABEL
  return owner.current ? owner.name : `떠난 사람: ${owner.name}`
}
