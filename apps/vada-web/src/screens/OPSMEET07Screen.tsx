import { AppShell } from '../components/AppShell'
import { Breadcrumbs } from '../components/Breadcrumbs'
import { opsMeet07 } from '../spec/screen-specs/opsMeet07'
import { MeetingSummaryContent } from './meeting-summary/MeetingSummaryContent'
import { MeetingSummaryOverview } from './meeting-summary/MeetingSummaryOverview'
import { MeetingSummarySidebar } from './meeting-summary/MeetingSummarySidebar'
import {
  MeetingSummaryHeaderAction,
  MeetingSummaryNotices,
} from './meeting-summary/actions'
import { readMeetingSummaryView } from './meeting-summary/data'
import { BREADCRUMB_SEPARATORS, SCREEN, scalar } from './meeting-summary/spec'
import { useMeetingSummaryActions } from './meeting-summary/useMeetingSummaryActions'

interface OPSMEET07ScreenProps {
  screenParams: Record<string, string>
  /** 같은 주소의 불참자 변형은 화면 ID로 구분한다. */
  screenId?: string
  onNavigate: (screenId: string, params?: Record<string, string>) => void
}

/** 완료 회의록의 사용자 변형, 동작, 요약 섹션을 조립한다. */
export function OPSMEET07Screen({
  screenParams,
  screenId = SCREEN,
  onNavigate,
}: OPSMEET07ScreenProps) {
  const actions = useMeetingSummaryActions({ screenParams, onNavigate })
  const view = readMeetingSummaryView(screenParams, screenId)

  if (view.status === 'unavailable') {
    return (
      <AppShell
        screenId={opsMeet07.screenId}
        activeNavigationScreenId={opsMeet07.activeNavigationScreenId}
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

  const breadcrumb = opsMeet07.breadcrumb

  return (
    <AppShell
      screenId={opsMeet07.screenId}
      activeNavigationScreenId={opsMeet07.activeNavigationScreenId}
      eyebrow={view.meta.eyebrow}
      title={view.meta.title}
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
      headerAction={<MeetingSummaryHeaderAction view={view} actions={actions} />}
      onNavigate={onNavigate}
    >
      <div className="mx-auto flex w-full max-w-[1010px] flex-col gap-4 pb-8">
        <MeetingSummaryNotices actions={actions} />
        <MeetingSummaryOverview view={view} />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.8fr_1fr]">
          <MeetingSummaryContent view={view} />
          <MeetingSummarySidebar view={view} actions={actions} />
        </div>
      </div>
    </AppShell>
  )
}
