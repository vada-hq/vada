import type { CouncilView, TaskView, TaskFilter, TaskLayout } from '@vada/contracts'
import { useEvents } from '@/events/useEvents'
import { useTaskOptions } from './useTaskOptions'
import { useTasks } from './useTasks'

// 달력과 넓은 보드는 끝난 업무도 읽는다. 표의 행사 칸은 선택지까지 읽어야 바로 바꿀 수 있다.
export function useTaskLists(
  props: { view: CouncilView; eventId?: string | undefined; onForbidden: () => void },
  {
    view,
    filter,
    layout,
    wide,
    listEvent,
  }: {
    view: TaskView
    filter: TaskFilter
    layout: TaskLayout
    wide: boolean
    listEvent: string | undefined
  },
) {
  const councilId = props.view.council.id
  const calendar = layout === 'calendar'
  const both = calendar || (layout === 'board' && wide)
  const table = wide && !props.eventId && layout === 'list'
  const eventId = listEvent
  const list = useTasks(
    councilId,
    { view, filter: both ? 'open' : filter, eventId },
    props.onForbidden,
  )
  const done = useTasks(councilId, { view, filter: 'done', eventId }, props.onForbidden, both)
  // 표의 행사 칸이 고를 행사와 그 가운데 이을 수 있는 것도 읽는다(행사의 업무 탭은 행사 열이 없다).
  const events = useEvents(councilId, props.onForbidden, calendar || table)
  const options = useTaskOptions(councilId, undefined, props.onForbidden, table)
  const linkable = options.state.kind === 'ready' ? options.state.options.linkableEvents : null
  return { list, done, events, linkable, both }
}
