import { AppShell } from '../components/AppShell'
import { myInfo01 } from '../spec/screen-specs/myInfo01'
import type { ScopeDraft } from '../state/scopes'
import { MyInfoForm } from './my-info/MyInfoForm'
import { useMyInfoForm } from './my-info/useMyInfoForm'

interface MYINFO01ScreenProps {
  draft: ScopeDraft
  onChangeDraft: (next: ScopeDraft) => void
  onNavigate: (screenId: string, params?: Record<string, string>) => void
  onScopeEvent: (scopeKey: string, event: 'complete' | 'cancel') => void
}

export function MYINFO01Screen({
  draft,
  onChangeDraft,
  onNavigate,
  onScopeEvent,
}: MYINFO01ScreenProps) {
  const model = useMyInfoForm({
    scopeDraft: draft,
    onChangeDraft,
    onNavigate,
    onScopeEvent,
  })

  return (
    <AppShell
      screenId={myInfo01.screenId}
      eyebrow={myInfo01.meta?.eyebrow}
      title={myInfo01.meta?.title ?? myInfo01.screenId}
      description={myInfo01.meta?.description}
      onNavigate={onNavigate}
    >
      <MyInfoForm model={model} />
    </AppShell>
  )
}
