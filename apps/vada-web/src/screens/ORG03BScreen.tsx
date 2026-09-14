import { AppShell } from '../components/AppShell'
import { Breadcrumbs } from '../components/Breadcrumbs'
import { FigmaAsset } from '../components/FigmaAsset'
import { drawnTitleOf, org03b } from '../spec/screens'
import type { SubmitAction } from '../spec/types'
import type { ScopeDraft } from '../state/scopes'
import { OrganizationTree } from './organization-editor/OrganizationTree'
import { UnassignedMembers } from './organization-editor/UnassignedMembers'
import { ASSET, NODE, SCREEN } from './organization-editor/spec'
import { useOrganizationDraft } from './organization-editor/useOrganizationDraft'

interface ORG03BScreenProps {
  draft: ScopeDraft
  onChangeDraft: (next: ScopeDraft) => void
  onScopeEvent: (scopeKey: string, event: 'complete' | 'cancel') => void
  onNavigate: (screenId: string, params?: Record<string, string>) => void
}

/** 조직 초안 모델과 조직도·미배정 구성원 영역을 조립한다. */
export function ORG03BScreen({
  draft, onChangeDraft, onScopeEvent, onNavigate,
}: ORG03BScreenProps) {
  const model = useOrganizationDraft({
    scopeDraft: draft, onChangeDraft, onScopeEvent, onNavigate,
  })
  const breadcrumb = org03b.breadcrumb
  const { invite, done } = model.specs

  return (
    <AppShell
      screenId={org03b.screenId}
      activeNavigationScreenId={org03b.activeNavigationScreenId}
      eyebrow={org03b.meta?.eyebrow}
      title={drawnTitleOf(org03b)}
      onNavigate={onNavigate}
      breadcrumb={
        breadcrumb === undefined ? undefined : (
          <Breadcrumbs
            nodeId={breadcrumb.source}
            screenId={SCREEN}
            separatorNodeIds={[ASSET.breadcrumbSeparator]}
            items={breadcrumb.items.map((item) => item.value ?? '')}
          />
        )
      }
      headerAction={
        <span className="flex items-center gap-2">
          <button
            type="button"
            data-node-id={NODE.invite}
            onClick={model.pressAction(invite)}
            className="flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-blue-600/50 focus-visible:outline-none"
          >
            <FigmaAsset screenId={SCREEN} nodeId={ASSET.inviteIcon} className="size-4" />
            {invite.label}
          </button>
          <button
            type="button"
            data-node-id={NODE.done}
            onClick={model.pressDone}
            className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-medium text-white hover:bg-blue-700 focus-visible:ring-2 focus-visible:ring-blue-600/50 focus-visible:outline-none"
          >
            {model.submitAction.labelOf(done.action as SubmitAction, done.label)}
          </button>
        </span>
      }
    >
      <div className="flex gap-6">
        <OrganizationTree model={model} />
        <UnassignedMembers model={model} />
      </div>
    </AppShell>
  )
}
