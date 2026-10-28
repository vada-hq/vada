import type { ReactNode } from 'react'
import type { CalendarItem, CalendarKind, CalendarTarget } from '@vada/contracts'
import { monthOf, shiftMonth } from '@/tasks/calendar-month'
import { itemsOn } from './calendar-items'
import { CalendarHeader, type CalendarLayout } from './CalendarHeader'
import { CalendarDay, CalendarList } from './CalendarList'
import { CalendarMonth } from './CalendarMonth'

type Props = {
  items: CalendarItem[]
  today: string
  month: string
  selected: string
  layout: CalendarLayout
  kind: CalendarKind | null
  onLayout: (layout: CalendarLayout) => void
  onKind: (kind: CalendarKind | null) => void
  onMonth: (month: string) => void
  onSelect: (day: string) => void
  onOpen: (target: CalendarTarget) => void
  children?: ReactNode
}

export function CalendarView({
  items,
  today,
  month,
  selected,
  layout,
  kind,
  onLayout,
  onKind,
  onMonth,
  onSelect,
  onOpen,
  children,
}: Props) {
  const filtered = kind ? items.filter(item => item.kind === kind) : items
  return (
    <div className="flex min-w-0 flex-col gap-4 break-keep">
      <CalendarHeader
        month={month}
        layout={layout}
        kind={kind}
        onLayout={onLayout}
        onKind={onKind}
        onShift={by => onMonth(shiftMonth(month, by))}
        onToday={() => {
          onMonth(monthOf(today))
          onSelect(today)
        }}
      />
      {children ??
        (layout === 'month' ? (
          <>
            <CalendarMonth
              items={filtered}
              month={month}
              today={today}
              selected={selected}
              onSelect={onSelect}
              onOpen={onOpen}
            />
            <CalendarDay
              day={selected}
              today={today}
              items={itemsOn(filtered, selected)}
              onOpen={onOpen}
            />
          </>
        ) : (
          <CalendarList items={filtered} month={month} today={today} onOpen={onOpen} />
        ))}
    </div>
  )
}
