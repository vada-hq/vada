import { Calendar, Ellipsis, FileText } from 'lucide-react'
import { TASK_STATUSES, type TaskStatus, type TaskSummary } from '@vada/contracts'
import PersonName from '@/components/PersonName'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cardClass } from '@/components/ui/card'
import { Menu, MenuContent, MenuItem, MenuTrigger } from '@/components/ui/menu'
import { cn } from '@/lib/utils'
import { useOpenDirectFor } from '../chat/direct-open'
import type { DepartmentColor } from './department-color'
import { assigneeLabel, COUNCIL_TASK_LABEL, dueLabel } from './task-view'

// 카드 '⋯' 메뉴의 상태 항목 이름(DEC-94): 어디로 가는지를 적는다.
const MOVE_LABEL: Record<TaskStatus, string> = {
  todo: '할 일로',
  in_progress: '진행 중으로',
  done: '끝남으로',
}
const UNASSIGNED_TEXT = '담당자 없음 · 배정 필요'

type Props = {
  task: TaskSummary
  color: DepartmentColor
  busy: boolean
  error?: string | undefined
  // 이어진 결과물이 있으면 문서 그림을 단다. 목록 응답에 결과물 요약이 없어 026 조각 10(정한 것 15)이 칸을 더하기 전까지 보드는 넘기지 않는다.
  hasResult?: boolean | undefined
  onOpen: () => void
  onChangeStatus: (status: TaskStatus) => void
}

// 카드 '⋯': 상태를 바꿀 수 있을 때만 지금 상태가 아닌 둘을 둔다(DEC-38). 끌어 놓기 대신 이것이 상태를 바꾸는 길이다.
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

// 담당자 이름을 누르면 그 사람과 1:1이 열린다(022 조각 7). 카드 전체를 덮는 제목 단추 위에 둔다. 떠난 사람은 글만이다.
function AssigneeText({ task }: Pick<Props, 'task'>) {
  const openFor = useOpenDirectFor()
  if (task.assignee === null)
    return <span className="text-xs font-semibold text-red-600">{UNASSIGNED_TEXT}</span>
  const label = assigneeLabel(task.assignee)
  const onOpen = task.assignee.current ? openFor(task.assignee.id) : undefined
  if (onOpen)
    return (
      <PersonName
        name={label}
        truncate
        onOpen={onOpen}
        className="relative z-10 text-xs text-gray-500"
      />
    )
  return (
    <span className="max-w-full min-w-0 truncate text-xs text-gray-500" title={label}>
      {label}
    </span>
  )
}

// 보드의 업무 카드(와이어프레임 OPS-TASK-01·EVT-TASK-01): 흰 카드, 왼쪽 부서 색상선, 업무명, 부서 칩·지남 칩·담당자, 선 아래 마감과 결과물 그림.
// 부서 색은 소속, 빨강은 긴급도다. 담당자가 없으면 카드 테두리가 빨강이다. 카드에 행사 이름은 없다(DEC-94).
// 카드 전체가 누르는 곳이 되도록 제목 단추를 카드 크기로 늘리고, '⋯'만 그 위에 둔다.
// 1024px의 좁은 열에서 카드 높이가 늘지 않게 제목은 세 줄, 부서와 담당자는 한 줄에서 자르고 전체 글은 title에 둔다(화면 읽기 이름은 전체 글).
export function TaskCard({ task, color, busy, error, hasResult, onOpen, onChangeStatus }: Props) {
  const unassigned = task.assignee === null
  const department = task.department?.name ?? COUNCIL_TASK_LABEL
  return (
    <li
      className={cn(
        cardClass,
        'relative border-l-4 p-4 transition-shadow focus-within:ring-2 focus-within:ring-blue-300 hover:shadow-md',
        unassigned ? 'border-red-300 border-l-red-500' : color.line,
      )}
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
        {task.overdue && <Badge tone="danger">지남</Badge>}
        <AssigneeText task={task} />
      </div>
      <div className="flex items-center justify-between border-t border-gray-50 pt-3">
        <span
          className={cn(
            'flex items-center gap-1.5 text-xs',
            task.overdue ? 'font-semibold text-red-600' : 'text-gray-500',
          )}
        >
          <Calendar aria-hidden className="size-3.5" />
          {task.overdue ? `${dueLabel(task.dueDate)} · 지남` : dueLabel(task.dueDate)}
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
