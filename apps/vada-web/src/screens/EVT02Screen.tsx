import { AppShell } from '../components/AppShell'
import { EventOverviewActivity } from './event-overview/EventOverviewActivity'
import { EventOverviewBriefing } from './event-overview/EventOverviewBriefing'
import { EventOverviewDetails } from './event-overview/EventOverviewDetails'
import { EventOverviewHeader } from './event-overview/EventOverviewHeader'
import {
  useEventOverview,
  type EventOverviewProps,
} from './event-overview/useEventOverview'

// 행사 개요(EVT-02). 작업 공간 머리와 개요 영역을 조립한다.
export function EVT02Screen(props: EventOverviewProps) {
  const model = useEventOverview(props)
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
      <EventOverviewHeader model={model} />
      <EventOverviewBriefing model={model} />
      <div className="grid grid-cols-1 gap-3 pt-3 lg:grid-cols-[334fr_685fr]">
        <EventOverviewDetails model={model} />
        <EventOverviewActivity model={model} />
      </div>
    </AppShell>
  )
}
