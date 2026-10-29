import type { CouncilView, TaskView, TaskFilter, TaskLayout } from '@vada/contracts'
import type { TaskNarrow } from './task-api'
import { useEvents, type EventList } from '@/events/useEvents'
import { useTaskOptions } from './useTaskOptions'
import { useTasks } from './useTasks'

// 행사의 업무 탭 달력에는 그 행사만 그린다. 학생회의 다른 행사는 업무 메뉴의 달력에 있다.
function onlyEvent(events: EventList, eventId: string | undefined): EventList {
  const { state } = events
  if (eventId === undefined || state.kind !== 'ready') return events
  const only = state.data.events.filter(event => event.id === eventId)
  return { ...events, state: { ...state, data: { ...state.data, events: only } } }
}

// 달력과 보드(좁은 화면은 상태 탭)는 끝난 업무도 읽는다. 표의 행사 칸은 선택지까지 읽어야 바로 바꿀 수 있다.
export function useTaskLists(
  props: { view: CouncilView; eventId?: string | undefined; onForbidden: () => void },
  {
    view,
    filter,
    layout,
    wide,
    listEvent,
    narrow,
  }: {
    view: TaskView
    filter: TaskFilter
    layout: TaskLayout
    wide: boolean
    listEvent: string | undefined
    narrow: TaskNarrow
  },
) {
  const councilId = props.view.council.id
  const calendar = layout === 'calendar'
  const both = calendar || layout === 'board' || !wide
  const table = wide && !props.eventId && layout === 'list'
  const eventId = listEvent
  const list = useTasks(
    councilId,
    { view, filter: both ? 'open' : filter, eventId, narrow },
    props.onForbidden,
  )
  const done = useTasks(
    councilId,
    { view, filter: 'done', eventId, narrow },
    props.onForbidden,
    both,
  )
  // 표의 행사 칸이 고를 행사와 그 가운데 이을 수 있는 것도 읽는다(행사의 업무 탭은 행사 열이 없다).
  const events = useEvents(councilId, props.onForbidden, calendar || table)
  const options = useTaskOptions(councilId, undefined, props.onForbidden, table)
  const linkable = options.state.kind === 'ready' ? options.state.options.linkableEvents : null
  return { list, done, events: onlyEvent(events, props.eventId), linkable, both }
}
