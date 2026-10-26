import { Calendar, Ellipsis, FileText } from 'lucide-react'
import { TASK_STATUSES, type TaskStatus, type TaskSummary } from '@vada/contracts'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cardClass } from '@/components/ui/card'
import { Menu, MenuContent, MenuItem, MenuTrigger } from '@/components/ui/menu'
import { cn } from '@/lib/utils'
import type { DepartmentColor } from './department-color'
import { assigneeLabel, COUNCIL_TASK_LABEL, dueLabel, nextLabel } from './task-view'

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
  mobile?: boolean | undefined
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

function AssigneeText({ task }: Pick<Props, 'task'>) {
  if (task.assignee === null)
    return <span className="text-xs font-semibold text-red-600">{UNASSIGNED_TEXT}</span>
  const label = assigneeLabel(task.assignee)
  return (
    <span
      className="max-w-full min-w-0 truncate text-xs break-keep text-gray-500 max-sm:line-clamp-2 max-sm:whitespace-normal max-sm:wrap-anywhere"
      title={label}
    >
      {label}
    </span>
  )
}

// 휴대폰에서는 메뉴를 열지 않고 다음 상태로 옮긴다(DEC-94). 권한과 목적지는 서버 응답을 따른다.
function MobileAction({
  task,
  busy,
  onChangeStatus,
}: Pick<Props, 'task' | 'busy' | 'onChangeStatus'>) {
  const next = task.next
  if (!task.actions.includes('task.change_status') || task.status === 'done' || !next) return null
  return (
    <Button
      touch
      size="sm"
      variant="outline"
      className="relative z-10 self-start"
      busy={busy}
      onClick={() => onChangeStatus(next)}
    >
      {nextLabel(next)}
    </Button>
  )
}

// 카드 전체로 상세를 열어 긴 제목·담당자·부서를 확인할 수 있다. 오른쪽 동작만 카드의 누르는 영역 위에 둔다.
export function TaskCard({
  task,
  color,
  busy,
  error,
  hasResult,
  mobile,
  onOpen,
  onChangeStatus,
}: Props) {
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
          className="h-auto min-w-0 flex-1 justify-start p-0 text-left text-sm leading-tight font-bold break-keep whitespace-normal text-gray-800 wrap-anywhere after:absolute after:inset-0 focus-visible:ring-0 max-sm:min-h-11"
          title={task.title}
          onClick={onOpen}
        >
          <span className="line-clamp-3">{task.title}</span>
        </Button>
        {mobile ? (
          <MobileAction task={task} busy={busy} onChangeStatus={onChangeStatus} />
        ) : (
          <StatusMenu task={task} busy={busy} onChangeStatus={onChangeStatus} />
        )}
      </div>
      <div className="mt-2 mb-3 flex flex-wrap items-center gap-2">
        <Badge className={cn('max-w-full border-transparent', color.chip)} title={department}>
          <span className="truncate break-keep max-sm:line-clamp-2 max-sm:whitespace-normal max-sm:wrap-anywhere">
            {department}
          </span>
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
