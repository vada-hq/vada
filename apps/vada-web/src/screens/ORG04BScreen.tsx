import { AppShell } from '../components/AppShell'
import { Breadcrumbs } from '../components/Breadcrumbs'
import { FigmaAsset } from '../components/FigmaAsset'
import { RoleMemberList } from './role-permission-editor/RoleMemberList'
import { RoleSelectionPanel } from './role-permission-editor/RoleSelectionPanel'
import { ASSET, NODE, SCREEN } from './role-permission-editor/spec'
import {
  useRolePermissionEditor,
  type RolePermissionEditorProps,
} from './role-permission-editor/useRolePermissionEditor'

// 역할 및 권한 관리(ORG-04B). 안내, 구성원 목록, 역할 선택 패널을 조립한다.
export function ORG04BScreen(props: RolePermissionEditorProps) {
  const model = useRolePermissionEditor(props)
  return (
    <AppShell
      screenId={model.screen.screenId}
      activeNavigationScreenId={model.screen.activeNavigationScreenId}
      eyebrow={model.screen.meta?.eyebrow}
      title={model.screen.meta?.title ?? model.screen.screenId}
      onNavigate={model.onNavigate}
      breadcrumb={
        model.screen.breadcrumb === undefined ? undefined : (
          <Breadcrumbs
            nodeId={model.screen.breadcrumb.source}
            screenId={SCREEN}
            separatorNodeIds={[ASSET.breadcrumbSeparator, ASSET.breadcrumbSeparator2]}
            items={model.screen.breadcrumb.items.map((item) => item.value ?? '')}
          />
        )
      }
      headerAction={
        <span
          data-node-id={NODE.scopeBadge}
          className="rounded-full border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-700"
        >
          {model.scopeBadge.title}
        </span>
      }
    >
      <div
        data-node-id={NODE.banner}
        className="flex items-start gap-3 rounded-xl border border-violet-200 bg-violet-50 px-5 py-4"
      >
        <FigmaAsset screenId={SCREEN} nodeId={ASSET.banner} className="mt-0.5 size-4" />
        <span>
          <span className="block text-xs font-bold text-violet-900">{model.banner.title}</span>
          <span className="block pt-1 text-xs text-violet-700">{model.banner.description}</span>
        </span>
      </div>

      <div className="flex gap-6 pt-5">
        <RoleMemberList model={model} />
        <RoleSelectionPanel model={model} />
      </div>
    </AppShell>
  )
}
