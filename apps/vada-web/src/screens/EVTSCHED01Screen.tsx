import { AppShell } from '../components/AppShell'
import { WorkspaceHeader } from '../components/WorkspaceHeader'
import { drawnTitleOf, evtSched01 } from '../spec/screens'
import {
  EVENT_SCHEDULE_ASSET as ASSET,
  EVENT_SCHEDULE_SCREEN as SCREEN,
} from './event-schedule/config'
import { EventScheduleContent } from './event-schedule/EventScheduleContent'
import { useEventSchedule } from './event-schedule/useEventSchedule'

interface EVTSCHED01ScreenProps {
  screenParams: Record<string, string>
  onNavigate: (screenId: string, params?: Record<string, string>) => void
}

export function EVTSCHED01Screen({ screenParams, onNavigate }: EVTSCHED01ScreenProps) {
  const model = useEventSchedule(screenParams, onNavigate)

  if (!model.ready) {
    return (
      <AppShell
        screenId={evtSched01.screenId}
        activeNavigationScreenId={evtSched01.activeNavigationScreenId}
        eyebrow={evtSched01.meta?.eyebrow}
        title={evtSched01.meta?.title ?? evtSched01.screenId}
        onNavigate={onNavigate}
      >
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {model.message}
        </p>
      </AppShell>
    )
  }

  return (
    <AppShell
      screenId={evtSched01.screenId}
      activeNavigationScreenId={evtSched01.activeNavigationScreenId}
      eyebrow={evtSched01.meta?.eyebrow}
      title={drawnTitleOf(evtSched01, screenParams)}
      footerNote={evtSched01.meta?.footerNote}
      onNavigate={onNavigate}
    >
      <WorkspaceHeader
        screen={evtSched01}
        screenParams={screenParams}
        onNavigate={onNavigate}
        onPending={model.setNote}
        assetScreenId={SCREEN}
        statusAssets={ASSET.workspaceStatus}
      />
      <EventScheduleContent model={model} />
    </AppShell>
  )
}
