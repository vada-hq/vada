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

type RowProps = Pick<
  Props,
  'view' | 'change' | 'assign' | 'team' | 'onOpenTask' | 'onOpenEvent' | 'inEvent'
>

// 업무 한 줄을 그리는 함수. 목록과 달력 아래 목록이 같이 쓴다.
// 목록은 전체·내 부서·담당자 없음을 부서로 묶어 줄에 부서를 적지 않는다. 달력 아래 목록은 묶음이 없어 '내 부서' 밖에서는 적는다.
// 달력 아래 목록은 머리가 그날이라 마감도 적지 않는다.
export function taskRowOf(props: RowProps, calendar = false) {
  const { view, change, assign, team } = props
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
      busy={change.busy.has(task.id) || assign.busy.has(task.id)}
      error={change.errors[task.id] ?? assign.errors[task.id]}
      onChangeStatus={status => void change.change(task.id, status)}
      onOpen={() => props.onOpenTask(task.id)}
      onOpenEvent={props.onOpenEvent}
      assign={
        team && task.assignee === null && task.actions.includes('task.change_assignee')
          ? { team, onPick: id => void assign.assign(task.id, id) }
          : undefined
      }
    />
  )
}

function Ready({
  tasks,
  truncated,
  ...props
}: Props & { tasks: TaskSummary[]; truncated: boolean }) {
  const { view, filter } = props
  const [today] = useState(() => koreanDateOf(new Date()))
  return (
    <>
      <TaskSectionList
        sections={sectionsOf(tasks, view, filter, today)}
        summary={view !== 'mine' && filter === 'open'}
        row={taskRowOf(props)}
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
