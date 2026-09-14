import { DashboardSection } from '../../components/DashboardSection'
import { readHomeSource } from '../../data-sources/home'
import type { ButtonSpec, ItemListSpec } from '../../spec/types'
import { HomeAction } from './HomeAction'
import { ASSET, NODE, specOf } from './spec'

export function ScheduleList({ onNavigate }: { onNavigate: (screenId: string) => void }) {
  const spec = specOf<ItemListSpec>(NODE.schedules)
  const button = specOf<ButtonSpec>(NODE.calendarButton)
  const schedules = readHomeSource(spec.dataSourceKey, 'home.schedules')

  return (
    <DashboardSection
      nodeId={NODE.schedules}
      title={spec.title}
      action={<HomeAction spec={button} onNavigate={onNavigate} iconNodeId={ASSET.calendarLink} />}
    >
      <ul>
        {schedules.map((schedule) => (
          <li
            key={`${schedule.date}-${schedule.title}`}
            className="flex items-center gap-4 border-b border-gray-100 px-5 py-3 last:border-b-0"
          >
            <span className="shrink-0 font-mono text-xs font-bold text-gray-500">
              {String(schedule.date)}
            </span>
            <span className="min-w-0 flex-1 text-sm font-medium text-gray-800">
              {String(schedule.title)}
            </span>
            <span className="shrink-0 rounded bg-red-50 px-1.5 py-0.5 text-xs font-medium text-red-600">
              {String(schedule.badge)}
            </span>
          </li>
        ))}
      </ul>
    </DashboardSection>
  )
}
