import { AppShell } from '../components/AppShell'
import { Breadcrumbs } from '../components/Breadcrumbs'
import { FigmaAsset } from '../components/FigmaAsset'
import { InvitePanel } from './organization-invite/InvitePanel'
import { OrganizationInvitePreview } from './organization-invite/OrganizationInvitePreview'
import { ASSET, NODE, SCREEN } from './organization-invite/spec'
import {
  useOrganizationInvite,
  type OrganizationInviteProps,
} from './organization-invite/useOrganizationInvite'

// 구성원 초대(ORG-03C). 조직도 미리보기와 초대 수단 패널을 조립한다.
export function ORG03CScreen(props: OrganizationInviteProps) {
  const model = useOrganizationInvite(props)
  return (
    <AppShell
      screenId={model.screen.screenId}
      activeNavigationScreenId={model.screen.activeNavigationScreenId}
      eyebrow={model.screen.meta?.eyebrow}
      title={model.title}
      onNavigate={model.onNavigate}
      breadcrumb={
        model.screen.breadcrumb === undefined ? undefined : (
          <Breadcrumbs
            nodeId={model.screen.breadcrumb.source}
            screenId={SCREEN}
            separatorNodeIds={[ASSET.breadcrumbSeparator]}
            items={model.screen.breadcrumb.items.map((item) => item.value ?? '')}
          />
        )
      }
      headerAction={
        <button
          type="button"
          data-node-id={NODE.back}
          onClick={() => model.press(model.back)}
          className="flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-blue-600/50 focus-visible:outline-none"
        >
          <FigmaAsset screenId={SCREEN} nodeId={ASSET.back} className="size-4" />
          {model.back.label}
        </button>
      }
    >
      <div className="flex gap-6">
        <OrganizationInvitePreview model={model} />
        <InvitePanel model={model} />
      </div>
    </AppShell>
  )
}
