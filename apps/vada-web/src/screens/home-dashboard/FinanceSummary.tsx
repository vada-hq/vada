import { DashboardSection } from '../../components/DashboardSection'
import { ProgressBar } from '../../components/ProgressBar'
import { StatTile } from '../../components/StatTile'
import { homeField, readHomeSource } from '../../data-sources/home'
import { NEUTRAL_VALUE, VALUE_TEXT } from '../../design/tones'
import type { ButtonSpec, SummarySpec } from '../../spec/types'
import { HomeAction } from './HomeAction'
import { ASSET, FINANCE_TILE_TONE, NODE, specOf } from './spec'

export function FinanceSummary({ onNavigate }: { onNavigate: (screenId: string) => void }) {
  const summary = specOf<SummarySpec>(NODE.finance)
  const button = specOf<ButtonSpec>(NODE.financeButton)
  const finance = readHomeSource(summary.dataSourceKey, 'home.financeSummary')
  const [usage, ...tiles] = summary.items!

  return (
    <DashboardSection
      nodeId={NODE.finance}
      title={summary.title}
      action={<HomeAction spec={button} onNavigate={onNavigate} iconNodeId={ASSET.financeLink} />}
    >
      <div className="px-5 py-4">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-gray-400">{usage.label}</span>
          <span className="text-sm font-bold text-gray-900">
            {String(homeField(finance, usage.field))}
          </span>
        </div>
        <div className="pt-2">
          <ProgressBar percent={Number(finance.budgetUsedPercent)} fill />
        </div>
        <div className="grid grid-cols-2 gap-3 pt-4">
          {tiles.map((tile) => (
            <StatTile
              key={tile.label}
              label={tile.label!}
              value={String(homeField(finance, tile.field))}
              tone="inset"
              valueClass={VALUE_TEXT[FINANCE_TILE_TONE[tile.field!]] ?? NEUTRAL_VALUE}
            />
          ))}
        </div>
      </div>
    </DashboardSection>
  )
}
