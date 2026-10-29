import { Circle, CircleAlert, CircleCheck, CircleDot } from 'lucide-react'
import type { TaskSummary } from '@vada/contracts'
import { cn } from '@/lib/utils'
import { markOf, type MarkKind } from './calendar-month'

// 달력에서 업무의 상태를 모양과 색으로 함께 보인다(색만으로 알리지 않는다, WCAG 1.4.1).

const MARKS = {
  overdue: { Icon: CircleAlert, label: '지남', icon: 'text-danger-emphasis', text: 'text-danger' },
  in_progress: {
    Icon: CircleDot,
    label: '진행 중',
    icon: 'text-primary-emphasis',
    text: 'text-fg',
  },
  todo: { Icon: Circle, label: '할 일', icon: 'text-fg-subtle', text: 'text-fg-secondary' },
  done: { Icon: CircleCheck, label: '끝남', icon: 'text-fg-faint', text: 'text-fg-muted' },
} satisfies Record<MarkKind, unknown>

const LEGEND: MarkKind[] = ['todo', 'in_progress', 'overdue', 'done']

export const markLabel = (task: TaskSummary) => MARKS[markOf(task)].label
export const markTextClass = (task: TaskSummary) => MARKS[markOf(task)].text

export function TaskMark({
  task,
  className,
  schedule = false,
}: {
  task: TaskSummary
  className?: string
  schedule?: boolean | undefined
}) {
  const { Icon, icon } = MARKS[markOf(task)]
  return (
    <Icon
      aria-hidden
      className={cn(
        'size-3.5 shrink-0',
        schedule && !task.overdue ? 'text-pending-emphasis' : icon,
        className,
      )}
    />
  )
}

// 휴대폰 칸 안의 점. 칸이 좁아 제목 대신 상태만 보인다.
export function TaskDot({
  task,
  schedule = false,
}: {
  task: TaskSummary
  schedule?: boolean | undefined
}) {
  const tone = {
    overdue: 'bg-danger-mark',
    in_progress: 'bg-primary-mark',
    todo: 'bg-fg-subtle',
    done: 'bg-fg-faint',
  }[markOf(task)]
  return (
    <span
      aria-hidden
      className={cn('size-1.5 rounded-full', schedule && !task.overdue ? 'bg-pending-mark' : tone)}
    />
  )
}

// 모양의 뜻. 행사 막대도 함께 적는다. 휴대폰은 칸에 점만 있고 아래 목록이 글로 알려 주므로 숨긴다.
export function CalendarLegend({ schedule = false }: { schedule?: boolean }) {
  return (
    <ul className="hidden flex-wrap items-center gap-x-3 gap-y-1 text-xs text-fg-muted sm:flex">
      <li className="flex items-center gap-1">
        <span aria-hidden className="h-2 w-4 rounded-sm bg-kind-event-bar" />
        행사
      </li>
      {schedule ? (
        <li className="flex items-center gap-1">
          <Circle aria-hidden className="size-3.5 text-pending-emphasis" />
          마감
        </li>
      ) : (
        LEGEND.map(kind => {
          const { Icon, icon, label } = MARKS[kind]
          return (
            <li key={kind} className="flex items-center gap-1">
              <Icon aria-hidden className={cn('size-3.5', icon)} />
              {label}
            </li>
          )
        })
      )}
    </ul>
  )
}
