import { useState } from 'react'
import {
  TASK_DONE_LIMIT,
  TASK_OPEN_LIMIT,
  type CouncilView,
  type TaskFilter,
  type TaskSummary,
  type TaskView,
} from '@vada/contracts'
import PageColumn from '@/components/PageColumn'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import { TASKS_LOAD_FAILED } from '@/lib/messages'
import TaskCard from './TaskCard'
import { TaskDialogs } from './TaskDialogs'
import { TaskTabs } from './TaskTabs'
import { useRecordDialogs } from '@/lib/use-record-dialogs'
import TaskGroups from './TaskGroups'
import { useStatusChange } from './useStatusChange'
import { useTasks, type TaskList } from './useTasks'

const EMPTY: Record<TaskFilter, string> = {
  open: '끝나지 않은 업무가 없어요.',
  done: '끝난 업무가 없어요.',
}
const overflow = (filter: TaskFilter) =>
  `업무가 많아서 ${filter === 'open' ? TASK_OPEN_LIMIT : TASK_DONE_LIMIT}개만 보여요.`

type Props = {
  view: CouncilView
  // 알림으로 연 업무. 있으면 그 업무의 상세를 열고 시작한다.
  initialTaskId?: string | undefined
  // 만들기가 열린 채 시작한다(행사 개요의 준비 단계 '업무 만들기').
  initialCreate?: boolean | undefined
  // 행사의 업무 탭이면 그 행사의 업무만 보이고, 만들기는 그 행사가 골라진 채 열린다.
  eventId?: string | undefined
  // 업무의 행사 이름을 눌렀다(행사 화면으로 간다). 행사의 업무 탭에서는 주지 않는다.
  onOpenEvent?: ((eventId: string) => void) | undefined
  // 권한이 바뀌었을 때(403) 학생회를 다시 읽게 한다. 운영진이 아니게 되었으면 학생회를 닫는다.
  onForbidden: () => void
  // 목록이 바뀌었을 때(옆 메뉴의 수를 다시 읽는다).
  onChanged: () => void
}

type Change = ReturnType<typeof useStatusChange>

function Cards({
  tasks,
  view,
  change,
  onOpenTask,
  onOpenEvent,
}: {
  tasks: TaskSummary[]
  view: TaskView
  change: Change
  onOpenTask: (taskId: string) => void
  onOpenEvent: Props['onOpenEvent']
}) {
  const card = (task: TaskSummary, headingLevel: 'h2' | 'h3') => (
    <TaskCard
      key={task.id}
      task={task}
      headingLevel={headingLevel}
      busy={change.busy.has(task.id)}
      error={change.errors[task.id]}
      onChangeStatus={status => void change.change(task.id, status)}
      onOpen={() => onOpenTask(task.id)}
      onOpenEvent={onOpenEvent}
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
  onOpenEvent,
}: {
  list: TaskList
  view: TaskView
  filter: TaskFilter
  change: Change
  onOpenTask: (taskId: string) => void
  onOpenEvent: Props['onOpenEvent']
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
      <Cards
        tasks={state.tasks}
        view={view}
        change={change}
        onOpenTask={onOpenTask}
        onOpenEvent={onOpenEvent}
      />
      {state.truncated && <StateMessage kind="notice">{overflow(filter)}</StateMessage>}
    </>
  )
}

// 만들기 버튼과, 열려 있던 업무를 잃었을 때의 이유(좁은 화면에서도 버튼 바로 옆에 보인다).
function CreateRow({ lost, onCreate }: { lost: string | null; onCreate: () => void }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button onClick={onCreate}>업무 만들기</Button>
      {lost && <StateMessage kind="error">{lost}</StateMessage>}
    </div>
  )
}

// 옆 메뉴 '업무': 탭 셋(내 업무, 전체, 담당자 없음)과 거르기 둘(끝나지 않은 것, 끝남). 탭을 바꾸면 이전 탭의 늦은 응답은 버린다.
// 행사 화면의 업무 탭은 같은 화면을 그 행사로 좁힌 것이다.
export default function TasksPage(props: Props) {
  const [view, setView] = useState<TaskView>(props.eventId ? 'all' : 'mine')
  const [filter, setFilter] = useState<TaskFilter>('open')
  const dialogs = useRecordDialogs(props.initialTaskId, props.initialCreate)
  const councilId = props.view.council.id
  const list = useTasks(councilId, { view, filter, eventId: props.eventId }, props.onForbidden)
  const changed = () => {
    void list.reload()
    props.onChanged()
  }
  const change = useStatusChange(councilId, changed, props.onForbidden)
  return (
    <PageColumn>
      <CreateRow lost={dialogs.lost} onCreate={dialogs.startCreate} />
      <TaskDialogs
        view={props.view}
        openId={dialogs.openId}
        creating={dialogs.creating}
        eventId={props.eventId}
        onOpenEvent={props.onOpenEvent}
        onCloseDetail={dialogs.closeDetail}
        onCloseCreate={dialogs.closeCreate}
        onChanged={changed}
        onForbidden={props.onForbidden}
        onLost={message => {
          dialogs.lose(message)
          changed()
        }}
      />
      <TaskTabs
        showViews={!props.eventId}
        view={view}
        filter={filter}
        onView={setView}
        onFilter={setFilter}
      />
      <div role={props.eventId ? undefined : 'tabpanel'} className="flex flex-col gap-3">
        <Body
          list={list}
          view={view}
          filter={filter}
          change={change}
          onOpenTask={dialogs.openRecord}
          onOpenEvent={props.onOpenEvent}
        />
      </div>
    </PageColumn>
  )
}
