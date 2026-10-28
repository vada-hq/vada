import { useMemo, useRef, useState, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import {
  KOREAN_DATE_LENGTH,
  koreanDateOf,
  type EventSummary,
  type TaskSummary,
} from '@vada/contracts'
import { Button } from '@/components/ui/button'
import { cardClass } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import {
  eventBarsOf,
  eventsOn,
  monthLabel,
  monthOf,
  shiftMonth,
  tasksByDay,
  WEEKDAYS,
  weeksOf,
} from './calendar-month'
import { CalendarDayList } from './CalendarDayList'
import { CalendarLegend } from './CalendarMarks'
import { CalendarWeek } from './CalendarWeek'

type Props = {
  tasks: TaskSummary[]
  events: EventSummary[]
  row: (task: TaskSummary) => ReactNode
  onOpenTask: (taskId: string) => void
  onOpenEvent?: ((eventId: string) => void) | undefined
  initialDate?: string | undefined
  schedule?: boolean
  today?: string | undefined
}

// 행사 일시는 한국 시각 글이다. 늦게 읽혀도 첫 화면에 반영하되 사람이 고른 월·날짜는 재조회가 덮지 않는다.
// 달을 옮기면 그 달에 오늘이 있으면 오늘, 없으면 1일을 고른다.
function useCalendarState(initialDate: string | undefined, referenceDay: string | undefined) {
  const [today] = useState(() => referenceDay ?? koreanDateOf(new Date()))
  const initialDay = initialDate?.slice(0, KOREAN_DATE_LENGTH) ?? today
  const [navigation, setNavigation] = useState<{ month: string; selected: string } | null>(null)
  const month = navigation?.month ?? monthOf(initialDay)
  const selected = navigation?.selected ?? initialDay
  const setSelected = (day: string) => setNavigation({ month, selected: day })
  const go = (next: string) => {
    setNavigation({ month: next, selected: next === monthOf(today) ? today : `${next}-01` })
  }
  return { today, month, selected, setSelected, go }
}

function MonthBar({
  month,
  undated,
  onGo,
  onToday,
  onUndated,
  schedule,
}: {
  month: string
  undated: number
  onGo: (by: number) => void
  onToday: () => void
  onUndated: () => void
  schedule: boolean
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
      <div className="flex items-center gap-1">
        <Button size="icon" variant="ghost" touch aria-label="이전 달" onClick={() => onGo(-1)}>
          <ChevronLeft />
        </Button>
        <h2 className="min-w-28 text-center text-base font-semibold text-gray-900">
          {monthLabel(month)}
        </h2>
        <Button size="icon" variant="ghost" touch aria-label="다음 달" onClick={() => onGo(1)}>
          <ChevronRight />
        </Button>
        <Button size="sm" variant="outline" touch className="ml-1" onClick={onToday}>
          오늘
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <CalendarLegend schedule={schedule} />
        {undated > 0 && (
          <Button size="sm" variant="ghost" onClick={onUndated}>
            마감 없음 {undated}
          </Button>
        )}
      </div>
    </div>
  )
}

// 요일 머리. 일요일은 빨강, 토요일은 파랑(한국 달력).
function WeekdayHeader() {
  return (
    <div className="grid grid-cols-7 bg-gray-50 text-center text-xs font-medium text-gray-500">
      {WEEKDAYS.map((name, index) => (
        <span
          key={name}
          className={cn(
            'py-2',
            index === 0 && 'text-red-600',
            index === WEEKDAYS.length - 1 && 'text-blue-600',
          )}
        >
          {name}
        </span>
      ))}
    </div>
  )
}

// 업무 화면의 달력 보기: 월 달력(행사는 여러 날 막대, 업무는 마감날의 제목) 아래에 고른 날의 줄 목록을 둔다.
// 달력은 한 달의 흐름을, 아래 목록은 그날의 자세한 내용과 동작을 맡는다(휴대폰은 칸에 점만 보인다).
export function TaskCalendar({
  tasks,
  events,
  row,
  onOpenTask,
  onOpenEvent,
  initialDate,
  schedule = false,
  today: referenceDay,
}: Props) {
  const { today, month, selected, setSelected, go } = useCalendarState(initialDate, referenceDay)
  const listRef = useRef<HTMLDivElement>(null)
  const byDay = useMemo(() => tasksByDay(tasks), [tasks])
  const undated = tasks.filter(task => task.dueDate === null)
  const pick = (day: string) => {
    setSelected(day)
    requestAnimationFrame(() =>
      listRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }),
    )
  }
  return (
    <div className="flex flex-col gap-4">
      <MonthBar
        month={month}
        undated={undated.length}
        onGo={by => go(shiftMonth(month, by))}
        onToday={() => go(monthOf(today))}
        onUndated={() => pick('none')}
        schedule={schedule}
      />
      <div className={cn(cardClass, 'overflow-hidden')}>
        <WeekdayHeader />
        {weeksOf(month).map(week => (
          <CalendarWeek
            key={week[0]}
            week={week}
            month={month}
            today={today}
            selected={selected}
            bars={eventBarsOf(events, week)}
            tasksOf={day => byDay.get(day) ?? []}
            eventsOf={day => eventsOn(events, day)}
            onSelect={pick}
            onOpenTask={onOpenTask}
            onOpenEvent={onOpenEvent}
            schedule={schedule}
          />
        ))}
      </div>
      <div ref={listRef}>
        <CalendarDayList
          selected={selected}
          tasks={selected === 'none' ? undated : (byDay.get(selected) ?? [])}
          events={selected === 'none' ? [] : eventsOn(events, selected)}
          row={row}
          onOpenEvent={onOpenEvent}
        />
      </div>
    </div>
  )
}
