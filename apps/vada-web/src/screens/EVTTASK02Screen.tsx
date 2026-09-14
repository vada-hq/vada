import { AppShell } from '../components/AppShell'
import { EventTaskDetailCard } from './event-task-detail/EventTaskDetailCard'
import { EventTaskDocuments } from './event-task-detail/EventTaskDocuments'
import { EventTaskHeaderActions } from './event-task-detail/EventTaskHeaderActions'
import {
  useEventTaskDetail,
  type EventTaskDetailProps,
} from './event-task-detail/useEventTaskDetail'

// 업무 상세(EVT-TASK-02). 업무 정보와 문서 작업 영역을 조립한다.
export function EVTTASK02Screen(props: EventTaskDetailProps) {
  const model = useEventTaskDetail(props)
  if (!model.ready) {
    return (
      <AppShell
        screenId={model.screen.screenId}
        activeNavigationScreenId={model.screen.activeNavigationScreenId}
        eyebrow={model.screen.meta?.eyebrow}
        title={model.screen.meta?.title ?? model.screen.screenId}
        onNavigate={props.onNavigate}
      >
        <p role="alert" className={model.messageClassName}>
          {model.message}
        </p>
      </AppShell>
    )
  }

  return (
    <AppShell
      screenId={model.screen.screenId}
      activeNavigationScreenId={model.screen.activeNavigationScreenId}
      eyebrow={model.screen.meta?.eyebrow}
      title={model.screen.meta?.title ?? model.screen.screenId}
      onNavigate={model.onNavigate}
      headerAction={<EventTaskHeaderActions model={model} />}
    >
      {model.note === null ? null : (
        <p role="status" className="pb-3 text-xs font-medium text-gray-500">
          {model.note}
        </p>
      )}
      <EventTaskDetailCard model={model} />
      <EventTaskDocuments model={model} />
    </AppShell>
  )
}
