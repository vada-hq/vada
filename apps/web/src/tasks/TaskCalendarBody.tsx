import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import type { EventList } from '@/events/useEvents'
import { TASKS_LOAD_FAILED } from '@/lib/messages'
import { TaskCalendar } from './TaskCalendar'
import { taskRowOf } from './TaskListBody'
import type { TaskList } from './useTasks'
import type { EventSummary } from '@vada/contracts'

type Props = Parameters<typeof taskRowOf>[0] & {
  open: TaskList
  done: TaskList
  events: EventList
  eventId?: string | undefined
  calendarEvent?: Pick<EventSummary, 'id' | 'startsAt' | 'endsAt'> | undefined
}

// 상세에서 읽은 행사는 목록 상한·지연과 무관하게 쓴다. 다른 행사의 늦은 상세는 쓰지 않는다.
function initialDateOf({
  events,
  eventId,
  calendarEvent,
}: Pick<Props, 'events' | 'eventId' | 'calendarEvent'>) {
  const event =
    calendarEvent?.id === eventId
      ? calendarEvent
      : events.state.kind === 'ready'
        ? events.state.data.events.find(item => item.id === eventId)
        : undefined
  return event?.startsAt ?? event?.endsAt ?? undefined
}

// 달력 보기의 읽는 중과 실패. 끝나지 않은 업무를 읽어야 그린다. 끝난 업무와 행사는 읽는 대로 더한다.
export function TaskCalendarBody({ open, done, events, eventId, calendarEvent, ...props }: Props) {
  if (open.state.kind === 'loading')
    return <StateMessage kind="loading">업무 불러오는 중…</StateMessage>
  if (open.state.kind === 'failed')
    return (
      <div className="flex flex-col gap-3">
        <StateMessage kind="error">{TASKS_LOAD_FAILED}</StateMessage>
        <Button variant="outline" className="self-start" onClick={() => void open.reload()}>
          다시 시도
        </Button>
      </div>
    )
  const finished = done.state.kind === 'ready' ? done.state.tasks : []
  return (
    <TaskCalendar
      key={eventId ?? 'council'}
      initialDate={initialDateOf({ events, eventId, calendarEvent })}
      tasks={[...open.state.tasks, ...finished]}
      events={events.state.kind === 'ready' ? events.state.data.events : []}
      row={taskRowOf(props, true)}
      onOpenTask={props.onOpenTask}
      onOpenEvent={props.onOpenEvent}
    />
  )
}
