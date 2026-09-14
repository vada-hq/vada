import { AppShell } from '../components/AppShell'
import { Breadcrumbs } from '../components/Breadcrumbs'
import { CalendarToolbar } from './operations-calendar/CalendarToolbar'
import { MonthCalendar } from './operations-calendar/MonthCalendar'
import { WeekSchedule } from './operations-calendar/WeekSchedule'
import { ASSET, SCREEN } from './operations-calendar/spec'
import {
  useOperationsCalendar,
  type OperationsCalendarProps,
} from './operations-calendar/useOperationsCalendar'

// 운영 캘린더(OPS-CAL-01). 필터, 월 격자, 이번 주 목록을 조립한다.
export function OPSCAL01Screen(props: OperationsCalendarProps) {
  const model = useOperationsCalendar(props)
  return (
    <AppShell
      screenId={model.screen.screenId}
      activeNavigationScreenId={model.screen.activeNavigationScreenId}
      eyebrow={model.screen.meta?.eyebrow}
      title={model.screen.meta?.title ?? model.screen.screenId}
      description={model.screen.meta?.description}
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
    >
      <CalendarToolbar model={model} />
      {model.note === null ? null : (
        <p role="status" className="pt-3 text-xs font-medium text-gray-500">
          {model.note}
        </p>
      )}
      <div className="flex flex-col gap-4 pt-4 lg:flex-row">
        <MonthCalendar model={model} />
        <WeekSchedule model={model} />
      </div>
    </AppShell>
  )
}
