import type { ScopeDraft } from '../state/scopes'
import { EventSetupForm } from './event-setup/EventSetupForm'
import { SetupCard } from './event-setup/SetupCard'
import { useEventSetupDraft } from './event-setup/useEventSetupDraft'

interface EVT01ScreenProps {
  screenParams: Record<string, string>
  draft: ScopeDraft
  onChangeDraft: (next: ScopeDraft) => void
  onScopeEvent: (scopeKey: string, event: 'complete' | 'cancel') => void
  onNavigate: (screenId: string, params?: Record<string, string>) => void
}

/** 행사 운영 조직 설정 모델과 설정 카드를 조립한다. */
export function EVT01Screen(props: EVT01ScreenProps) {
  const model = useEventSetupDraft(props)
  if (!model.ready) {
    return (
      <SetupCard>
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {model.missing.map((param) => param.missingNote).join(' ')}
        </p>
      </SetupCard>
    )
  }
  return <EventSetupForm model={model} />
}
