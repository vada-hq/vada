import { PageCard } from '../components/PageCard'
import { org02 } from '../spec/screen-specs/org02'
import type { ScopeDraft } from '../state/scopes'
import { OrganizationSetupForm } from './organization-setup/OrganizationSetupForm'
import { useOrganizationSetup } from './organization-setup/useOrganizationSetup'

interface ORG02ScreenProps {
  draft: ScopeDraft
  onChangeDraft: (next: ScopeDraft) => void
  onNavigate: (screenId: string) => void
  onScopeEvent: (scopeKey: string, event: 'complete' | 'cancel') => void
  joining?: ScopeDraft
}

export function ORG02Screen({
  draft,
  onChangeDraft,
  onNavigate,
  onScopeEvent,
  joining,
}: ORG02ScreenProps) {
  const model = useOrganizationSetup({
    draft,
    joining,
    onChangeDraft,
    onNavigate,
    onScopeEvent,
  })

  return (
    <PageCard screen={org02} maxWidth={982}>
      <OrganizationSetupForm model={model} />
    </PageCard>
  )
}
