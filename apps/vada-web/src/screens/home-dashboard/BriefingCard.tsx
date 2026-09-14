import { FigmaAsset } from '../../components/FigmaAsset'
import { homeField, readHomeSource } from '../../data-sources/home'
import type { ButtonSpec, ItemListSpec, SummarySpec } from '../../spec/types'
import { HomeAction } from './HomeAction'
import { ASSET, NODE, SCREEN, specOf } from './spec'

export function BriefingCard({ onNavigate }: { onNavigate: (screenId: string) => void }) {
  const summary = specOf<SummarySpec>(NODE.briefing)
  const notices = specOf<ItemListSpec>(NODE.briefingNotices)
  const button = specOf<ButtonSpec>(NODE.delayedTasksButton)
  const briefing = readHomeSource(summary.dataSourceKey, 'home.briefing')
  const lines = readHomeSource(notices.dataSourceKey, 'home.briefingNotices')

  return (
    <div className="flex items-center gap-6 rounded-2xl border border-red-100 bg-red-50/50 p-6">
      <div className="size-20 shrink-0 overflow-hidden rounded-full bg-white shadow">
        <FigmaAsset
          screenId={SCREEN}
          nodeId={ASSET.mascot}
          className="size-full"
          alt="끼룩이"
        />
      </div>
      <div
        data-node-id={NODE.briefing}
        className="min-w-0 flex-1 rounded-2xl border border-gray-200 bg-white px-6 py-4"
      >
        {summary.eyebrow && <p className="text-xs font-bold text-red-500">{summary.eyebrow}</p>}
        <h2 className="pt-1 text-base font-bold text-blue-950">
          {String(homeField(briefing, summary.titleField))}
        </h2>
        <ul data-node-id={NODE.briefingNotices} className="flex flex-col gap-1 pt-3">
          {lines.map((line) => (
            <li key={String(line.message)} className="text-sm text-gray-600">
              {String(line.message)}
            </li>
          ))}
        </ul>
      </div>
      <HomeAction spec={button} onNavigate={onNavigate} variant="outlined" />
    </div>
  )
}
