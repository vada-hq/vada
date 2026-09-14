import { DashboardSection } from '../../components/DashboardSection'
import { FigmaAsset } from '../../components/FigmaAsset'
import { ProgressBar } from '../../components/ProgressBar'
import { StatTile } from '../../components/StatTile'
import { homeField, readHomeSource } from '../../data-sources/home'
import { NEUTRAL_VALUE, VALUE_TEXT } from '../../design/tones'
import type { ItemListSpec, SummarySpec } from '../../spec/types'
import { ASSET, COUNT_TILE_TONE, NODE, SCREEN, specOf } from './spec'

export function EventCountTiles() {
  const summary = specOf<SummarySpec>(NODE.eventCounts)
  const counts = readHomeSource(summary.dataSourceKey, 'home.eventCounts')

  return (
    <div data-node-id={NODE.eventCounts} className="grid grid-cols-3 gap-4">
      {summary.items!.map((item, at) => (
        <StatTile
          key={item.label}
          label={item.label!}
          value={`${homeField(counts, item.field)}개`}
          valueClass={VALUE_TEXT[COUNT_TILE_TONE[at]] ?? NEUTRAL_VALUE}
          icon={
            <FigmaAsset
              screenId={SCREEN}
              nodeId={ASSET.countTiles[at]}
              className="size-9 shrink-0"
            />
          }
        />
      ))}
    </div>
  )
}

export function EventList() {
  const spec = specOf<ItemListSpec>(NODE.events)
  const events = readHomeSource(spec.dataSourceKey, 'home.events')

  return (
    <DashboardSection nodeId={NODE.events} title={spec.title}>
      <ul>
        {events.map((event) => (
          <li key={String(event.title)} className="border-b border-gray-100 px-5 py-4 last:border-b-0">
            <div className="flex items-center gap-2">
              <span className="rounded border border-blue-200 bg-blue-50 px-1.5 py-0.5 text-xs font-medium text-blue-700">
                {String(event.status)}
              </span>
              <span className="min-w-0 flex-1 text-sm font-bold text-gray-900">
                {String(event.title)}
              </span>
              <FigmaAsset screenId={SCREEN} nodeId={ASSET.eventLink} className="size-3.5 shrink-0" />
            </div>
            <p className="flex items-center gap-1.5 pt-2 text-xs font-medium text-gray-400">
              <FigmaAsset screenId={SCREEN} nodeId={ASSET.eventDate} className="size-3" />
              <span>{String(event.date)}</span>
              <FigmaAsset screenId={SCREEN} nodeId={ASSET.eventPlace} className="ml-1.5 size-3" />
              <span>{String(event.place)}</span>
              <span className="ml-1.5">{String(event.team)}</span>
            </p>
            <div className="pt-2">
              <ProgressBar
                percent={Number(event.progressPercent)}
                ariaLabel={
                  event.delayedTaskCount === undefined
                    ? `준비 ${event.progressPercent}%`
                    : `준비 ${event.progressPercent}% · 지연 업무 ${event.delayedTaskCount}건`
                }
                label={
                  <>
                    <span className="text-gray-500">{`준비 ${event.progressPercent}%`}</span>
                    {event.delayedTaskCount === undefined ? null : (
                      <span className="text-red-500">{` · 지연 업무 ${event.delayedTaskCount}건`}</span>
                    )}
                  </>
                }
              />
            </div>
          </li>
        ))}
      </ul>
    </DashboardSection>
  )
}
