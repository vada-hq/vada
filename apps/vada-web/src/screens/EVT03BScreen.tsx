import { AppShell } from '../components/AppShell'
import { evt03b } from '../spec/screen-specs/evt03b'
import type { ScopeDraft } from '../state/scopes'
import { EventStaffWorkspace } from './event-staff-editor/EventStaffWorkspace'

interface EVT03BScreenProps {
  screenParams: Record<string, string>
  draft: ScopeDraft
  onChangeDraft: (next: ScopeDraft) => void
  onScopeEvent: (scopeKey: string, event: 'complete' | 'cancel') => void
  onNavigate: (screenId: string, params?: Record<string, string>) => void
}

/** 행사 인자를 검증한 뒤 운영 조직 편집 작업공간을 연다. */
export function EVT03BScreen(props: EVT03BScreenProps) {
  const missing = (evt03b.params ?? []).filter(
    (param) => (props.screenParams[param.key] ?? '') === '',
  )

  if (missing.length > 0) {
    return (
      <AppShell
        screenId={evt03b.screenId}
        activeNavigationScreenId={evt03b.activeNavigationScreenId}
        eyebrow={evt03b.meta?.eyebrow}
        title={evt03b.meta?.title ?? evt03b.screenId}
        onNavigate={props.onNavigate}
      >
        <p
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
        >
          {missing.map((param) => param.missingNote).join(' ')}
        </p>
      </AppShell>
    )
  }

  return <EventStaffWorkspace {...props} />
}
