import { AppShell } from '../components/AppShell'
import { rec02a } from '../spec/screens'
import type { ScopeDraft } from '../state/scopes'
import { ArchiveEditorWorkspace } from './archive-editor/ArchiveEditorWorkspace'

interface REC02AScreenProps {
  screenParams: Record<string, string>
  draft: ScopeDraft
  onChangeDraft: (next: ScopeDraft) => void
  onNavigate: (screenId: string, params?: Record<string, string>) => void
}

/** 아카이브 인자를 검증한 뒤 작성·검토 작업공간을 연다. */
export function REC02AScreen({
  screenParams,
  draft,
  onChangeDraft,
  onNavigate,
}: REC02AScreenProps) {
  const missing = (rec02a.params ?? []).filter(
    (param) => (screenParams[param.key] ?? '') === '',
  )

  if (missing.length > 0) {
    return (
      <AppShell
        screenId={rec02a.screenId}
        activeNavigationScreenId={rec02a.activeNavigationScreenId}
        eyebrow={rec02a.meta?.eyebrow}
        title={rec02a.meta?.title ?? rec02a.screenId}
        onNavigate={onNavigate}
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

  return (
    <ArchiveEditorWorkspace
      screenParams={screenParams}
      scopeDraft={draft}
      onChangeDraft={onChangeDraft}
      onNavigate={onNavigate}
    />
  )
}
