import { AppShell } from '../components/AppShell'
import { Breadcrumbs } from '../components/Breadcrumbs'
import { FigmaAsset } from '../components/FigmaAsset'
import { MeetingCompletionOverview } from './meeting-completion/MeetingCompletionOverview'
import { MeetingMinutesContent } from './meeting-completion/MeetingMinutesContent'
import { MeetingMinutesSidebar } from './meeting-completion/MeetingMinutesSidebar'
import {
  meetingCompletionModel,
  meetingCompletionValue,
  type MeetingCompletionProps,
} from './meeting-completion/model'
import { ASSET, BREADCRUMB_SEPARATORS, NODE, SCREEN } from './meeting-completion/spec'

// 정리 중 회의(OPS-MEET-06A). 회의 결과와 회의록 정리 현황을 조립한다.
export function OPSMEET06AScreen(props: MeetingCompletionProps) {
  const model = meetingCompletionModel(props)
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
      headerAction={
        <span
          data-node-id={NODE.viewerChip}
          className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700"
        >
          <FigmaAsset screenId={SCREEN} nodeId={ASSET.viewerChip} className="size-3.5" />
          {meetingCompletionValue(model.viewerChip, 0)}
        </span>
      }
      onNavigate={model.onNavigate}
    >
      <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-4 pb-8">
        <MeetingCompletionOverview model={model} />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.7fr_1fr]">
          <MeetingMinutesContent model={model} />
          <MeetingMinutesSidebar model={model} />
        </div>
      </div>
    </AppShell>
  )
}
