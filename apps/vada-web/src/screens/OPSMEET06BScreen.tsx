import { AppShell } from '../components/AppShell'
import { Breadcrumbs } from '../components/Breadcrumbs'
import { Built } from '../components/Built'
import { scalarValue } from '../data-sources/values'
import { opsMeet06a } from '../spec/screen-specs/opsMeet06a'
import { opsMeet06b } from '../spec/screen-specs/opsMeet06b'
import type { ScopeDraft } from '../state/scopes'
import { CompleteMinutesAction } from './meeting-minutes/MinutesCompletion'
import { MeetingMinutesWorkspace } from './meeting-minutes/MeetingMinutesWorkspace'
import {
  BASE,
  BREADCRUMB_SEPARATORS,
  SCREEN,
} from './meeting-minutes/spec'
import { useMeetingMinutesWorkspace } from './meeting-minutes/useMeetingMinutesWorkspace'

interface OPSMEET06BScreenProps {
  screenParams: Record<string, string>
  draft: ScopeDraft
  onChangeDraft: (next: ScopeDraft) => void
  onNavigate: (screenId: string, params?: Record<string, string>) => void
}

export function OPSMEET06BScreen({
  screenParams,
  draft,
  onChangeDraft,
  onNavigate,
}: OPSMEET06BScreenProps) {
  const model = useMeetingMinutesWorkspace(screenParams, draft, onChangeDraft)
  const meta = opsMeet06b.meta
  if (meta === undefined) {
    throw new Error('OPS-MEET-06B의 화면 카피가 없습니다.')
  }

  if (!model.ready) {
    return (
      <AppShell
        screenId={opsMeet06b.screenId}
        activeNavigationScreenId={opsMeet06a.activeNavigationScreenId}
        eyebrow={meta.eyebrow}
        title={meta.title}
        onNavigate={onNavigate}
      >
        <p role="alert" className="text-sm text-gray-500">{model.message}</p>
      </AppShell>
    )
  }

  const breadcrumb = opsMeet06b.breadcrumb
  return (
    <AppShell
      screenId={opsMeet06b.screenId}
      activeNavigationScreenId={opsMeet06a.activeNavigationScreenId}
      eyebrow={meta.eyebrow}
      title={meta.title}
      breadcrumb={
        breadcrumb === undefined ? undefined : (
          <Breadcrumbs
            nodeId={breadcrumb.source}
            screenId={SCREEN}
            separatorNodeIds={BREADCRUMB_SEPARATORS}
            items={breadcrumb.items.map((item) =>
              item.field === undefined
                ? (item.value ?? '')
                : scalarValue(model.detail, item.field),
            )}
          />
        )
      }
      headerAction={
        <Built what="정리 완료">
          <CompleteMinutesAction
            screenParams={screenParams}
            submitAction={model.submitAction}
            onNavigate={onNavigate}
          />
        </Built>
      }
      onNavigate={onNavigate}
    >
      <MeetingMinutesWorkspace
        model={model}
        screenParams={screenParams}
        draft={draft}
        onNavigate={onNavigate}
      />
    </AppShell>
  )
}

export { BASE }
