import {
  CALENDAR_ITEM_LIMIT,
  type CalendarKind,
  type CalendarTarget,
  type CouncilView,
} from '@vada/contracts'
import PageColumn from '@/components/PageColumn'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import { navigate } from '@/lib/app-location'
import { openRecord } from '@/lib/go-to'
import { CALENDAR_LOAD_FAILED } from '@/lib/messages'
import { useMenuQuery } from '@/lib/use-menu-query'
import { weeksOf } from '@/tasks/calendar-month'
import { CalendarView } from './CalendarView'
import { useCalendar } from './useCalendar'
import { useCalendarNavigation, useDefaultCalendarView } from './use-calendar-navigation'

type Props = { view: CouncilView; onForbidden: () => void }

function openTarget(councilId: string, target: CalendarTarget) {
  if (target.record === 'events')
    return openRecord('events', councilId, target.id, { tab: target.tab })
  if (target.record === 'tasks' || target.record === 'purchases')
    return openRecord(target.record, councilId, target.id)
  navigate(`/${target.record}/${councilId}/${target.id}`)
}

export default function CalendarPage({ view, onForbidden }: Props) {
  const councilId = view.council.id
  const navigation = useCalendarNavigation()
  const { query, set } = useMenuQuery('calendar', councilId)
  const defaultView = useDefaultCalendarView()
  const layout = query.view === 'month' || query.view === 'list' ? query.view : defaultView
  const kind = (query.kind as CalendarKind | undefined) ?? null
  const days = weeksOf(navigation.month).flat()
  const calendar = useCalendar(councilId, days[0]!, days[days.length - 1]!, onForbidden)
  const { state } = calendar
  return (
    <PageColumn className="break-keep">
      <CalendarView
        {...navigation}
        onSelect={navigation.setSelected}
        onMonth={navigation.go}
        items={state.kind === 'ready' ? state.data.items : []}
        layout={layout}
        kind={kind}
        onLayout={value => set({ view: value })}
        onKind={value => set({ kind: value })}
        onOpen={target => openTarget(councilId, target)}
      >
        {state.kind === 'loading' ? (
          <StateMessage kind="loading">일정 불러오는 중…</StateMessage>
        ) : state.kind === 'failed' ? (
          <div className="flex flex-col gap-3">
            <StateMessage kind="error">{CALENDAR_LOAD_FAILED}</StateMessage>
            <Button
              variant="outline"
              touch
              className="self-start"
              onClick={() => void calendar.reload()}
            >
              다시 시도
            </Button>
          </div>
        ) : undefined}
      </CalendarView>
      {state.kind === 'ready' && state.data.truncated && (
        <StateMessage kind="notice">일정이 많아 {CALENDAR_ITEM_LIMIT}개만 보여요.</StateMessage>
      )}
    </PageColumn>
  )
}
