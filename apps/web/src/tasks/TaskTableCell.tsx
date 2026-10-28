import type { ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import type { TaskSummary } from '@vada/contracts'
import { NativeSelect } from '@/components/ui/native-select'
import { cn } from '@/lib/utils'
import { choiceValue } from './task-form-options'
import {
  cellChoices,
  cellValue,
  COLUMN_LABEL,
  columnWidth,
  isCellField,
  isEditable,
  type CellField,
  type Column,
  type Lookups,
} from './task-table-cells'
import { COUNCIL_TASK_LABEL, NO_EVENT_LABEL, STATUS_LABEL } from './task-view'
import { TaskAssigneeName, type TaskDirect } from './TaskAssigneeName'
import { TaskEventLink } from './TaskEventLink'
import { DueCell, TitleCell } from './TaskTextCells'
import type { SaveField } from './useTaskCells'

export type CellProps = {
  task: TaskSummary
  direct?: TaskDirect | undefined
  column: Column
  index: number
  lookups: Lookups
  busy: boolean
  tabIndex: number
  onOpen: () => void
  onOpenEvent?: ((eventId: string) => void) | undefined
  onSave: (field: SaveField, value: string) => Promise<boolean>
  onInvalid: (message: string) => void
}

const selectClass = 'h-8 w-auto py-1 sm:text-xs'
// 행사 이름처럼 긴 값은 선택칸 안에서만 줄인다.
const eventSelectClass = 'max-w-32'
const muted = 'text-xs text-gray-500 wrap-anywhere'

// 고칠 수 없는 칸의 글자
function Plain({
  task,
  field,
  onOpenEvent,
  direct,
}: Pick<CellProps, 'task' | 'onOpenEvent' | 'direct'> & { field: CellField }) {
  if (field === 'status') return <span className={muted}>{STATUS_LABEL[task.status]}</span>
  if (field === 'assignee')
    return (
      <span className={cn(muted, task.assignee === null && 'text-yellow-700')}>
        <TaskAssigneeName assignee={task.assignee} direct={direct} tabIndex={-1} />
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
  if (!choices)
    return <Plain task={task} field={field} onOpenEvent={props.onOpenEvent} direct={props.direct} />
  const separate = field === 'assignee' && props.direct !== undefined
  const select = (
    <NativeSelect
      aria-label={`${task.title} ${COLUMN_LABEL[props.column]}`}
      aria-busy={busy || undefined}
      tabIndex={-1}
      className={cn(
        selectClass,
        field === 'event' && eventSelectClass,
        busy && 'opacity-45',
        separate && 'absolute inset-0 h-full w-full cursor-pointer opacity-0',
      )}
      value={cellValue(task, field)}
      onChange={event => {
        // 보내는 동안은 값을 바꾸지 않는다(제어되는 값이라 다시 원래대로 돌아간다).
        if (!busy && event.target.value !== cellValue(task, field))
          void props.onSave(field, event.target.value)
      }}
    >
      {choices.map(item => (
        <option key={choiceValue(item.id)} value={choiceValue(item.id)}>
          {item.label}
        </option>
      ))}
    </NativeSelect>
  )
  if (!separate) return select
  return (
    <div className="flex min-w-0 items-center gap-1">
      <Plain task={task} field={field} direct={props.direct} />
      <span className="relative inline-flex size-8 shrink-0 items-center justify-center rounded-md border focus-within:ring-2 focus-within:ring-ring/50 max-sm:size-11">
        <ChevronDown aria-hidden className="size-4 text-muted-foreground" />
        {select}
      </span>
    </div>
  )
}

function Content(props: CellProps): ReactNode {
  const { task, column } = props
  const text = {
    task,
    editable: isEditable(task, column, props.lookups),
    busy: props.busy,
    onOpen: props.onOpen,
    onSave: props.onSave,
    onInvalid: props.onInvalid,
  }
  if (column === 'title') return <TitleCell {...text} />
  if (column === 'due') return <DueCell {...text} />
  return isCellField(column) ? <Pick props={props} field={column} /> : null
}

// 표의 칸 하나. 초점은 칸에 서고(roving tabindex), 안의 단추·선택칸은 Tab 순서에 없다.
// 고칠 수 있는 칸은 선택칸이나 글 칸(제목, 마감)이고, 나머지는 글자라 aria-readonly다.
export function TaskTableCell(props: CellProps) {
  const { task, column, lookups } = props
  const editable = isEditable(task, column, lookups)
  return (
    <td
      role="gridcell"
      data-row={task.id}
      data-col={props.index}
      tabIndex={props.tabIndex}
      aria-readonly={editable ? undefined : true}
      className={cn(
        'px-2 py-2 align-middle focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none focus-visible:ring-inset',
        columnWidth(column),
      )}
    >
      <Content {...props} />
    </td>
  )
}
