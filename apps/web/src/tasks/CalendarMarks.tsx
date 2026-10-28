import { Circle, CircleAlert, CircleCheck, CircleDot } from 'lucide-react'
import type { TaskSummary } from '@vada/contracts'
import { cn } from '@/lib/utils'
import { markOf, type MarkKind } from './calendar-month'

// 달력에서 업무의 상태를 모양과 색으로 함께 보인다(색만으로 알리지 않는다, WCAG 1.4.1).

const MARKS = {
  overdue: { Icon: CircleAlert, label: '지남', icon: 'text-red-600', text: 'text-red-700' },
  in_progress: { Icon: CircleDot, label: '진행 중', icon: 'text-blue-600', text: 'text-gray-900' },
  todo: { Icon: Circle, label: '할 일', icon: 'text-gray-400', text: 'text-gray-700' },
  done: { Icon: CircleCheck, label: '끝남', icon: 'text-gray-300', text: 'text-gray-500' },
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
        schedule && !task.overdue ? 'text-orange-600' : icon,
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
    overdue: 'bg-red-500',
    in_progress: 'bg-blue-500',
    todo: 'bg-gray-400',
    done: 'bg-gray-300',
  }[markOf(task)]
  return (
    <span
      aria-hidden
      className={cn('size-1.5 rounded-full', schedule && !task.overdue ? 'bg-orange-500' : tone)}
    />
  )
}

// 모양의 뜻. 행사 막대도 함께 적는다. 휴대폰은 칸에 점만 있고 아래 목록이 글로 알려 주므로 숨긴다.
export function CalendarLegend({ schedule = false }: { schedule?: boolean }) {
  return (
    <ul className="hidden flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500 sm:flex">
      <li className="flex items-center gap-1">
        <span aria-hidden className="h-2 w-4 rounded-sm bg-emerald-200" />
        행사
      </li>
      {schedule ? (
        <li className="flex items-center gap-1">
          <Circle aria-hidden className="size-3.5 text-orange-600" />
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
