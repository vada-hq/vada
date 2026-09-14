import { AppShell } from '../components/AppShell'
import { Breadcrumbs } from '../components/Breadcrumbs'
import { FigmaAsset } from '../components/FigmaAsset'
import { NEUTRAL_CHIP, STATE_CHIP } from '../design/tones'
import { drawnTitleOf, opsMeet05a } from '../spec/screens'
import { CurrentAgenda } from './meeting-live/CurrentAgenda'
import { DiscussionAndOutcomes } from './meeting-live/DiscussionAndOutcomes'
import { MeetingLiveSidebar } from './meeting-live/MeetingLiveSidebar'
import { MeetingLiveStatus } from './meeting-live/MeetingLiveStatus'
import {
  HostActionButton,
  MeetingLiveNotices,
  useMeetingLiveActions,
} from './meeting-live/actions'
import { readMeetingLiveView } from './meeting-live/data'
import {
  ASSET,
  BREADCRUMB_SEPARATORS,
  HOST,
  NODE,
  SCREEN,
  scalar,
} from './meeting-live/spec'

interface OPSMEET05AScreenProps {
  screenParams: Record<string, string>
  /** 같은 주소의 진행자 변형은 화면 ID로 구분한다. */
  screenId?: string
  onNavigate: (screenId: string, params?: Record<string, string>) => void
}

/** 진행 중 회의의 데이터, 권한별 동작, 화면 섹션을 조립한다. */
export function OPSMEET05AScreen({
  screenParams,
  screenId = SCREEN,
  onNavigate,
}: OPSMEET05AScreenProps) {
  const host = screenId === HOST.screen
  const actions = useMeetingLiveActions({ host, screenParams, onNavigate })
  const view = readMeetingLiveView(screenParams)

  if (view.status === 'unavailable') {
    return (
      <AppShell
        screenId={opsMeet05a.screenId}
        activeNavigationScreenId={opsMeet05a.activeNavigationScreenId}
        eyebrow={view.meta.eyebrow}
        title={view.meta.title}
        description={view.meta.description}
        footerNote={view.meta.footerNote}
        onNavigate={onNavigate}
      >
        <p role="alert" className="text-sm text-red-700">
          {view.message}
        </p>
      </AppShell>
    )
  }

  const breadcrumb = opsMeet05a.breadcrumb

  return (
    <AppShell
      screenId={opsMeet05a.screenId}
      activeNavigationScreenId={opsMeet05a.activeNavigationScreenId}
      eyebrow={view.meta.eyebrow}
      title={drawnTitleOf(opsMeet05a, screenParams)}
      description={view.meta.description}
      footerNote={view.meta.footerNote}
      breadcrumb={
        breadcrumb === undefined ? undefined : (
          <Breadcrumbs
            nodeId={breadcrumb.source}
            screenId={SCREEN}
            separatorNodeIds={BREADCRUMB_SEPARATORS}
            items={breadcrumb.items.map((item) =>
              item.field === undefined ? (item.value ?? '') : scalar(view.detail, item.field),
            )}
          />
        )
      }
      headerAction={
        host ? (
          <HostActionButton
            slot={HOST.endMeeting}
            actions={actions}
            className="flex items-center gap-1.5 rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700"
          />
        ) : (
          <span
            data-node-id={NODE.viewerChip}
            data-design-state
            data-design-rule="state-chip"
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs ${
              STATE_CHIP[scalar(view.detail, view.specs.viewerChip.toneField)] ?? NEUTRAL_CHIP
            }`}
          >
            <FigmaAsset screenId={SCREEN} nodeId={ASSET.viewerChip} className="size-3.5" />
            {scalar(view.detail, view.specs.viewerChip.titleField)}
          </span>
        )
      }
      onNavigate={onNavigate}
    >
      <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-4 pb-8">
        <MeetingLiveNotices actions={actions} />
        <MeetingLiveStatus view={view} />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.7fr_1fr]">
          <div className="flex flex-col gap-4">
            <CurrentAgenda view={view} actions={actions} />
            <DiscussionAndOutcomes view={view} actions={actions} />
          </div>
          <MeetingLiveSidebar view={view} actions={actions} />
        </div>
      </div>
    </AppShell>
  )
}
