import { Calendar, Ellipsis, FileText } from 'lucide-react'
import type { TaskSummary } from '@vada/contracts'
import type { MenuAction } from '@/components/HistoryMenu'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cardClass } from '@/components/ui/card'
import { Menu, MenuContent, MenuItem, MenuTrigger } from '@/components/ui/menu'
import { cn } from '@/lib/utils'
import { dayLabel } from '@/lib/korean-date-text'
import type { DepartmentColor } from './department-color'
import { assigneeLabel, COUNCIL_TASK_LABEL, dueLabel } from './task-view'
import { resultSummaryLine } from './task-results'
import type { TaskCardDrag } from './useTaskDrag'
import { TaskAssigneeName, type TaskDirect } from './TaskAssigneeName'

const NO_DRAG: TaskCardDrag = { enabled: false, active: false, start: () => false, end: () => {} }

type Props = {
  task: TaskSummary
  direct?: TaskDirect | undefined
  color: DepartmentColor
  busy: boolean
  error?: string | undefined
  drag?: TaskCardDrag | undefined
  // 보드의 문서 그림은 호출자가 고른다. 내 업무 변형은 목록의 결과물 요약을 한 줄로 보인다.
  hasResult?: boolean | undefined
  onOpen: () => void
  // 카드 '⋯' 메뉴의 동작(링크 복사, 지우기). 비면 '⋯'가 없다.
  menu?: MenuAction[] | undefined
  variant?: 'board' | 'mine'
  onFinish?: (() => void) | undefined
}

// 카드 '⋯'는 그 업무에 하는 동작(링크 복사, 지우기)이다. 상태는 끌어 놓기와 상세의 상태 단추로 바꾼다(끌기 없는 길, WCAG 2.5.7).
// 사용자는 '⋯'에서 지우기·복제 같은 동작을 찾는다(Trello·Linear·Asana 카드 메뉴, notes/task-detail-redesign.md).
function CardMenu({
  task,
  busy,
  menu,
  variant,
}: Pick<Props, 'task' | 'busy' | 'menu' | 'variant'>) {
  if (!menu?.length) return null
  return (
    <Menu>
      <MenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          touch={variant === 'mine'}
          className="relative z-10 -mt-1.5 -mr-2 shrink-0 p-1 text-fg-muted"
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
        {menu.map(action => (
          <MenuItem
            key={action.label}
            destructive={action.destructive ?? false}
            onSelect={action.onSelect}
          >
            {action.label}
          </MenuItem>
        ))}
      </MenuContent>
    </Menu>
  )
}

function AssigneeText({ task, direct }: Pick<Props, 'task' | 'direct'>) {
  const label = assigneeLabel(task.assignee)
  return (
    <span className="max-w-full min-w-0 truncate text-xs text-fg-muted" title={label}>
      <TaskAssigneeName assignee={task.assignee} direct={direct} />
    </span>
  )
}

function cardStyle(color: DepartmentColor, drag: TaskCardDrag) {
  return cn(
    cardClass,
    'relative border-l-4 p-4 transition-shadow focus-within:ring-2 focus-within:ring-primary-border-strong hover:shadow-md',
    color.line,
    drag.enabled && 'cursor-grab',
    drag.active && 'cursor-grabbing opacity-50',
  )
}

function MyTaskCard({ task, color, busy, error, menu, onOpen, onFinish }: Props) {
  const result = resultSummaryLine(task)
  const department = task.department?.name
  return (
    <li className={cn(cardStyle(color, NO_DRAG), 'min-w-0 break-keep')}>
      <div className="flex min-w-0 items-start gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <Button
              variant="link"
              className="h-auto min-w-0 max-w-full justify-start p-0 text-left text-sm leading-snug font-semibold whitespace-normal text-fg wrap-anywhere after:absolute after:inset-0 focus-visible:ring-0 max-sm:min-h-11"
              onClick={onOpen}
            >
              <span className="line-clamp-2">{task.title}</span>
            </Button>
            {department && (
              <Badge className={cn('max-w-full min-w-0 border-transparent', color.chip)}>
                <span className="line-clamp-2 whitespace-normal wrap-anywhere">{department}</span>
              </Badge>
            )}
            {task.status === 'in_progress' && <Badge tone="info">진행 중</Badge>}
          </div>
          {result && <p className="text-xs text-fg-secondary wrap-anywhere">{result}</p>}
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1 text-xs text-fg-muted">
            <span className="line-clamp-2 min-w-0 wrap-anywhere">
              {task.event?.name ?? COUNCIL_TASK_LABEL}
            </span>
            <span aria-hidden>·</span>
            <MyCardDue task={task} />
          </div>
        </div>
        <MyCardActions task={task} busy={busy} onFinish={onFinish} menu={menu} />
      </div>
      {error && (
        <p role="alert" className="relative mt-2 text-xs text-destructive wrap-anywhere">
          {error}
        </p>
      )}
    </li>
  )
}

function MyCardDue({ task }: Pick<Props, 'task'>) {
  const overdue = task.status !== 'done' && task.overdue
  return (
    <span
      className={cn('text-right tabular-nums', overdue && 'font-semibold text-danger-emphasis')}
    >
      {task.dueDate ? dayLabel(`${task.dueDate}T00:00:00+09:00`) : '마감 없음'}
    </span>
  )
}

function MyCardActions({
  task,
  busy,
  onFinish,
  menu,
}: Pick<Props, 'task' | 'busy' | 'onFinish' | 'menu'>) {
  return (
    <div className="relative z-10 flex shrink-0 items-center gap-1 self-center">
      {task.status !== 'done' && task.actions.includes('task.change_status') && onFinish && (
        <Button variant="outline" size="sm" touch busy={busy} onClick={onFinish}>
          끝내기
        </Button>
      )}
      <CardMenu task={task} busy={busy} menu={menu} variant="mine" />
    </div>
  )
}

// 보드의 업무 카드(와이어프레임 OPS-TASK-01·EVT-TASK-01): 흰 카드, 왼쪽 부서 색상선, 업무명, 부서 칩·지남 칩·담당자, 선 아래 마감과 결과물 그림.
// 부서 색은 소속, 빨강은 미완료 업무의 마감 지남과 실제 오류에만 쓴다(DEC-97). 카드에 행사 이름은 없다.
// 카드 전체가 누르는 곳이 되도록 제목 단추를 카드 크기로 늘리고, '⋯'만 그 위에 둔다.
// 1024px의 좁은 열에서 카드 높이가 늘지 않게 제목은 세 줄, 부서와 담당자는 한 줄에서 자르고 전체 글은 title에 둔다(화면 읽기 이름은 전체 글).
export function TaskCard(props: Props) {
  if (props.variant === 'mine') return <MyTaskCard {...props} />
  return <BoardTaskCard {...props} />
}

function BoardTaskCard({
  task,
  direct,
  color,
  busy,
  error,
  drag = NO_DRAG,
  hasResult,
  onOpen,
  menu,
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
          className="h-auto min-w-0 flex-1 justify-start p-0 text-left text-sm leading-tight font-bold whitespace-normal text-fg-body wrap-anywhere after:absolute after:inset-0 focus-visible:ring-0"
          title={task.title}
          onClick={onOpen}
        >
          <span className="line-clamp-3">{task.title}</span>
        </Button>
        <CardMenu task={task} busy={busy} menu={menu} />
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <Badge
          className={cn('max-w-full min-w-0 border-transparent', color.chip)}
          title={department}
        >
          <span className="truncate">{department}</span>
        </Badge>
        <div className="ml-auto flex max-w-full min-w-0 items-center gap-3 text-xs">
          {hasResult && (
            <FileText aria-label="결과물 있음" className="size-4 shrink-0 text-fg-faint" />
          )}
          <span
            className={cn(
              'flex shrink-0 items-center gap-1 whitespace-nowrap tabular-nums',
              overdue ? 'font-semibold text-danger-emphasis' : 'text-fg-muted',
            )}
          >
            <Calendar aria-hidden className="size-3.5" />
            {overdue ? `${dueLabel(task.dueDate)} · 지남` : dueLabel(task.dueDate)}
          </span>
          <AssigneeText task={task} direct={direct} />
        </div>
      </div>
      {error && (
        <p role="alert" className="mt-2 text-xs text-destructive wrap-anywhere">
          {error}
        </p>
      )}
    </li>
  )
}
