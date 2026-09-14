import { AppShell } from '../components/AppShell'
import { Breadcrumbs } from '../components/Breadcrumbs'
import { EventSurveyReplacementPanel } from './event-survey-replacement/EventSurveyReplacementPanel'
import {
  EventSurveyStatusChip,
  EventSurveyWorkspaceHeader,
} from './event-survey-replacement/EventSurveyWorkspaceHeader'
import { BREADCRUMB_SEPARATORS, SCREEN } from './event-survey-replacement/spec'
import {
  useEventSurveyReplacement,
  type EventSurveyReplacementProps,
} from './event-survey-replacement/useEventSurveyReplacement'

// 설문 교체(EVT-05B). 셸과 교체 작업 영역을 조립한다.
export function EVT05BScreen(props: EventSurveyReplacementProps) {
  const model = useEventSurveyReplacement(props)
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
      breadcrumb={
        model.breadcrumbItems === undefined ? undefined : (
          <Breadcrumbs
            nodeId={model.screen.breadcrumb!.source}
            screenId={SCREEN}
            separatorNodeIds={BREADCRUMB_SEPARATORS}
            items={model.breadcrumbItems}
          />
        )
      }
      headerAction={<EventSurveyStatusChip model={model} />}
    >
      <EventSurveyWorkspaceHeader model={model} />
      <EventSurveyReplacementPanel model={model} />
    </AppShell>
  )
}
