import { CircleAlert } from 'lucide-react'
import { calendarTitleOf, type CalendarItem, type CalendarTarget } from '@vada/contracts'
import { Button } from '@/components/ui/button'
import { cardClass } from '@/components/ui/card'
import type { RangeBar } from '@/lib/range-bars'
import { cn } from '@/lib/utils'
import { monthOf, WEEKDAYS, weeksOf } from '@/tasks/calendar-month'
import { barsOf, calendarDayLabel, isMultiDay, itemsOn } from './calendar-items'
import { KIND_STYLE } from './kind-style'

const COL_START = [
  'col-start-1',
  'col-start-2',
  'col-start-3',
  'col-start-4',
  'col-start-5',
  'col-start-6',
  'col-start-7',
]
const COL_SPAN = [
  'col-span-1',
  'col-span-2',
  'col-span-3',
  'col-span-4',
  'col-span-5',
  'col-span-6',
  'col-span-7',
]
const ROW_START = ['row-start-1', 'row-start-2', 'row-start-3', 'row-start-4', 'row-start-5']
const MAX_LANES = 3
const MAX_ROWS = 3
const DAY_START = 8

type Props = {
  items: CalendarItem[]
  month: string
  today: string
  selected: string
  onSelect: (day: string) => void
  onOpen: (target: CalendarTarget) => void
}

function MonthItem({ item, onOpen }: Pick<Props, 'onOpen'> & { item: CalendarItem }) {
  const { Icon, text } = KIND_STYLE[item.kind]
  return (
    <Button
      variant="ghost"
      size="sm"
      touch
      aria-label={calendarTitleOf(item)}
      className={cn(
        'pointer-events-auto hidden min-w-0 justify-start gap-1 rounded px-1 py-0.5 text-left text-xs sm:flex',
        item.overdue ? 'text-red-700' : text,
      )}
      onClick={() => onOpen(item.target)}
    >
      {item.overdue ? <CircleAlert aria-hidden /> : <Icon aria-hidden />}
      <span className="truncate">{calendarTitleOf(item)}</span>
      {item.overdue && <span className="sr-only">지남</span>}
    </Button>
  )
}

function MonthBar({ bar, onOpen }: { bar: RangeBar<CalendarItem>; onOpen: Props['onOpen'] }) {
  const { Icon, text, background } = KIND_STYLE[bar.item.kind]
  const position = cn(
    COL_START[bar.start],
    COL_SPAN[bar.span - 1],
    ROW_START[bar.lane + 1],
    'mx-1 min-w-0 rounded-sm',
    bar.before && 'ml-0 rounded-l-none',
    bar.after && 'mr-0 rounded-r-none',
  )
  return (
    <>
      <span aria-hidden className={cn(position, 'h-1 sm:hidden', background)} />
      <Button
        variant="ghost"
        size="sm"
        aria-label={calendarTitleOf(bar.item)}
        className={cn(
          position,
          'pointer-events-auto hidden justify-start gap-1 px-1 py-0.5 text-xs sm:flex',
          text,
          background,
        )}
        onClick={() => onOpen(bar.item.target)}
      >
        <Icon aria-hidden />
        <span className="truncate">{calendarTitleOf(bar.item)}</span>
      </Button>
    </>
  )
}

function MonthWeek({ week, ...props }: Props & { week: string[] }) {
  const { items, month, today, selected, onSelect, onOpen } = props
  const bars = barsOf(items.filter(isMultiDay), week).filter(bar => bar.lane < MAX_LANES)
  const lanes = bars.reduce((max, bar) => Math.max(max, bar.lane + 1), 0)
  return (
    <div className="relative min-h-20 border-t sm:min-h-28">
      <div className="absolute inset-0 grid grid-cols-7">
        {week.map(day => (
          <Button
            key={day}
            variant="ghost"
            touch
            aria-label={`${calendarDayLabel(day, today)} 일정 ${itemsOn(items, day).length}건`}
            aria-pressed={selected === day}
            className={cn(
              'min-w-0 rounded-none border-0 border-l p-0 first:border-l-0',
              monthOf(day) !== month && 'bg-gray-50/60',
              selected === day && 'bg-blue-50 hover:bg-blue-50',
            )}
            onClick={() => onSelect(day)}
          />
        ))}
      </div>
      <div className="pointer-events-none relative grid grid-cols-7 gap-y-1 pt-1 pb-2">
        {week.map((day, index) => (
          <div
            key={day}
            className={cn(
              COL_START[index],
              ROW_START[0],
              'flex justify-center sm:justify-start sm:px-1.5',
            )}
          >
            <span
              className={cn(
                'inline-flex size-6 items-center justify-center rounded-full text-xs tabular-nums',
                day === today
                  ? 'bg-primary font-semibold text-primary-foreground'
                  : monthOf(day) !== month
                    ? 'text-gray-400'
                    : 'text-gray-700',
              )}
            >
              {Number(day.slice(DAY_START))}
            </span>
          </div>
        ))}
        {bars.map(bar => (
          <MonthBar key={bar.item.key} bar={bar} onOpen={onOpen} />
        ))}
        {week.map((day, index) => (
          <DayItems
            key={day}
            day={day}
            items={items}
            bars={bars}
            onSelect={onSelect}
            onOpen={onOpen}
            className={cn(COL_START[index], ROW_START[lanes + 1])}
          />
        ))}
      </div>
    </div>
  )
}

function DayItems({
  day,
  items,
  bars,
  onSelect,
  onOpen,
  className,
}: Pick<Props, 'items' | 'onSelect' | 'onOpen'> & {
  day: string
  bars: RangeBar<CalendarItem>[]
  className: string
}) {
  const onDay = itemsOn(items, day)
  const rows = onDay.filter(item => !isMultiDay(item)).slice(0, MAX_ROWS)
  const visibleBars = bars.filter(bar => itemsOn([bar.item], day).length > 0).length
  const hidden = onDay.length - visibleBars - rows.length
  return (
    <div className={cn('min-w-0 px-1', className)}>
      <div className="hidden min-w-0 flex-col gap-px sm:flex">
        {rows.map(item => (
          <MonthItem key={item.key} item={item} onOpen={onOpen} />
        ))}
        {hidden > 0 && (
          <Button
            variant="ghost"
            size="sm"
            touch
            className="pointer-events-auto self-start px-1 py-0 text-xs"
            onClick={() => onSelect(day)}
          >
            +{hidden}개
          </Button>
        )}
      </div>
      <div aria-hidden className="flex justify-center gap-0.5 sm:hidden">
        {rows.map(item => {
          const { Icon, text } = KIND_STYLE[item.kind]
          return (
            <Icon key={item.key} className={cn('size-3', item.overdue ? 'text-red-700' : text)} />
          )
        })}
      </div>
    </div>
  )
}

export function CalendarMonth(props: Props) {
  return (
    <div className={cn(cardClass, 'min-w-0 overflow-hidden')}>
      <div className="grid grid-cols-7 bg-gray-50 text-center text-xs font-medium text-gray-500">
        {WEEKDAYS.map(name => (
          <span key={name} className="py-2">
            {name}
          </span>
        ))}
      </div>
      {weeksOf(props.month).map(week => (
        <MonthWeek key={week[0]} week={week} {...props} />
      ))}
    </div>
  )
}
