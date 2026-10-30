import type { CouncilView, EventCard, EventStatus, EventSummary, EventTab } from '@vada/contracts'
import { EVENT_STATUS_LABEL } from '@vada/contracts'
import { dayTime, momentLabel } from '@/lib/korean-date-text'

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

export { momentLabel }

// '10월 25일 (토) 14:00 ~ 18:00'. 끝이 다른 날이면 끝에도 날짜를 쓴다. 시작이 없으면 '일시 미정'이다.
// 올해가 아닌 쪽에 연도가 붙는다. 해를 넘기는 기간은 끝에만 붙는다.
export function whenLabel(
  event: Pick<EventSummary, 'startsAt' | 'endsAt'>,
  now: Date = new Date(),
) {
  if (event.startsAt === null) return WHEN_TBD
  const start = momentLabel(event.startsAt, now)
  if (event.endsAt === null) return start
  const end = dayTime(event.endsAt)
  const sameDay = end.date === dayTime(event.startsAt).date
  return `${start} ~ ${sameDay ? end.time : momentLabel(event.endsAt, now)}`
}

export const EVENT_FILTERS = ['전체', '기획 중', '진행 중', '후속 정리 중', '완료'] as const
export type EventFilter = (typeof EVENT_FILTERS)[number]
export type EventOrder = 'date' | 'activity'

// 휴대폰 첫 목록은 옆 메뉴의 다섯 행사를 같은 차례로 먼저 둔다. 없는 행사는 만들지 않고 나머지 순서는 지킨다.
export function prioritizeEvents(events: EventCard[], priority: readonly { id: string }[]) {
  const positions = new Map(priority.map((event, index) => [event.id, index]))
  const rest = priority.length
  return [...events].sort((a, b) => (positions.get(a.id) ?? rest) - (positions.get(b.id) ?? rest))
}

// 일시순은 서버의 카드 정렬을 지킨다. 최근 활동순에서 같은 시각이면 그 차례를 지킨다.
export function visibleEvents(
  events: EventCard[],
  query: string,
  filter: EventFilter,
  order: EventOrder,
) {
  const needle = query.trim().toLocaleLowerCase('ko')
  const found = events.filter(
    event =>
      event.name.toLocaleLowerCase('ko').includes(needle) &&
      (filter === '전체' || EVENT_STATUS_LABEL[event.status] === filter),
  )
  return order === 'activity'
    ? found.sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
    : found
}
