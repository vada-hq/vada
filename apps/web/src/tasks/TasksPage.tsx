import { useState } from 'react'
import {
  TASK_DONE_LIMIT,
  TASK_OPEN_LIMIT,
  type TaskFilter,
  type TaskSummary,
  type TaskView,
} from '@vada/contracts'
import PageColumn from '@/components/PageColumn'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import { TabButton } from '@/components/ui/tab-button'
import { TASKS_LOAD_FAILED } from '@/lib/messages'
import TaskCard from './TaskCard'
import TaskGroups from './TaskGroups'
import { useStatusChange } from './useStatusChange'
import { useTasks, type TaskList } from './useTasks'

const TABS: { view: TaskView; label: string }[] = [
  { view: 'mine', label: '내 업무' },
  { view: 'all', label: '전체' },
  { view: 'unassigned', label: '담당자 없음' },
]
const FILTERS: { filter: TaskFilter; label: string }[] = [
  { filter: 'open', label: '끝나지 않은 것' },
  { filter: 'done', label: '끝남' },
]

const EMPTY: Record<TaskFilter, string> = {
  open: '끝나지 않은 업무가 없어요.',
  done: '끝난 업무가 없어요.',
}
const overflow = (filter: TaskFilter) =>
  `업무가 많아서 ${filter === 'open' ? TASK_OPEN_LIMIT : TASK_DONE_LIMIT}개만 보여요.`

type Props = {
  councilId: string
  // 권한이 바뀌었을 때(403) 학생회를 다시 읽게 한다. 운영진이 아니게 되었으면 학생회를 닫는다.
  onForbidden: () => void
  // 목록이 바뀌었을 때(옆 메뉴의 수를 다시 읽는다).
  onChanged: () => void
  // 카드를 눌러 상세를 여는 자리(조각 6).
  onOpenTask?: ((taskId: string) => void) | undefined
}

type Change = ReturnType<typeof useStatusChange>

function Cards({
  tasks,
  view,
  change,
  onOpenTask,
}: {
  tasks: TaskSummary[]
  view: TaskView
  change: Change
  onOpenTask: Props['onOpenTask']
}) {
  const card = (task: TaskSummary, headingLevel: 'h2' | 'h3') => (
    <TaskCard
      key={task.id}
      task={task}
      headingLevel={headingLevel}
      busy={change.busy.has(task.id)}
      error={change.errors[task.id]}
      onChangeStatus={status => void change.change(task.id, status)}
      onOpen={onOpenTask ? () => onOpenTask(task.id) : undefined}
    />
  )
  if (view !== 'mine') return <TaskGroups tasks={tasks} card={task => card(task, 'h3')} />
  return (
    <ul className="flex flex-col gap-2">
      {tasks.map(task => (
        <li key={task.id}>{card(task, 'h2')}</li>
      ))}
    </ul>
  )
}

function Body({
  list,
  view,
  filter,
  change,
  onOpenTask,
}: {
  list: TaskList
  view: TaskView
  filter: TaskFilter
  change: Change
  onOpenTask: Props['onOpenTask']
}) {
  const { state } = list
  if (state.kind === 'loading') return <StateMessage kind="loading">업무 불러오는 중…</StateMessage>
  if (state.kind === 'failed')
    return (
      <div className="flex flex-col gap-3">
        <StateMessage kind="error">{TASKS_LOAD_FAILED}</StateMessage>
        <Button variant="outline" className="self-start" onClick={() => void list.reload()}>
          다시 시도
        </Button>
      </div>
    )
  if (state.tasks.length === 0) return <StateMessage kind="empty">{EMPTY[filter]}</StateMessage>
  return (
    <>
      <Cards tasks={state.tasks} view={view} change={change} onOpenTask={onOpenTask} />
      {state.truncated && <StateMessage kind="notice">{overflow(filter)}</StateMessage>}
    </>
  )
}

// 옆 메뉴 '업무': 탭 셋(내 업무, 전체, 담당자 없음)과 거르기 둘(끝나지 않은 것, 끝남). 탭을 바꾸면 이전 탭의 늦은 응답은 버린다.
export default function TasksPage(props: Props) {
  const [view, setView] = useState<TaskView>('mine')
  const [filter, setFilter] = useState<TaskFilter>('open')
  const list = useTasks(props.councilId, { view, filter }, props.onForbidden)
  const change = useStatusChange(
    props.councilId,
    () => {
      void list.reload()
      props.onChanged()
    },
    props.onForbidden,
  )
  return (
    <PageColumn>
      <div role="tablist" aria-label="업무 보기" className="flex overflow-x-auto border-b">
        {TABS.map(tab => (
          <TabButton
            key={tab.view}
            aria-selected={view === tab.view}
            onClick={() => setView(tab.view)}
          >
            {tab.label}
          </TabButton>
        ))}
      </div>
      <div role="group" aria-label="업무 거르기" className="flex gap-2">
        {FILTERS.map(item => (
          <Button
            key={item.filter}
            size="sm"
            variant={filter === item.filter ? 'secondary' : 'outline'}
            aria-pressed={filter === item.filter}
            onClick={() => setFilter(item.filter)}
          >
            {item.label}
          </Button>
        ))}
      </div>
      <div role="tabpanel" className="flex flex-col gap-3">
        <Body
          list={list}
          view={view}
          filter={filter}
          change={change}
          onOpenTask={props.onOpenTask}
        />
      </div>
    </PageColumn>
  )
}
