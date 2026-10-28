import { EVENT_LIST_LIMIT, TASK_OPEN_LIMIT, type CouncilView } from '@vada/contracts'
import PageColumn from '@/components/PageColumn'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import { useEvents } from '@/events/useEvents'
import { openRecord } from '@/lib/go-to'
import { EVENTS_LOAD_FAILED, TASKS_LOAD_FAILED } from '@/lib/messages'
import { useTasks } from '@/tasks/useTasks'
import { CalendarView } from './CalendarView'

type Props = { view: CouncilView; onForbidden: () => void }

// 원본 목록을 읽기만 한다. 고치기는 업무·행사 상세에서 하고, 캘린더에는 별도 값을 저장하지 않는다.
export default function CalendarPage({ view, onForbidden }: Props) {
  const councilId = view.council.id
  const tasks = useTasks(councilId, { view: 'all', filter: 'open' }, onForbidden)
  const events = useEvents(councilId, onForbidden)
  const failed = tasks.state.kind === 'failed' || events.state.kind === 'failed'
  if (failed)
    return (
      <PageColumn>
        <StateMessage kind="error">
          {tasks.state.kind === 'failed' ? TASKS_LOAD_FAILED : EVENTS_LOAD_FAILED}
        </StateMessage>
        <Button
          variant="outline"
          touch
          className="self-start"
          onClick={() => {
            void tasks.reload()
            void events.reload()
          }}
        >
          다시 시도
        </Button>
      </PageColumn>
    )
  if (tasks.state.kind !== 'ready' || events.state.kind !== 'ready')
    return <StateMessage kind="loading">일정 불러오는 중…</StateMessage>
  return (
    <PageColumn className="break-keep">
      <CalendarView
        tasks={tasks.state.tasks}
        events={events.state.data.events}
        onOpenTask={id => openRecord('tasks', councilId, id)}
        onOpenEvent={id => openRecord('events', councilId, id)}
      />
      {tasks.state.truncated && (
        <StateMessage kind="notice">업무가 많아 {TASK_OPEN_LIMIT}개만 보여요.</StateMessage>
      )}
      {events.state.data.truncated && (
        <StateMessage kind="notice">행사가 많아 {EVENT_LIST_LIMIT}개만 보여요.</StateMessage>
      )}
    </PageColumn>
  )
}
