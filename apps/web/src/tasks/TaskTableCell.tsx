import type { ReactNode } from 'react'
import type { TaskSummary } from '@vada/contracts'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { NativeSelect } from '@/components/ui/native-select'
import { cn } from '@/lib/utils'
import { choiceValue } from './task-form-options'
import {
  cellChoices,
  cellValue,
  COLUMN_LABEL,
  isCellField,
  type CellField,
  type Column,
  type Lookups,
} from './task-table-cells'
import {
  assigneeLabel,
  COUNCIL_TASK_LABEL,
  dueLabel,
  NO_EVENT_LABEL,
  STATUS_LABEL,
} from './task-view'
import { TaskEventLink } from './TaskEventLink'

export type CellProps = {
  task: TaskSummary
  column: Column
  index: number
  lookups: Lookups
  busy: boolean
  tabIndex: number
  onOpen: () => void
  onOpenEvent?: ((eventId: string) => void) | undefined
  onPick: (field: CellField, value: string) => void
}

const selectClass = 'h-8 w-full py-1 sm:text-xs'
const muted = 'text-xs text-gray-500 wrap-anywhere'

function Title({ task, onOpen }: Pick<CellProps, 'task' | 'onOpen'>) {
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
      <Button
        variant="link"
        tabIndex={-1}
        className="h-auto min-w-0 justify-start p-0 text-left text-sm font-medium whitespace-normal text-gray-900 wrap-anywhere"
        onClick={onOpen}
      >
        {task.title}
      </Button>
      {task.status === 'in_progress' && <Badge tone="info">진행 중</Badge>}
    </div>
  )
}

// 고칠 수 없는 칸의 글자
function Plain({
  task,
  field,
  onOpenEvent,
}: Pick<CellProps, 'task' | 'onOpenEvent'> & { field: CellField }) {
  if (field === 'status') return <span className={muted}>{STATUS_LABEL[task.status]}</span>
  if (field === 'assignee')
    return (
      <span className={cn(muted, task.assignee === null && 'text-yellow-700')}>
        {assigneeLabel(task.assignee)}
      </span>
    )
  if (field === 'department')
    return <span className={muted}>{task.department?.name ?? COUNCIL_TASK_LABEL}</span>
  if (!task.event) return <span className={muted}>{NO_EVENT_LABEL}</span>
  return <TaskEventLink event={task.event} onOpen={onOpenEvent} tabIndex={-1} className="text-xs" />
}

function Pick({ props, field }: { props: CellProps; field: CellField }) {
  const { task, lookups, busy } = props
  const choices = cellChoices(task, field, lookups)
  if (!choices) return <Plain task={task} field={field} onOpenEvent={props.onOpenEvent} />
  return (
    <NativeSelect
      aria-label={`${task.title} ${COLUMN_LABEL[props.column]}`}
      aria-busy={busy || undefined}
      tabIndex={-1}
      className={cn(selectClass, busy && 'opacity-45')}
      value={cellValue(task, field)}
      onChange={event => {
        // 보내는 동안은 값을 바꾸지 않는다(제어되는 값이라 다시 원래대로 돌아간다).
        if (!busy && event.target.value !== cellValue(task, field))
          props.onPick(field, event.target.value)
      }}
    >
      {choices.map(item => (
        <option key={choiceValue(item.id)} value={choiceValue(item.id)}>
          {item.label}
        </option>
      ))}
    </NativeSelect>
  )
}

function Content(props: CellProps): ReactNode {
  const { task, column } = props
  if (column === 'title') return <Title task={task} onOpen={props.onOpen} />
  if (column === 'due')
    return (
      <span className={cn(muted, task.overdue && 'font-medium text-red-600')}>
        {dueLabel(task.dueDate)}
      </span>
    )
  return isCellField(column) ? <Pick props={props} field={column} /> : null
}

// 표의 칸 하나. 초점은 칸에 서고(roving tabindex), 안의 단추·선택칸은 Tab 순서에 없다.
// 고칠 수 있는 칸은 선택칸이고, 나머지는 글자라 aria-readonly다. 제목과 마감은 이 조각에서 늘 글자다.
export function TaskTableCell(props: CellProps) {
  const { task, column, lookups } = props
  const editable = isCellField(column) && cellChoices(task, column, lookups) !== null
  return (
    <td
      role="gridcell"
      data-row={task.id}
      data-col={props.index}
      tabIndex={props.tabIndex}
      aria-readonly={editable ? undefined : true}
      className="px-3 py-2 align-middle focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none focus-visible:ring-inset"
    >
      <Content {...props} />
    </td>
  )
}
