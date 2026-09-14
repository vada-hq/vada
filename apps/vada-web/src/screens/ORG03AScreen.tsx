import { AppShell } from '../components/AppShell'
import { Breadcrumbs } from '../components/Breadcrumbs'
import { DepartmentCards } from './organization-chart/DepartmentCards'
import { ExecutivePanel } from './organization-chart/ExecutivePanel'
import { ASSET, SCREEN } from './organization-chart/spec'
import {
  useOrganizationChart,
  type OrganizationChartProps,
} from './organization-chart/useOrganizationChart'

// 조직 관리 보기(ORG-03A). 회장단과 부서 조직도를 조립한다.
export function ORG03AScreen(props: OrganizationChartProps) {
  const model = useOrganizationChart(props)

  return (
    <AppShell
      screenId={model.screen.screenId}
      activeNavigationScreenId={model.screen.activeNavigationScreenId}
      eyebrow={model.screen.meta?.eyebrow}
      title={model.title}
      onNavigate={model.onNavigate}
      breadcrumb={
        model.breadcrumb === undefined ? undefined : (
          <Breadcrumbs
            nodeId={model.breadcrumb.source}
            screenId={SCREEN}
            separatorNodeIds={[ASSET.breadcrumbSeparator]}
            items={model.breadcrumb.items.map((item) => item.value ?? '')}
          />
        )
      }
    >
      <div className="flex flex-col items-center">
        <ExecutivePanel model={model} />
        {/* 회장단에서 부서로 내려가는 줄기(30:4557). */}
        <span aria-hidden className="h-6 w-px bg-gray-300" />
        <DepartmentCards model={model} />
        {model.note === null ? null : (
          <p role="status" className="pt-6 text-xs text-gray-500">
            {model.note}
          </p>
        )}
      </div>
    </AppShell>
  )
}
