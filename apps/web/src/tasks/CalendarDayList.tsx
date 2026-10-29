import type { ReactNode } from 'react'
import type { EventSummary, TaskSummary } from '@vada/contracts'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import { cardClass } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { dayLabel } from './calendar-month'

const TIME_START = 11
const TIME_END = 16
const DATE_END = 10

type Props = {
  // 고른 날, 또는 마감 없는 업무('none')
  selected: string
  tasks: TaskSummary[]
  events: EventSummary[]
  row: (task: TaskSummary) => ReactNode
  onOpenEvent?: ((eventId: string) => void) | undefined
}

// 행사 시각: 같은 날이면 '18:00–20:00', 여러 날이면 '10월 30일 14:00 – 11월 1일 12:00'.
function eventTime(event: EventSummary) {
  const { startsAt, endsAt } = event
  if (!startsAt) return ''
  const time = (at: string) => at.slice(TIME_START, TIME_END)
  if (!endsAt) return time(startsAt)
  if (startsAt.slice(0, DATE_END) === endsAt.slice(0, DATE_END))
    return `${time(startsAt)}–${time(endsAt)}`
  const at = (value: string) => {
    const [, month, day] = value.slice(0, DATE_END).split('-').map(Number)
    return `${month}월 ${day}일 ${time(value)}`
  }
  return `${at(startsAt)} – ${at(endsAt)}`
}

function EventRow({ event, onOpen }: { event: EventSummary; onOpen: Props['onOpenEvent'] }) {
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 border-l-4 border-l-kind-event-line px-4 py-3">
      {onOpen ? (
        <Button
          variant="link"
          touch
          className="h-auto min-w-0 justify-start p-0 text-left text-sm font-medium break-keep whitespace-normal text-fg wrap-anywhere"
          onClick={() => onOpen(event.id)}
        >
          {event.name}
        </Button>
      ) : (
        <span className="text-sm font-medium text-fg wrap-anywhere">{event.name}</span>
      )}
      <span className="text-xs text-fg-muted">
        {[eventTime(event), event.place].filter(Boolean).join(' · ')}
      </span>
    </li>
  )
}

// 달력 아래의 고른 날: 그날의 행사와 업무를 줄로 모두 보이고, 업무 줄에서 바로 시작·끝내기·맡기기를 한다.
export function CalendarDayList({ selected, tasks, events, row, onOpenEvent }: Props) {
  const title = selected === 'none' ? '마감 없음' : dayLabel(selected)
  const count = tasks.length + events.length
  return (
    <section aria-label={title} className="flex scroll-mt-4 flex-col gap-2">
      <h2 className="text-sm font-semibold text-fg">
        {title}
        <span className="ml-1.5 font-normal text-fg-muted tabular-nums">{count}건</span>
      </h2>
      {count === 0 ? (
        <StateMessage kind="empty">일정 없음</StateMessage>
      ) : (
        <ul className={cn(cardClass, 'divide-y overflow-hidden')}>
          {events.map(event => (
            <EventRow key={event.id} event={event} onOpen={onOpenEvent} />
          ))}
          {tasks.map(row)}
        </ul>
      )}
    </section>
  )
}
