import { useEffect, useState } from 'react'
import {
  koreanDateOf,
  TASK_DONE_LIMIT,
  TASK_OPEN_LIMIT,
  type TaskFilter,
  type TaskSummary,
  type TaskView,
  type TeamResponse,
} from '@vada/contracts'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import { TASKS_LOAD_FAILED } from '@/lib/messages'
import { byDue, groupByDepartment, groupByDue, type TaskSection } from './task-groups'
import { TaskRow } from './TaskRow'
import { TaskSectionList } from './TaskSectionList'
import { TaskTable } from './TaskTable'
import type { Lookups } from './task-table-cells'
import type { TaskCells } from './useTaskCells'
import type { useStatusChange } from './useStatusChange'
import type { useTaskAssign } from './useTaskAssign'
import type { TaskList } from './useTasks'

const EMPTY: Record<TaskFilter, string> = {
  open: '끝나지 않은 업무 없음',
  done: '끝난 업무 없음',
}
const overflow = (filter: TaskFilter) =>
  `업무가 많아 ${filter === 'open' ? TASK_OPEN_LIMIT : TASK_DONE_LIMIT}개만 보여요.`

// 넓은 화면(lg 이상)이면 표로 그리고, 칸에서 고른다. 좁으면 지금의 줄이다.
export type TableSetup = { wide: boolean; lookups: Lookups; cells: TaskCells }

type Props = {
  list: TaskList
  table: TableSetup
  view: TaskView
  filter: TaskFilter
  change: ReturnType<typeof useStatusChange>
  assign: ReturnType<typeof useTaskAssign>
  team: TeamResponse | null
  onOpenTask: (taskId: string) => void
  onOpenEvent?: ((eventId: string) => void) | undefined
  // 행사의 업무 탭이면 참
  inEvent: boolean
}

// 내 업무(끝나지 않은 것)는 급한 순 묶음, 그 밖은 부서 묶음이다. 끝난 업무는 한 묶음이다.
function sectionsOf(tasks: TaskSummary[], view: TaskView, filter: TaskFilter, today: string) {
  if (filter === 'done') {
    if (view !== 'mine') return groupByDepartment(tasks)
    return [{ key: 'done', title: '끝남', tasks: [...tasks].sort(byDue) }] satisfies TaskSection[]
  }
  return view === 'mine' ? groupByDue(tasks, today) : groupByDepartment(tasks)
}

type RowProps = Pick<
  Props,
  'view' | 'change' | 'assign' | 'team' | 'onOpenTask' | 'onOpenEvent' | 'inEvent'
>
type ReadOnlyRowProps = Pick<RowProps, 'view' | 'onOpenTask' | 'onOpenEvent' | 'inEvent'> & {
  readOnly: true
}

function rowAssignment(task: TaskSummary, editing: RowProps) {
  const { team, assign } = editing
  if (!team || task.assignee !== null || !task.actions.includes('task.change_assignee'))
    return undefined
  return {
    team,
    onPick: (id: string) => {
      const name = team.members.find(member => member.id === id)?.name ?? ''
      void assign.assign(task, id, name)
    },
  }
}

function rowActions(task: TaskSummary, editing: RowProps | null) {
  if (!editing) return { busy: false }
  const { change, assign } = editing
  return {
    busy: change.busy.has(task.id) || assign.busy.has(task.id),
    error: change.errors[task.id] ?? assign.errors[task.id],
    onChangeStatus: (status: Parameters<typeof change.change>[1]) =>
      void change.change(task.id, status),
    assign: rowAssignment(task, editing),
  }
}

// 업무 한 줄을 그리는 함수. 목록과 달력 아래 목록이 같이 쓴다.
// 목록은 전체·내 부서·담당자 없음을 부서로 묶어 줄에 부서를 적지 않는다. 달력 아래 목록은 묶음이 없어 '내 부서' 밖에서는 적는다.
// 달력 아래 목록은 머리가 그날이라 마감도 적지 않는다.
export function taskRowOf(props: RowProps | ReadOnlyRowProps, calendar = false) {
  const { view } = props
  const editing = 'readOnly' in props ? null : props
  const show = {
    assignee: view !== 'mine',
    department: view === 'mine' || (calendar && view !== 'department'),
    event: !props.inEvent,
    due: !calendar,
  }
  return (task: TaskSummary) => (
    <TaskRow
      key={task.id}
      task={task}
      show={show}
      {...rowActions(task, editing)}
      onOpen={() => props.onOpenTask(task.id)}
      onOpenEvent={props.onOpenEvent}
    />
  )
}

function Ready({
  tasks,
  truncated,
  ...props
}: Props & { tasks: TaskSummary[]; truncated: boolean }) {
  const { view, filter, table } = props
  const [today] = useState(() => koreanDateOf(new Date()))
  // 고른 칸의 응답으로 줄을 먼저 바꿔 두고, 다시 읽은 목록이 오면 그 목록을 따른다.
  const { patches, clearPatches } = table.cells
  const shown = tasks.map(task => patches[task.id] ?? task)
  useEffect(clearPatches, [tasks, clearPatches])
  const sections = sectionsOf(shown, view, filter, today)
  const summary = view !== 'mine' && filter === 'open'
  return (
    <>
      {table.wide ? (
        <TaskTable
          sections={sections}
          summary={summary}
          inEvent={props.inEvent}
          lookups={table.lookups}
          cells={table.cells}
          onOpenTask={props.onOpenTask}
          onOpenEvent={props.onOpenEvent}
        />
      ) : (
        <TaskSectionList sections={sections} summary={summary} row={taskRowOf(props)} />
      )}
      {truncated && <StateMessage kind="notice">{overflow(filter)}</StateMessage>}
    </>
  )
}

// 업무 목록의 읽는 중, 실패, 빈 목록과 목록.
export function TaskListBody(props: Props) {
  const { state } = props.list
  if (state.kind === 'loading') return <StateMessage kind="loading">업무 불러오는 중…</StateMessage>
  if (state.kind === 'failed')
    return (
      <div className="flex flex-col gap-3">
        <StateMessage kind="error">{TASKS_LOAD_FAILED}</StateMessage>
        <Button variant="outline" className="self-start" onClick={() => void props.list.reload()}>
          다시 시도
        </Button>
      </div>
    )
  if (state.tasks.length === 0)
    return <StateMessage kind="empty">{EMPTY[props.filter]}</StateMessage>
  return <Ready {...props} tasks={state.tasks} truncated={state.truncated} />
}
