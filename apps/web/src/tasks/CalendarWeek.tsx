import type { EventSummary, TaskSummary } from '@vada/contracts'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { dayLabel, monthOf, weekdayOf, type EventBar } from './calendar-month'
import { markLabel, markTextClass, TaskDot, TaskMark } from './CalendarMarks'
import { assigneeLabel } from './task-view'

// Tailwind는 글자 그대로 쓴 클래스만 만든다. 그래서 칸 위치를 목록으로 둔다.
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
// 칸 하나에 보이는 행사 줄과 업무 수. 넘치는 것은 '+N'으로 묶고 고른 날 목록에 모두 보인다.
const MAX_LANES = 3
const MAX_CHIPS = 3
const MAX_DOTS = 4
const SUNDAY = 0
const SATURDAY = 6
const DAY_START = 8

type Props = {
  week: string[]
  month: string
  today: string
  selected: string | null
  bars: EventBar[]
  tasksOf: (day: string) => TaskSummary[]
  eventsOf: (day: string) => EventSummary[]
  onSelect: (day: string) => void
  onOpenTask: (taskId: string) => void
  onOpenEvent?: ((eventId: string) => void) | undefined
  schedule?: boolean
}

// 날짜 숫자. 일요일은 빨강, 토요일은 파랑(한국 달력), 오늘은 파란 동그라미, 다른 달은 흐리게.
function DayNumber({ day, month, today }: { day: string; month: string; today: string }) {
  const weekday = weekdayOf(day)
  return (
    <span
      className={cn(
        'inline-flex size-6 items-center justify-center rounded-full text-xs',
        day === today
          ? 'bg-primary font-semibold text-primary-foreground'
          : monthOf(day) !== month
            ? 'text-fg-faint'
            : weekday === SUNDAY
              ? 'text-sunday'
              : weekday === SATURDAY
                ? 'text-saturday'
                : 'text-fg-secondary',
      )}
    >
      {Number(day.slice(DAY_START))}
    </span>
  )
}

function Chip({
  task,
  onOpen,
  schedule,
}: {
  task: TaskSummary
  onOpen: () => void
  schedule: boolean | undefined
}) {
  return (
    <Button
      variant="ghost"
      size="sm"
      type="button"
      title={`${task.title} · ${assigneeLabel(task.assignee)} · ${markLabel(task)}`}
      className={cn(
        'pointer-events-auto flex min-w-0 cursor-pointer items-center gap-1 rounded px-1 py-0.5 text-left text-xs hover:bg-surface-muted',
        markTextClass(task),
      )}
      onClick={onOpen}
    >
      <TaskMark task={task} schedule={schedule} />
      <span className="truncate">{task.title}</span>
    </Button>
  )
}

// 그날의 업무: 넓은 화면은 제목 줄, 휴대폰은 점.
function DayTasks({
  tasks,
  onMore,
  onOpenTask,
  schedule,
}: {
  tasks: TaskSummary[]
  onMore: () => void
  onOpenTask: (taskId: string) => void
  schedule: boolean | undefined
}) {
  const hidden = tasks.length - MAX_CHIPS
  return (
    <div className="flex min-w-0 flex-col gap-px px-1">
      <div className="hidden min-w-0 flex-col gap-px sm:flex">
        {tasks.slice(0, MAX_CHIPS).map(task => (
          <Chip key={task.id} task={task} onOpen={() => onOpenTask(task.id)} schedule={schedule} />
        ))}
        {hidden > 0 && (
          <button
            type="button"
            className="pointer-events-auto cursor-pointer self-start rounded px-1 text-xs text-fg-muted hover:bg-surface-muted"
            onClick={onMore}
          >
            +{hidden}개
          </button>
        )}
      </div>
      <div className="flex justify-center gap-0.5 sm:hidden">
        {tasks.slice(0, MAX_DOTS).map(task => (
          <TaskDot key={task.id} task={task} schedule={schedule} />
        ))}
      </div>
    </div>
  )
}

function Bar({ bar, onOpenEvent }: { bar: EventBar; onOpenEvent: Props['onOpenEvent'] }) {
  const position = cn(
    COL_START[bar.start],
    COL_SPAN[bar.span - 1],
    ROW_START[bar.lane + 1],
    'mx-1 rounded-sm',
    bar.before && 'ml-0 rounded-l-none',
    bar.after && 'mr-0 rounded-r-none',
  )
  if (!onOpenEvent)
    return (
      <span
        className={cn(
          position,
          'h-1 truncate bg-kind-event-bar text-xs font-medium text-kind-event-bar-fg sm:h-5 sm:bg-kind-event-soft sm:px-1.5',
        )}
      >
        <span className="hidden sm:inline">{bar.event.name}</span>
      </span>
    )
  return (
    <>
      <span aria-hidden className={cn(position, 'h-1 bg-kind-event-bar sm:hidden')} />
      <Button
        variant="ghost"
        size="sm"
        type="button"
        title={bar.event.name}
        className={cn(
          position,
          'pointer-events-auto hidden h-5 min-w-0 justify-start truncate bg-kind-event-soft px-1.5 py-0 text-left text-xs font-medium text-kind-event-bar-fg hover:bg-kind-event-line sm:flex',
        )}
        onClick={() => onOpenEvent(bar.event.id)}
      >
        <span className="hidden sm:inline">{bar.event.name}</span>
      </Button>
    </>
  )
}

// 뒤 칸: 날마다 그날을 고르는 단추. 읽는 프로그램에는 그날의 업무와 행사 수를 알린다.
function DayButtons({ week, month, selected, tasksOf, eventsOf, onSelect }: Props) {
  return (
    <div className="absolute inset-0 grid grid-cols-7">
      {week.map(day => (
        <button
          key={day}
          type="button"
          aria-label={`${dayLabel(day)} 업무 ${tasksOf(day).length}개, 행사 ${eventsOf(day).length}개`}
          aria-pressed={selected === day}
          className={cn(
            'cursor-pointer border-l first:border-l-0 hover:bg-surface-subtle focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none focus-visible:ring-inset',
            monthOf(day) !== month && 'bg-surface-subtle/60',
            selected === day && 'bg-primary-surface hover:bg-primary-surface',
          )}
          onClick={() => onSelect(day)}
        />
      ))}
    </div>
  )
}

// 한 주. 뒤 칸(날마다 누르면 그날을 고르는 단추) 위에 날짜, 행사 막대, 업무를 겹쳐 둔다.
// 행사 막대는 여러 날에 걸쳐 이어 그리고 업무보다 위에 둔다(월 달력의 일반적인 배치).
export function CalendarWeek(props: Props) {
  const { week, month, today } = props
  const bars = props.bars.filter(bar => bar.lane < MAX_LANES)
  const lanes = bars.reduce((most, bar) => Math.max(most, bar.lane + 1), 0)
  return (
    <div className="relative min-h-16 border-t sm:min-h-24">
      <DayButtons {...props} />
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
            <DayNumber day={day} month={month} today={today} />
          </div>
        ))}
        {bars.map(bar => (
          <Bar key={bar.event.id} bar={bar} onOpenEvent={props.onOpenEvent} />
        ))}
        {week.map((day, index) => (
          <div key={day} className={cn(COL_START[index], ROW_START[lanes + 1], 'min-w-0')}>
            <DayTasks
              tasks={props.tasksOf(day)}
              onMore={() => props.onSelect(day)}
              onOpenTask={props.onOpenTask}
              schedule={props.schedule}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
