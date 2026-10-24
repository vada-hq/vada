import { useState } from 'react'
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
import type { useStatusChange } from './useStatusChange'
import type { useTaskAssign } from './useTaskAssign'
import type { TaskList } from './useTasks'

const EMPTY: Record<TaskFilter, string> = {
  open: '끝나지 않은 업무 없음',
  done: '끝난 업무 없음',
}
const overflow = (filter: TaskFilter) =>
  `업무가 많아 ${filter === 'open' ? TASK_OPEN_LIMIT : TASK_DONE_LIMIT}개만 보여요.`

type Props = {
  list: TaskList
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

function Ready({
  tasks,
  truncated,
  ...props
}: Props & { tasks: TaskSummary[]; truncated: boolean }) {
  const { view, filter, change, assign, team } = props
  const [today] = useState(() => koreanDateOf(new Date()))
  const show = { assignee: view !== 'mine', department: view === 'mine', event: !props.inEvent }
  return (
    <>
      <TaskSectionList
        sections={sectionsOf(tasks, view, filter, today)}
        summary={view !== 'mine' && filter === 'open'}
        row={task => (
          <TaskRow
            key={task.id}
            task={task}
            show={show}
            busy={change.busy.has(task.id) || assign.busy.has(task.id)}
            error={change.errors[task.id] ?? assign.errors[task.id]}
            onChangeStatus={status => void change.change(task.id, status)}
            onOpen={() => props.onOpenTask(task.id)}
            onOpenEvent={props.onOpenEvent}
            assign={
              team && task.assignee === null && task.actions.includes('task.assign')
                ? { team, onPick: id => void assign.assign(task.id, id) }
                : undefined
            }
          />
        )}
      />
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
