import type { EventStatus, EventSummary } from '@vada/contracts'
import { monthDay } from '@/lib/korean-date-text'

export const EVENT_STATUS_LABEL: Record<EventStatus, string> = {
  tbd: '날짜 미정',
  upcoming: '예정',
  ongoing: '진행 중',
  ended: '끝남',
  completed: '완료',
}
export const EVENT_STATUS_TONE: Record<EventStatus, 'warning' | 'info' | 'success' | 'neutral'> = {
  tbd: 'warning',
  upcoming: 'info',
  ongoing: 'success',
  ended: 'neutral',
  completed: 'success',
}

export type EventTab = 'overview' | 'tasks' | 'registrations' | 'money'

export const NO_OWNER_LABEL = '책임자 없음'
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

// 한국 시각 'YYYY-MM-DDTHH:mm' → '10월 25일 (토) 14:00'. 요일은 날짜만으로 센다(시간대에 기대지 않는다).
function dayTime(value: string) {
  const [date = '', time = ''] = value.split('T')
  const [year = 0, month = 1, day = 1] = date.split('-').map(Number)
  const weekday = WEEKDAYS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()]
  return { date, time, weekday, text: `${monthDay(date)} (${weekday}) ${time}` }
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

// 목록 왼쪽 날짜 칸: '11월' / '1'. 시작이 없으면 칸을 비운다(상태 배지가 '날짜 미정'을 말한다).
export function dateBlock(startsAt: string | null) {
  if (startsAt === null) return null
  const [, month = '', day = ''] = startsAt.split('T')[0]?.split('-') ?? []
  return { month: `${Number(month)}월`, day: String(Number(day)) }
}

// 목록에서 날짜 칸 옆에 쓰는 시각: '일요일 18:00 ~ 20:00'. 날짜는 날짜 칸이 말하므로 끝이 다른 날일 때만 쓴다.
export function spanLabel(event: Pick<EventSummary, 'startsAt' | 'endsAt'>) {
  if (event.startsAt === null) return null
  const start = dayTime(event.startsAt)
  const head = `${start.weekday}요일 ${start.time}`
  if (event.endsAt === null) return head
  const end = dayTime(event.endsAt)
  return `${head} ~ ${end.date === start.date ? end.time : end.text}`
}

type EventGroup = { key: 'coming' | 'tbd' | 'past'; title: string; events: EventSummary[] }
const GROUP_OF: Record<EventStatus, EventGroup['key']> = {
  ongoing: 'coming',
  upcoming: 'coming',
  tbd: 'tbd',
  ended: 'past',
  completed: 'past',
}
const GROUP_TITLES: [EventGroup['key'], string][] = [
  ['coming', '다가오는 행사'],
  ['tbd', '날짜 미정'],
  ['past', '지난 행사'],
]

// 목록의 묶음. 서버가 준 순서(진행 중 → 예정 → 날짜 미정 → 끝남)를 묶음 안에서도 지킨다. 빈 묶음은 뺀다.
export function eventGroups(events: EventSummary[]): EventGroup[] {
  return GROUP_TITLES.map(([key, title]) => ({
    key,
    title,
    events: events.filter(event => GROUP_OF[event.status] === key),
  })).filter(group => group.events.length > 0)
}
