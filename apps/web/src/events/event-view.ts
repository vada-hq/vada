import type { CouncilView, EventStatus, EventSummary, EventTab } from '@vada/contracts'
import { dayTime } from '@/lib/korean-date-text'

// 상태 칩의 색(와이어프레임 LIFECYCLE_STYLE): 기획 중 파랑, 진행 중 초록, 후속 정리 중 노랑, 완료 회색. 이름은 contracts EVENT_STATUS_LABEL이다.
export const EVENT_STATUS_TONE: Record<EventStatus, 'warning' | 'info' | 'success' | 'neutral'> = {
  tbd: 'info',
  upcoming: 'info',
  ongoing: 'success',
  ended: 'warning',
  completed: 'neutral',
}
// 시작을 정하지 않은 행사의 일시 칸(DEC-93: 날짜 미정은 상태 칩이 아니라 일시 칸이 말한다)
const WHEN_TBD = '일시 미정'

export type { EventTab }

// 행사를 만들 수 있는가: 학생회 읽기의 event.create(회장단과 부서장, DEC-93). 화면은 직급을 다시 세지 않는다(DEC-38).
// 행사 화면과 홈 빈 상태의 [새 행사]가 이것 하나로 정한다.
export const canCreateEvent = (view: Pick<CouncilView, 'permissions'>) =>
  view.permissions.includes('event.create')

// 정산 남은 것(행사 '돈' 탭의 항목 수 합). 끝났고 남은 것이 없으면 '완료 가능'이다. 홈과 재정 '행사 정산' 탭이 같이 쓴다.
export const EVENT_SETTLED_LABEL = '완료 가능'
export const remainingLabel = (remaining: number) => `정산 남은 것 ${remaining}`
export const settlementLabel = ({ remaining, settled }: { remaining: number; settled: boolean }) =>
  settled ? EVENT_SETTLED_LABEL : remainingLabel(remaining)

export const momentLabel = (value: string) => dayTime(value).text

// '10월 25일 (토) 14:00 ~ 18:00'. 끝이 다른 날이면 끝에도 날짜를 쓴다. 시작이 없으면 '일시 미정'이다.
export function whenLabel(event: Pick<EventSummary, 'startsAt' | 'endsAt'>) {
  if (event.startsAt === null) return WHEN_TBD
  const start = dayTime(event.startsAt)
  if (event.endsAt === null) return start.text
  const end = dayTime(event.endsAt)
  return `${start.text} ~ ${end.date === start.date ? end.time : end.text}`
}

// 목록 왼쪽 날짜 칸: '11월' / '1'. 시작이 없으면 칸을 비운다(칸이 '날짜 미정'을 말한다).
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
