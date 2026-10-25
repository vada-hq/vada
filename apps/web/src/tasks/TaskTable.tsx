import { Fragment, useRef } from 'react'
import type { TaskSummary } from '@vada/contracts'
import { cardClass } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { SummaryText } from './TaskSectionList'
import {
  COLUMN_LABEL,
  columnsOf,
  columnWidth,
  textFieldOf,
  type Column,
  type Lookups,
} from './task-table-cells'
import type { TaskSection } from './task-groups'
import { TaskTableCell } from './TaskTableCell'
import type { TaskCells } from './useTaskCells'
import { useGridNav } from './useGridNav'

type Props = {
  sections: TaskSection[]
  // 부서 묶음이면 머리에 진행 중·지남·담당자 없음 수를 적는다.
  summary: boolean
  inEvent: boolean
  lookups: Lookups
  cells: TaskCells
  onOpenTask: (taskId: string) => void
  onOpenEvent?: ((eventId: string) => void) | undefined
}

function GroupRow({
  section,
  summary,
  cols,
}: {
  section: TaskSection
  summary: boolean
  cols: number
}) {
  return (
    <tr role="row">
      <th
        colSpan={cols}
        scope="colgroup"
        role="rowheader"
        className="bg-gray-50 px-3 py-2 text-left"
      >
        <span className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <span
            className={cn(
              'text-sm font-semibold wrap-anywhere',
              section.key === 'overdue' ? 'text-red-600' : 'text-gray-900',
            )}
          >
            {section.title}
            <span className="ml-1.5 font-normal text-gray-500">{section.tasks.length}</span>
          </span>
          {summary && <SummaryText tasks={section.tasks} />}
        </span>
      </th>
    </tr>
  )
}

// 칸 오류는 그 줄 아래 한 줄이다. 초점이 닿는 칸이 아니라 표 이동에서 빠진다.
function ErrorRow({ message, cols }: { message: string; cols: number }) {
  return (
    <tr role="presentation">
      <td role="presentation" colSpan={cols} className="px-3 pb-2">
        <p role="alert" className="text-xs text-destructive wrap-anywhere">
          {message}
        </p>
      </td>
    </tr>
  )
}

type RowProps = Props & {
  task: TaskSummary
  columns: Column[]
  tabIndexOf: (id: string, col: number) => number
}

function TaskRows({ task, columns, tabIndexOf, ...props }: RowProps) {
  const error = props.cells.errors[task.id]
  return (
    <Fragment>
      <tr role="row" className="border-t">
        {columns.map((column, index) => (
          <TaskTableCell
            key={column}
            task={task}
            column={column}
            index={index}
            lookups={props.lookups}
            busy={props.cells.busy.has(`${task.id}|${textFieldOf(column) ?? column}`)}
            tabIndex={tabIndexOf(task.id, index)}
            onOpen={() => props.onOpenTask(task.id)}
            onOpenEvent={props.onOpenEvent}
            onSave={(field, value) => props.cells.save(task, field, value)}
            onInvalid={message => props.cells.fail(task.id, message)}
          />
        ))}
      </tr>
      {error && <ErrorRow message={error} cols={columns.length} />}
    </Fragment>
  )
}

// 넓은 화면의 업무 표(WAI-ARIA grid). 묶음은 표 안의 머리 줄이다.
export function TaskTable(props: Props) {
  const columns = columnsOf(props.inEvent)
  const ids = props.sections.flatMap(section => section.tasks.map(task => task.id))
  const gridRef = useRef<HTMLTableElement>(null)
  const nav = useGridNav(gridRef, ids, columns.length, props.onOpenTask)
  return (
    <div className={cn(cardClass, 'overflow-hidden')}>
      <table
        ref={gridRef}
        role="grid"
        aria-label="업무 표"
        className="w-full border-collapse text-left"
        onKeyDown={nav.onKeyDown}
        onFocus={nav.onFocus}
        onBlur={nav.onBlur}
      >
        <thead>
          <tr role="row">
            {columns.map(column => (
              <th
                key={column}
                role="columnheader"
                scope="col"
                className={cn('px-3 py-2 text-xs font-medium text-gray-500', columnWidth(column))}
              >
                {COLUMN_LABEL[column]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {props.sections.flatMap(section => [
            <GroupRow
              key={`group-${section.key}`}
              section={section}
              summary={props.summary}
              cols={columns.length}
            />,
            ...section.tasks.map(task => (
              <TaskRows
                key={task.id}
                {...props}
                task={task}
                columns={columns}
                tabIndexOf={nav.tabIndexOf}
              />
            )),
          ])}
        </tbody>
      </table>
    </div>
  )
}
