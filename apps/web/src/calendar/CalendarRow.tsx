import { CircleAlert } from 'lucide-react'
import {
  CALENDAR_KIND_LABELS,
  calendarTitleOf,
  type CalendarItem,
  type CalendarTarget,
} from '@vada/contracts'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { KIND_STYLE } from './kind-style'

const TIME_START = 11

export function CalendarRow({
  item,
  onOpen,
}: {
  item: CalendarItem
  onOpen: (target: CalendarTarget) => void
}) {
  const { Icon, text } = KIND_STYLE[item.kind]
  const title = calendarTitleOf(item)
  return (
    <li>
      <Button
        variant="ghost"
        touch
        aria-label={title}
        className="h-auto w-full min-w-0 justify-start gap-3 px-4 py-3 text-left break-keep whitespace-normal hover:bg-gray-50"
        onClick={() => onOpen(item.target)}
      >
        <Icon aria-hidden className={cn('self-start', text)} />
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="line-clamp-2 text-sm font-medium text-gray-900 wrap-anywhere sm:line-clamp-none">
            {title}
          </span>
          <span className="text-xs font-normal text-gray-500 wrap-anywhere">
            <span className={text}>{CALENDAR_KIND_LABELS[item.kind]}</span>
            {' · '}
            <span className="tabular-nums">
              {item.allDay ? '종일' : item.start.slice(TIME_START)}
            </span>
            {item.event && ` · ${item.event.name}`}
            {item.department && ` · ${item.department.name}`}
          </span>
        </span>
        {item.overdue && (
          <span className="flex shrink-0 items-center gap-1 self-start text-xs text-red-700">
            <CircleAlert aria-hidden />
            지남
          </span>
        )}
      </Button>
    </li>
  )
}
