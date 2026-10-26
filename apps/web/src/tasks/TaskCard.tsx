import { Calendar, Ellipsis, FileText } from 'lucide-react'
import { TASK_STATUSES, type TaskStatus, type TaskSummary } from '@vada/contracts'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cardClass } from '@/components/ui/card'
import { Menu, MenuContent, MenuItem, MenuTrigger } from '@/components/ui/menu'
import { cn } from '@/lib/utils'
import type { DepartmentColor } from './department-color'
import { assigneeLabel, COUNCIL_TASK_LABEL, dueLabel } from './task-view'
import type { TaskCardDrag } from './useTaskDrag'

// 카드 '⋯' 메뉴의 상태 항목 이름(DEC-94): 어디로 가는지를 적는다.
const MOVE_LABEL: Record<TaskStatus, string> = {
  todo: '할 일로',
  in_progress: '진행 중으로',
  done: '끝남으로',
}
const NO_DRAG: TaskCardDrag = { enabled: false, active: false, start: () => false, end: () => {} }

type Props = {
  task: TaskSummary
  color: DepartmentColor
  busy: boolean
  error?: string | undefined
  drag?: TaskCardDrag | undefined
  // 이어진 결과물이 있으면 문서 그림을 단다. 목록 응답에 결과물 요약이 없어 026 조각 10(정한 것 15)이 칸을 더하기 전까지 보드는 넘기지 않는다.
  hasResult?: boolean | undefined
  onOpen: () => void
  onChangeStatus: (status: TaskStatus) => void
}

// 카드 '⋯'는 드래그 없이 포인터·키보드로 상태를 바꾸는 대안이다(WCAG 2.5.7).
function StatusMenu({
  task,
  busy,
  onChangeStatus,
}: Pick<Props, 'task' | 'busy' | 'onChangeStatus'>) {
  if (!task.actions.includes('task.change_status')) return null
  return (
    <Menu>
      <MenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative z-10 -mt-1.5 -mr-2 shrink-0 p-1 text-gray-500"
          aria-label={`${task.title} 더 보기`}
          busy={busy}
          onDragStart={event => {
            event.preventDefault()
            event.stopPropagation()
          }}
        >
          <Ellipsis />
        </Button>
      </MenuTrigger>
      <MenuContent>
        {TASK_STATUSES.filter(status => status !== task.status).map(status => (
          <MenuItem key={status} onSelect={() => onChangeStatus(status)}>
            {MOVE_LABEL[status]}
          </MenuItem>
        ))}
      </MenuContent>
    </Menu>
  )
}

function AssigneeText({ task }: Pick<Props, 'task'>) {
  const label = assigneeLabel(task.assignee)
  return (
    <span className="max-w-full min-w-0 truncate text-xs text-gray-500" title={label}>
      {label}
    </span>
  )
}

function cardStyle(color: DepartmentColor, drag: TaskCardDrag) {
  return cn(
    cardClass,
    'relative border-l-4 p-4 transition-shadow focus-within:ring-2 focus-within:ring-blue-300 hover:shadow-md',
    color.line,
    drag.enabled && 'cursor-grab',
    drag.active && 'cursor-grabbing opacity-50',
  )
}

// 보드의 업무 카드(와이어프레임 OPS-TASK-01·EVT-TASK-01): 흰 카드, 왼쪽 부서 색상선, 업무명, 부서 칩·지남 칩·담당자, 선 아래 마감과 결과물 그림.
// 부서 색은 소속, 빨강은 미완료 업무의 마감 지남과 실제 오류에만 쓴다(DEC-97). 카드에 행사 이름은 없다.
// 카드 전체가 누르는 곳이 되도록 제목 단추를 카드 크기로 늘리고, '⋯'만 그 위에 둔다.
// 1024px의 좁은 열에서 카드 높이가 늘지 않게 제목은 세 줄, 부서와 담당자는 한 줄에서 자르고 전체 글은 title에 둔다(화면 읽기 이름은 전체 글).
export function TaskCard({
  task,
  color,
  busy,
  error,
  drag = NO_DRAG,
  hasResult,
  onOpen,
  onChangeStatus,
}: Props) {
  const overdue = task.status !== 'done' && task.overdue
  const department = task.department?.name ?? COUNCIL_TASK_LABEL
  return (
    <li
      draggable={drag.enabled}
      onDragStart={event => {
        drag.start(event)
      }}
      onDragEnd={drag.end}
      className={cardStyle(color, drag)}
    >
      <div className="flex items-start gap-2">
        <Button
          variant="link"
          className="h-auto min-w-0 flex-1 justify-start p-0 text-left text-sm leading-tight font-bold whitespace-normal text-gray-800 wrap-anywhere after:absolute after:inset-0 focus-visible:ring-0"
          title={task.title}
          onClick={onOpen}
        >
          <span className="line-clamp-3">{task.title}</span>
        </Button>
        <StatusMenu task={task} busy={busy} onChangeStatus={onChangeStatus} />
      </div>
      <div className="mt-2 mb-3 flex flex-wrap items-center gap-2">
        <Badge className={cn('max-w-full border-transparent', color.chip)} title={department}>
          <span className="truncate">{department}</span>
        </Badge>
        {overdue && <Badge tone="danger">지남</Badge>}
        <AssigneeText task={task} />
      </div>
      <div className="flex items-center justify-between border-t border-gray-50 pt-3">
        <span
          className={cn(
            'flex items-center gap-1.5 text-xs',
            overdue ? 'font-semibold text-red-600' : 'text-gray-500',
          )}
        >
          <Calendar aria-hidden className="size-3.5" />
          {overdue ? `${dueLabel(task.dueDate)} · 지남` : dueLabel(task.dueDate)}
        </span>
        {hasResult && <FileText aria-label="결과물 있음" className="size-4 text-gray-300" />}
      </div>
      {error && (
        <p role="alert" className="mt-2 text-xs text-destructive wrap-anywhere">
          {error}
        </p>
      )}
    </li>
  )
}
