import type { CalendarItem, CalendarTarget } from '@vada/contracts'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import { cardClass } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { calendarDayLabel, monthGroupsOf } from './calendar-items'
import { CalendarRow } from './CalendarRow'

type DayProps = {
  day: string
  today: string
  items: CalendarItem[]
  onOpen: (target: CalendarTarget) => void
  onCreate?: (() => void) | undefined
}

export function CalendarDay({ day, today, items, onOpen, onCreate }: DayProps) {
  const title = calendarDayLabel(day, today)
  return (
    <section aria-label={title} className="flex min-w-0 scroll-mt-4 flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-semibold text-fg">{title}</h3>
        {day === today && <span className="text-xs font-normal text-primary">오늘</span>}
        <span className="ml-auto text-right font-normal text-fg-muted tabular-nums">
          {items.length}건
        </span>
        {onCreate && (
          <Button variant="outline" size="sm" touch onClick={onCreate}>
            일정 추가
          </Button>
        )}
      </div>
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
  onCreate,
}: Omit<DayProps, 'day' | 'onCreate'> & {
  month: string
  onCreate?: ((day: string) => void) | undefined
}) {
  const groups = monthGroupsOf(items, month)
  if (!groups.length)
    return (
      <div className="flex flex-col items-start gap-3">
        <StateMessage kind="empty">이 달 일정 없음</StateMessage>
        {onCreate && (
          <Button
            variant="outline"
            touch
            onClick={() => onCreate(month === today.slice(0, month.length) ? today : `${month}-01`)}
          >
            일정 추가
          </Button>
        )}
      </div>
    )
  return (
    <div className="flex min-w-0 flex-col gap-5">
      {groups.map(({ day, items: onDay }) => (
        <CalendarDay
          key={day}
          day={day}
          today={today}
          items={onDay}
          onOpen={onOpen}
          onCreate={onCreate && (() => onCreate(day))}
        />
      ))}
    </div>
  )
}
