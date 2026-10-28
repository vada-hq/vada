import type { CalendarItem, CalendarTarget } from '@vada/contracts'
import StateMessage from '@/components/StateMessage'
import { cardClass } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { calendarDayLabel, monthGroupsOf } from './calendar-items'
import { CalendarRow } from './CalendarRow'

type DayProps = {
  day: string
  today: string
  items: CalendarItem[]
  onOpen: (target: CalendarTarget) => void
}

export function CalendarDay({ day, today, items, onOpen }: DayProps) {
  const title = calendarDayLabel(day, today)
  return (
    <section aria-label={title} className="flex min-w-0 scroll-mt-4 flex-col gap-2">
      <h3 className="flex flex-wrap items-center gap-2 text-sm font-semibold text-gray-900">
        {title}
        {day === today && <span className="text-xs font-normal text-primary">오늘</span>}
        <span className="ml-auto text-right font-normal text-gray-500 tabular-nums">
          {items.length}건
        </span>
      </h3>
      {items.length === 0 ? (
        <StateMessage kind="empty">일정 없음</StateMessage>
      ) : (
        <ul className={cn(cardClass, 'min-w-0 divide-y overflow-hidden')}>
          {items.map(item => (
            <CalendarRow key={item.key} item={item} onOpen={onOpen} />
          ))}
        </ul>
      )}
    </section>
  )
}

export function CalendarList({
  items,
  month,
  today,
  onOpen,
}: Omit<DayProps, 'day'> & { month: string }) {
  const groups = monthGroupsOf(items, month)
  if (!groups.length) return <StateMessage kind="empty">이 달 일정 없음</StateMessage>
  return (
    <div className="flex min-w-0 flex-col gap-5">
      {groups.map(({ day, items: onDay }) => (
        <CalendarDay key={day} day={day} today={today} items={onDay} onOpen={onOpen} />
      ))}
    </div>
  )
}
