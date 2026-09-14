import { DashboardSection } from '../../components/DashboardSection'
import { FigmaAsset } from '../../components/FigmaAsset'
import { readHomeSource } from '../../data-sources/home'
import type { ItemListSpec } from '../../spec/types'
import { alertIconOf, NODE, SCREEN, specOf } from './spec'

export function OrgAlertList() {
  const spec = specOf<ItemListSpec>(NODE.orgAlerts)
  const alerts = readHomeSource(spec.dataSourceKey, 'home.orgAlerts')

  return (
    <DashboardSection nodeId={NODE.orgAlerts} title={spec.title}>
      <ul>
        {alerts.map((alert) => (
          <li
            key={String(alert.label)}
            className="flex items-center gap-3 border-b border-gray-100 px-5 py-3 last:border-b-0"
          >
            <FigmaAsset
              screenId={SCREEN}
              nodeId={alertIconOf(String(alert.kind))}
              className="size-6 shrink-0"
            />
            <span className="min-w-0 flex-1 text-sm font-medium text-gray-700">
              {String(alert.label)}
            </span>
            <span className="shrink-0 text-sm font-bold text-gray-900">{String(alert.count)}건</span>
          </li>
        ))}
      </ul>
    </DashboardSection>
  )
}
