import { AppShell } from '../components/AppShell'
import { EventWrapUpDetails } from './event-wrap-up/EventWrapUpDetails'
import { EventWrapUpHeader } from './event-wrap-up/EventWrapUpHeader'
import { EventWrapUpStatus } from './event-wrap-up/EventWrapUpStatus'
import { EventWrapUpSummary } from './event-wrap-up/EventWrapUpSummary'
import {
  useEventWrapUp,
  type EventWrapUpProps,
} from './event-wrap-up/useEventWrapUp'

// 행사 후속 정리(EVT-02D). 상태, 요약, 남은 항목을 조립한다.
export function EVT02DScreen(props: EventWrapUpProps) {
  const model = useEventWrapUp(props)
  if (!model.ready) {
    return (
      <AppShell
        screenId={model.screen.screenId}
        activeNavigationScreenId={model.screen.activeNavigationScreenId}
        eyebrow={model.screen.meta?.eyebrow}
        title={model.screen.meta?.title ?? model.screen.screenId}
        onNavigate={props.onNavigate}
      >
        <p
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
        >
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
      title={model.title}
      onNavigate={model.onNavigate}
    >
      <EventWrapUpHeader model={model} />
      <EventWrapUpStatus model={model} />
      <div className="grid grid-cols-1 gap-3 pt-3 lg:grid-cols-[334fr_685fr]">
        <EventWrapUpSummary model={model} />
        <EventWrapUpDetails model={model} />
      </div>
    </AppShell>
  )
}
