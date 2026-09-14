import { AppShell } from '../components/AppShell'
import { Breadcrumbs } from '../components/Breadcrumbs'
import { MeetingAgendaPanel } from './meeting-detail/MeetingAgendaPanel'
import { MeetingDetailHeaderAction } from './meeting-detail/MeetingDetailHeaderAction'
import { MeetingOverview } from './meeting-detail/MeetingOverview'
import { MeetingPeoplePanel } from './meeting-detail/MeetingPeoplePanel'
import {
  meetingDetailModel,
  type MeetingDetailScreenProps,
} from './meeting-detail/model'
import { BREADCRUMB_SEPARATORS, SCREEN } from './meeting-detail/spec'

// 예정 회의 상세(OPS-MEET-03A/B/C). 공통 상세와 사용자별 동작을 조립한다.
export function OPSMEET03AScreen(props: MeetingDetailScreenProps) {
  const model = meetingDetailModel(props)
  if (!model.ready) {
    return (
      <AppShell
        screenId={model.screen.screenId}
        activeNavigationScreenId={model.screen.activeNavigationScreenId}
        eyebrow={model.meta.eyebrow}
        title={model.meta.title}
        description={model.meta.description}
        footerNote={model.meta.footerNote}
        onNavigate={model.onNavigate}
      >
        <p role="alert" className="text-sm text-red-700">
          {model.message}
        </p>
      </AppShell>
    )
  }

  return (
    <AppShell
      screenId={model.screen.screenId}
      activeNavigationScreenId={model.screen.activeNavigationScreenId}
      eyebrow={model.meta.eyebrow}
      title={model.title}
      description={model.meta.description}
      footerNote={model.meta.footerNote}
      breadcrumb={
        model.screen.breadcrumb === undefined ? undefined : (
          <Breadcrumbs
            nodeId={model.screen.breadcrumb.source}
            screenId={SCREEN}
            separatorNodeIds={BREADCRUMB_SEPARATORS}
            items={model.breadcrumbItems}
          />
        )
      }
      headerAction={<MeetingDetailHeaderAction model={model} />}
      onNavigate={model.onNavigate}
    >
      <div className="mx-auto flex w-full max-w-[1000px] flex-col gap-4 pb-8">
        <MeetingOverview model={model} />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.55fr_1fr]">
          <MeetingAgendaPanel model={model} />
          <MeetingPeoplePanel model={model} />
        </div>
      </div>
    </AppShell>
  )
}
