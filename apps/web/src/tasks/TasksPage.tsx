import { useState } from 'react'
import type { CouncilView, TaskFilter, TaskView } from '@vada/contracts'
import PageActions from '@/components/PageActions'
import PageColumn from '@/components/PageColumn'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import { useEvents } from '@/events/useEvents'
import { useRecordDialogs } from '@/lib/use-record-dialogs'
import { useTeam } from '@/team/useTeam'
import { TaskCalendarBody } from './TaskCalendarBody'
import { TaskDialogs } from './TaskDialogs'
import { TaskListBody } from './TaskListBody'
import { TaskTabs, type TaskLayout } from './TaskTabs'
import { useStatusChange } from './useStatusChange'
import { useTaskAssign } from './useTaskAssign'
import { useTasks } from './useTasks'

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

// 만들기 버튼과, 열려 있던 업무를 잃었을 때의 이유. 업무 화면에서는 버튼을 머리글 오른쪽(PageActions)에 두고,
// 행사의 업무 탭에서는 그 탭 안에 둔다(머리글은 행사 화면 전체의 것이다).
function CreateRow({
  inEvent,
  lost,
  onCreate,
}: {
  inEvent: boolean
  lost: string | null
  onCreate: () => void
}) {
  const button = (
    <Button className="self-start" onClick={onCreate}>
      업무 만들기
    </Button>
  )
  return (
    <>
      {inEvent ? button : <PageActions>{button}</PageActions>}
      {lost && <StateMessage kind="error">{lost}</StateMessage>}
    </>
  )
}

// 옆 메뉴 '업무': 탭 넷(내 업무, 내 부서, 전체, 담당자 없음), 거르기 둘(끝나지 않은 것, 끝남), 목록·달력. 탭을 바꾸면 이전 탭의 늦은 응답은 버린다.
// 내 업무는 급한 순(지남·오늘·7일 안·나중·마감 없음), 전체와 담당자 없음은 부서 묶음에 진행 상황 수를 단다(요구 1, 14, 15, 20).
// 행사 화면의 업무 탭은 같은 화면을 그 행사로 좁힌 것이다.
// 달력은 끝난 업무와 행사도 함께 그린다. 그래서 달력일 때만 끝난 업무와 행사를 더 읽는다.
function useTaskLists(props: Props, view: TaskView, filter: TaskFilter, layout: TaskLayout) {
  const councilId = props.view.council.id
  const calendar = layout === 'calendar'
  const eventId = props.eventId
  const list = useTasks(
    councilId,
    { view, filter: calendar ? 'open' : filter, eventId },
    props.onForbidden,
  )
  const done = useTasks(councilId, { view, filter: 'done', eventId }, props.onForbidden, calendar)
  const events = useEvents(councilId, props.onForbidden, calendar)
  return { list, done, events }
}

// 화면의 상태: 보기, 거르기, 목록·달력, 대화상자, 목록, 상태 바꾸기, 줄에서 맡기기와 그때 고를 사람들.
function useTasksPage(props: Props) {
  const [view, setView] = useState<TaskView>(props.eventId ? 'all' : 'mine')
  const [filter, setFilter] = useState<TaskFilter>('open')
  const [layout, setLayout] = useState<TaskLayout>('list')
  const dialogs = useRecordDialogs(props.initialTaskId, props.initialCreate)
  const councilId = props.view.council.id
  const { list, done, events } = useTaskLists(props, view, filter, layout)
  const changed = () => {
    void list.reload()
    if (layout === 'calendar') void done.reload()
    props.onChanged()
  }
  const change = useStatusChange(councilId, changed, props.onForbidden)
  const assign = useTaskAssign(councilId, changed, props.onForbidden)
  const team = useTeam(councilId, props.onForbidden)
  const rows = {
    view,
    change,
    assign,
    team: team.data,
    inEvent: props.eventId !== undefined,
    onOpenTask: dialogs.openRecord,
    onOpenEvent: props.onOpenEvent,
  }
  return {
    view,
    setView,
    filter,
    setFilter,
    layout,
    setLayout,
    dialogs,
    list,
    done,
    events,
    changed,
    rows,
  }
}

export default function TasksPage(props: Props) {
  const page = useTasksPage(props)
  const { view, filter, layout, dialogs, list, changed, rows } = page
  return (
    <PageColumn>
      {!props.eventId && (
        <CreateRow inEvent={false} lost={dialogs.lost} onCreate={dialogs.startCreate} />
      )}
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
        hasDepartment={props.view.me.departments.length > 0}
        start={
          props.eventId && <CreateRow inEvent lost={dialogs.lost} onCreate={dialogs.startCreate} />
        }
        view={view}
        filter={filter}
        onView={page.setView}
        onFilter={page.setFilter}
        layout={props.eventId ? undefined : { value: layout, onChange: page.setLayout }}
      />
      <div role={props.eventId ? undefined : 'tabpanel'} className="flex flex-col gap-3">
        {layout === 'calendar' ? (
          <TaskCalendarBody open={list} done={page.done} events={page.events} {...rows} />
        ) : (
          <TaskListBody list={list} filter={filter} {...rows} />
        )}
      </div>
    </PageColumn>
  )
}
