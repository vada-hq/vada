import { useState } from 'react'
import {
  type CouncilView,
  type EventSummary,
  type TaskFilter,
  type TaskLayout,
  type TaskView,
} from '@vada/contracts'
import PageColumn from '@/components/PageColumn'
import StateMessage from '@/components/StateMessage'
import { useEvents, type EventList } from '@/events/useEvents'
import { recalledDepartment } from '@/lib/menu-memory'
import { useSplit } from '@/lib/use-split'
import { useRecordDialogs } from '@/lib/use-record-dialogs'
import { useTeam } from '@/team/useTeam'
import { TaskBoard } from './TaskBoard'
import { cardMenuOf } from './task-card-menu'
import { TaskCalendarBody } from './TaskCalendarBody'
import { TaskListBody, type TableSetup } from './TaskListBody'
import { TaskQuickAdd } from './TaskQuickAdd'
import { NO_ASSIGNEE_LABEL } from './task-view'
import { TaskDeleteConfirm } from './TaskDeleteConfirm'
import { TaskPanel } from './TaskPanel'
import { TaskTabs } from './TaskTabs'
import { useStatusChange } from './useStatusChange'
import { useTaskControls } from './useTaskControls'
import { TaskUndoBar } from './TaskUndoBar'
import { useAssigneeUndo } from './useAssigneeUndo'
import { useBoardEmpty } from './useBoardEmpty'
import { useTaskAssign } from './useTaskAssign'
import { useTaskCells } from './useTaskCells'
import { useTaskOptions } from './useTaskOptions'
import { useTaskRemove } from './useTaskRemove'
import { useTasks, type TaskList } from './useTasks'
import { homeScopeActive, homeScopeLabel } from './home-task-scope'
import { useNarrowed } from './useNarrowedTasks'
import { useTaskOpeners } from './useTaskOpeners'

type Props = {
  view: CouncilView
  // 알림으로 연 업무. 있으면 그 업무의 상세를 열고 시작한다.
  initialTaskId?: string | undefined
  // 빠른 추가 칸에 초점을 두고 시작한다(행사 개요의 준비 단계 '업무 만들기').
  initialCreate?: boolean | undefined
  // 행사의 업무 탭이면 그 행사의 업무만 보이고, 빠른 추가는 그 행사로 만든다.
  eventId?: string | undefined
  // 행사 상세가 이미 읽은 일시. 목록 상한이나 재조회 지연 때문에 달력이 오늘 월로 돌아가지 않게 한다.
  calendarEvent?: Pick<EventSummary, 'id' | 'startsAt' | 'endsAt'> | undefined
  // 우리 학생회 공간은 같은 전체 업무 보드를 메뉴 대신 공간의 주소로 연다.
  councilSpace?: boolean | undefined
  // 권한이 바뀌었을 때(403) 학생회를 다시 읽게 한다. 운영진이 아니게 되었으면 학생회를 닫는다.
  onForbidden: () => void
  // 목록이 바뀌었을 때(옆 메뉴의 수를 다시 읽는다).
  onChanged: () => void
}

// 옆 메뉴 '업무': 탭 넷(내 업무, 내 부서, 전체, 담당자 없음), 거르기 둘(끝나지 않은 것, 끝남), 보드·표·달력. 탭을 바꾸면 이전 탭의 늦은 응답은 버린다.
// 넓은 화면의 기본은 상태 열 보드다(DEC-94). 좁은 화면과 표는 내 업무를 급한 순(지남·오늘·7일 안·나중·마감 없음), 전체와 담당자 없음을 부서 묶음에 진행 상황 수를 단다(요구 1, 14, 15, 20).
// 행사 화면의 업무 탭은 같은 화면을 그 행사로 좁힌 것이다.
// 달력과 넓은 화면의 보드는 끝난 업무도 함께 그린다. 그래서 그때만 끝난 업무를 더 읽는다. 행사와 이을 수 있는 행사는 달력과 표만 읽는다.
function useTaskLists(
  props: Props,
  {
    view,
    filter,
    layout,
    wide,
  }: { view: TaskView; filter: TaskFilter; layout: TaskLayout; wide: boolean },
) {
  const councilId = props.view.council.id
  const calendar = layout === 'calendar'
  const both = calendar || (layout === 'board' && wide)
  const table = wide && !props.eventId && layout === 'list'
  const eventId = props.eventId
  const list = useTasks(
    councilId,
    { view, filter: both ? 'open' : filter, eventId },
    props.onForbidden,
  )
  const done = useTasks(councilId, { view, filter: 'done', eventId }, props.onForbidden, both)
  // 표의 행사 칸이 고를 행사와 그 가운데 이을 수 있는 것도 읽는다(행사의 업무 탭은 행사 열이 없다).
  const events = useEvents(councilId, props.onForbidden, calendar || table)
  const options = useTaskOptions(councilId, undefined, props.onForbidden, table)
  const linkable = options.state.kind === 'ready' ? options.state.options.linkableEvents : null
  return { list, done, events, linkable, both }
}

// 행사의 업무 탭 달력에는 그 행사만 그린다. 학생회의 다른 행사는 업무 메뉴의 달력에 있다.
function onlyEvent(events: EventList, eventId: string | undefined): EventList {
  const { state } = events
  if (eventId === undefined || state.kind !== 'ready') return events
  const only = state.data.events.filter(event => event.id === eventId)
  return { ...events, state: { ...state, data: { ...state.data, events: only } } }
}

// 화면의 상태: 보기, 거르기, 목록·달력, 대화상자, 목록, 상태 바꾸기, 줄에서 맡기기와 그때 고를 사람들.
function useTasksPage(props: Props) {
  const councilId = props.view.council.id
  const inEvent = props.eventId !== undefined
  const controls = useTaskControls(
    councilId,
    props.eventId,
    props.view.me.memberId,
    props.councilSpace,
  )
  const { view, filter, layout, dept } = controls
  const dialogs = useRecordDialogs(props.initialTaskId)
  const opened = useTaskOpeners(councilId, inEvent)
  const wide = useSplit()
  const lists = useTaskLists(props, { view, filter, layout, wide })
  const list = useNarrowed(lists.list, dept, controls, props.view)
  const done = useNarrowed(lists.done, dept, controls, props.view)
  const events = onlyEvent(lists.events, props.eventId)
  const board = layout === 'board' && wide
  const councilEmpty = useBoardEmpty({
    councilId,
    eventId: props.eventId,
    view,
    board,
    raw: [lists.list, lists.done],
    shown: [list, done],
    onForbidden: props.onForbidden,
  })
  const reloaded = async () => {
    const reloads = [list.reload()]
    if (lists.both) reloads.push(done.reload())
    props.onChanged()
    await Promise.all(reloads)
  }
  const changed = () => {
    void reloaded()
  }
  const lost = (message: string) => {
    dialogs.lose(message)
    changed()
  }
  const change = useStatusChange(councilId, reloaded, props.onForbidden)
  const remove = useTaskRemove(councilId, changed, { onLost: lost, onForbidden: props.onForbidden })
  const undo = useAssigneeUndo(councilId, changed, props.onForbidden)
  const assign = useTaskAssign(councilId, changed, props.onForbidden, undo.note)
  const team = useTeam(councilId, props.onForbidden)
  const cells = useTaskCells(councilId, {
    onDone: changed,
    onForbidden: props.onForbidden,
    onLost: message => {
      dialogs.lose(message)
    },
    onAssigned: undo.note,
  })
  const eventList = events.state.kind === 'ready' ? events.state.data.events : null
  const lookups = { team: team.data, events: eventList, linkable: lists.linkable }
  const table: TableSetup = { wide, lookups, cells }
  const rows = {
    view,
    change,
    assign,
    team: team.data,
    inEvent,
    onOpenTask: opened.openTask,
    onOpenEvent: opened.openEvent,
  }
  return {
    controls,
    board,
    councilEmpty,
    departments: team.data?.departments ?? [],
    all: lists.list,
    openEventFromTask: opened.openEventFromTask,
    dialogs,
    list,
    done,
    events,
    eventId: props.eventId,
    calendarEvent: props.calendarEvent,
    changed,
    lost,
    remove,
    rows,
    table,
    undo,
  }
}

// 부서 거르기 칩의 이름: 내 부서, 홈이 알려 준 이름, 받아 온 업무의 부서 차례다.
function departmentName(id: string, council: CouncilView, all: TaskList) {
  const tasks = all.state.kind === 'ready' ? all.state.tasks : []
  return (
    council.me.departments.find(item => item.id === id)?.name ??
    recalledDepartment(id) ??
    tasks.find(task => task.department?.id === id)?.department?.name ??
    '부서'
  )
}

// 목록을 좁힌 조건을 풀 수 있게 알리는 칩: 업무 화면의 부서 거르기, 행사의 업무 탭에서 '담당자 없음'으로 연 보기.
function narrowOf(page: ReturnType<typeof useTasksPage>, council: CouncilView) {
  const { controls } = page
  if (homeScopeActive(controls)) {
    const tasks = page.all.state.kind === 'ready' ? page.all.state.tasks : []
    return { label: homeScopeLabel(controls, tasks), onClear: controls.clearNarrow }
  }
  if (controls.dept !== null) {
    const name = departmentName(controls.dept, council, page.all)
    return { label: name, onClear: controls.clearDept }
  }
  if (page.rows.inEvent && controls.view === 'unassigned')
    return { label: NO_ASSIGNEE_LABEL, onClear: () => controls.setView('all') }
  return undefined
}

// 보기나 부서로 좁혀 빈 보드의 문구. 거르기 전에도 업무가 없으면 보드의 빈 상태다(useBoardEmpty).
const VIEW_EMPTY: Record<TaskView, string> = {
  mine: '내 업무 없음',
  department: '내 부서 업무 없음',
  all: '업무 없음',
  unassigned: '담당자 없는 업무 없음',
}
const viewEmptyText = (view: TaskView, dept: string | null) =>
  dept === null ? VIEW_EMPTY[view] : '이 부서 업무 없음'

// 보드·표·달력 가운데 지금 배치의 몸통. 넓은 화면의 보드가 아니면 지금의 표(넓은 화면)와 줄(좁은 화면)이다.
function TasksBody({
  page,
  councilId,
  onAddFirst,
}: {
  page: ReturnType<typeof useTasksPage>
  councilId: string
  onAddFirst: (() => void) | undefined
}) {
  const { controls, list, rows, table } = page
  if (controls.layout === 'calendar')
    return (
      <TaskCalendarBody
        open={list}
        done={page.done}
        events={page.events}
        eventId={page.eventId}
        calendarEvent={page.calendarEvent}
        {...rows}
      />
    )
  if (page.board)
    return (
      <TaskBoard
        open={list}
        done={page.done}
        departments={page.departments}
        change={rows.change}
        onOpenTask={rows.onOpenTask}
        onShowDoneTable={controls.showDoneTable}
        councilEmpty={page.councilEmpty}
        emptyText={viewEmptyText(controls.view, controls.dept)}
        onAddFirst={onAddFirst}
        cardMenu={cardMenuOf(councilId, page.remove.ask)}
      />
    )
  return <TaskListBody list={list} table={table} filter={controls.filter} {...rows} />
}

// 빈 보드의 [첫 업무 추가]는 업무 추가 창(026 조각 9) 전까지 빠른 추가 칸에 초점을 둔다. 만들 수 있는 사람에게만 있다.
function useFirstAdd() {
  const [available, setAvailable] = useState(false)
  const [request, setRequest] = useState(0)
  return {
    request,
    onAvailable: setAvailable,
    onAddFirst: available ? () => setRequest(count => count + 1) : undefined,
  }
}

export default function TasksPage(props: Props) {
  const page = useTasksPage(props)
  const first = useFirstAdd()
  const { controls, dialogs, changed, rows } = page
  const { view, filter, layout } = controls
  // 빠른 추가는 보드나 표이고 끝나지 않은 업무를 볼 때만 있다. 넓은 화면의 보드는 거르기 없이 늘 끝나지 않은 업무를 담는다.
  const adding = layout !== 'calendar' && (page.board || filter === 'open')
  return (
    <PageColumn>
      {dialogs.lost && <StateMessage kind="error">{dialogs.lost}</StateMessage>}
      <TaskPanel
        view={props.view}
        taskId={dialogs.openId}
        onOpenEvent={page.openEventFromTask}
        onClose={dialogs.closeDetail}
        onChanged={changed}
        onForbidden={props.onForbidden}
        onLost={page.lost}
      />
      <TaskDeleteConfirm
        open={page.remove.open}
        busy={page.remove.busy}
        error={page.remove.error}
        onClose={page.remove.close}
        onConfirm={page.remove.confirm}
      />
      <TaskTabs
        showViews={!props.eventId}
        showFilter={layout !== 'calendar' && !page.board}
        hasDepartment={props.view.me.departments.length > 0}
        view={view}
        filter={filter}
        onView={controls.setView}
        onFilter={controls.setFilter}
        narrow={narrowOf(page, props.view)}
        layout={{ value: layout, onChange: controls.setLayout }}
      />
      {adding && (
        <TaskQuickAdd
          view={props.view}
          taskView={view}
          dept={controls.dept}
          eventId={props.eventId}
          autoFocus={props.initialCreate}
          focusRequest={first.request}
          onAvailable={first.onAvailable}
          onCreated={changed}
          onForbidden={props.onForbidden}
          onOpenTask={rows.onOpenTask}
        />
      )}
      <div role={props.eventId ? undefined : 'tabpanel'} className="flex flex-col gap-3">
        <TasksBody page={page} councilId={props.view.council.id} onAddFirst={first.onAddFirst} />
      </div>
      <TaskUndoBar {...page.undo} />
    </PageColumn>
  )
}
