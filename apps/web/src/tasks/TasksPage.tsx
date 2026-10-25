import { useMemo } from 'react'
import type { CouncilView, TaskFilter, TaskLayout, TaskView } from '@vada/contracts'
import PageColumn from '@/components/PageColumn'
import StateMessage from '@/components/StateMessage'
import { useEvents } from '@/events/useEvents'
import { openRecord } from '@/lib/go-to'
import { recalledDepartment } from '@/lib/menu-memory'
import { useSplit } from '@/lib/use-split'
import { useRecordDialogs } from '@/lib/use-record-dialogs'
import { useTeam } from '@/team/useTeam'
import { TaskCalendarBody } from './TaskCalendarBody'
import { TaskDialogs } from './TaskDialogs'
import { TaskListBody, type TableSetup } from './TaskListBody'
import { TaskQuickAdd } from './TaskQuickAdd'
import { NO_ASSIGNEE_LABEL } from './task-view'
import { TaskTabs } from './TaskTabs'
import { useStatusChange } from './useStatusChange'
import { useTaskControls } from './useTaskControls'
import { TaskUndoBar } from './TaskUndoBar'
import { useAssigneeUndo } from './useAssigneeUndo'
import { useTaskAssign } from './useTaskAssign'
import { useTaskCells } from './useTaskCells'
import { useTaskOptions } from './useTaskOptions'
import { useTasks, type TaskList } from './useTasks'

type Props = {
  view: CouncilView
  // 알림으로 연 업무. 있으면 그 업무의 상세를 열고 시작한다.
  initialTaskId?: string | undefined
  // 빠른 추가 칸에 초점을 두고 시작한다(행사 개요의 준비 단계 '업무 만들기').
  initialCreate?: boolean | undefined
  // 행사의 업무 탭이면 그 행사의 업무만 보이고, 빠른 추가는 그 행사로 만든다.
  eventId?: string | undefined
  // 권한이 바뀌었을 때(403) 학생회를 다시 읽게 한다. 운영진이 아니게 되었으면 학생회를 닫는다.
  onForbidden: () => void
  // 목록이 바뀌었을 때(옆 메뉴의 수를 다시 읽는다).
  onChanged: () => void
}

// 옆 메뉴 '업무': 탭 넷(내 업무, 내 부서, 전체, 담당자 없음), 거르기 둘(끝나지 않은 것, 끝남), 목록·달력. 탭을 바꾸면 이전 탭의 늦은 응답은 버린다.
// 내 업무는 급한 순(지남·오늘·7일 안·나중·마감 없음), 전체와 담당자 없음은 부서 묶음에 진행 상황 수를 단다(요구 1, 14, 15, 20).
// 행사 화면의 업무 탭은 같은 화면을 그 행사로 좁힌 것이다.
// 달력은 끝난 업무와 행사도 함께 그린다. 그래서 달력일 때만 끝난 업무와 행사를 더 읽는다.
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
  const eventId = props.eventId
  const list = useTasks(
    councilId,
    { view, filter: calendar ? 'open' : filter, eventId },
    props.onForbidden,
  )
  const done = useTasks(councilId, { view, filter: 'done', eventId }, props.onForbidden, calendar)
  // 표의 행사 칸이 고를 행사와 그 가운데 이을 수 있는 것도 읽는다(행사의 업무 탭은 행사 열이 없다).
  const events = useEvents(councilId, props.onForbidden, calendar || (wide && !eventId))
  const options = useTaskOptions(councilId, undefined, props.onForbidden, wide && !eventId)
  const linkable = options.state.kind === 'ready' ? options.state.options.linkableEvents : null
  return { list, done, events, linkable }
}

// 부서를 고른 보기는 그 부서의 업무만 남긴다(홈의 부서 줄이 연다).
// 새 배열이 렌더마다 만들어지면 표가 목록이 바뀐 줄로 알고 고른 값을 지우므로, 읽은 목록이 바뀔 때만 다시 만든다.
function useNarrowed(list: TaskList, department: string | null): TaskList {
  const { state, reload } = list
  return useMemo(() => {
    if (department === null || state.kind !== 'ready') return { state, reload }
    const tasks = state.tasks.filter(task => task.department?.id === department)
    return { reload, state: { ...state, tasks } }
  }, [state, reload, department])
}

// 연 업무와 행사는 주소로 연다(닫으면 들어온 곳으로 돌아간다). 행사의 업무 탭에서 연 업무도 업무 주소라 닫으면 그 행사의 탭이다.
// 행사의 업무 탭은 이미 그 행사 안이라 행사 이름으로 가는 길이 없다.
function useOpeners(councilId: string, inEvent: boolean) {
  const openTask = (taskId: string) => openRecord('tasks', councilId, taskId)
  if (inEvent) return { openTask, openEvent: undefined, openEventFromTask: undefined }
  return {
    openTask,
    openEvent: (eventId: string) => openRecord('events', councilId, eventId),
    // 업무 상세 창에서 가면 그 상세 위에 쌓아, 행사에서 뒤로가 그 업무 상세다.
    openEventFromTask: (eventId: string) =>
      openRecord('events', councilId, eventId, { overRecord: true }),
  }
}

// 화면의 상태: 보기, 거르기, 목록·달력, 대화상자, 목록, 상태 바꾸기, 줄에서 맡기기와 그때 고를 사람들.
function useTasksPage(props: Props) {
  const councilId = props.view.council.id
  const inEvent = props.eventId !== undefined
  const controls = useTaskControls(councilId, props.eventId)
  const { view, filter, layout, dept } = controls
  const dialogs = useRecordDialogs(props.initialTaskId)
  const opened = useOpeners(councilId, inEvent)
  const wide = useSplit()
  const lists = useTaskLists(props, { view, filter, layout, wide })
  const list = useNarrowed(lists.list, dept)
  const done = useNarrowed(lists.done, dept)
  const events = lists.events
  const changed = () => {
    void list.reload()
    if (layout === 'calendar') void done.reload()
    props.onChanged()
  }
  const change = useStatusChange(councilId, changed, props.onForbidden)
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
    all: lists.list,
    openEventFromTask: opened.openEventFromTask,
    dialogs,
    list,
    done,
    events,
    changed,
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
  if (controls.dept !== null) {
    const name = departmentName(controls.dept, council, page.all)
    return { label: name, onClear: controls.clearDept }
  }
  if (page.rows.inEvent && controls.view === 'unassigned')
    return { label: NO_ASSIGNEE_LABEL, onClear: () => controls.setView('all') }
  return undefined
}

export default function TasksPage(props: Props) {
  const page = useTasksPage(props)
  const { controls, dialogs, list, changed, rows, table } = page
  const { view, filter, layout } = controls
  return (
    <PageColumn>
      {dialogs.lost && <StateMessage kind="error">{dialogs.lost}</StateMessage>}
      <TaskDialogs
        view={props.view}
        openId={dialogs.openId}
        onOpenEvent={page.openEventFromTask}
        onCloseDetail={dialogs.closeDetail}
        onChanged={changed}
        onForbidden={props.onForbidden}
        onLost={message => {
          dialogs.lose(message)
          changed()
        }}
      />
      <TaskTabs
        showViews={!props.eventId}
        hasDepartment={props.view.me.departments.length > 0}
        view={view}
        filter={filter}
        onView={controls.setView}
        onFilter={controls.setFilter}
        narrow={narrowOf(page, props.view)}
        layout={props.eventId ? undefined : { value: layout, onChange: controls.setLayout }}
      />
      {layout === 'list' && filter === 'open' && (
        <TaskQuickAdd
          view={props.view}
          taskView={view}
          dept={controls.dept}
          eventId={props.eventId}
          autoFocus={props.initialCreate}
          onCreated={changed}
          onForbidden={props.onForbidden}
          onOpenTask={rows.onOpenTask}
        />
      )}
      <div role={props.eventId ? undefined : 'tabpanel'} className="flex flex-col gap-3">
        {layout === 'calendar' ? (
          <TaskCalendarBody open={list} done={page.done} events={page.events} {...rows} />
        ) : (
          <TaskListBody list={list} table={table} filter={filter} {...rows} />
        )}
      </div>
      <TaskUndoBar {...page.undo} />
    </PageColumn>
  )
}
