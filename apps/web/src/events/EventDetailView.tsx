import { useState, type ReactNode } from 'react'
import { ChevronLeft } from 'lucide-react'
import { menuPath, type CouncilView, type EventDetail } from '@vada/contracts'
import StateMessage from '@/components/StateMessage'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { TabButton } from '@/components/ui/tab-button'
import { leave } from '@/lib/app-location'
import { openRecord } from '@/lib/go-to'
import { EVENT_COMPLETED_NOTICE, EVENT_LOAD_FAILED } from '@/lib/messages'
import { RegistrationTab } from '../registrations/RegistrationTab'
import TasksPage from '../tasks/TasksPage'
import { backLabel } from './event-back'
import type { EventTab } from './event-view'
import { EventHeader, type EventEditing } from './EventHeader'
import type { EventFieldFocus } from './EventFields'
import { EventMoneyTab } from './EventMoneyTab'
import { EventOverview } from './EventOverview'
import type { EventDialogHandlers } from './useEventSubmit'
import { useEventDetail } from './useEventDetail'

type Tab = EventTab
// 탭 이름과 차례는 와이어프레임 EVT-02(DEC-93): 재정이 인원 관리 앞이다. 주소 값(money, registrations)은 그대로다.
const TABS: { tab: Tab; label: string }[] = [
  { tab: 'overview', label: '개요' },
  { tab: 'tasks', label: '업무' },
  { tab: 'money', label: '재정' },
  { tab: 'registrations', label: '인원 관리' },
]

type Props = EventDialogHandlers & {
  view: CouncilView
  eventId: string
  // 열린 탭. 주소의 쿼리가 원문이라 새로고침해도 같다.
  tab: Tab
  onTab: (tab: Tab) => void
  // 들어온 곳의 주소. 뒤로 버튼의 이름이 된다.
  from: string | null
  // 내 변경이 목록에 닿았다(행사 목록을 다시 읽는다).
  onChanged: () => void
  // 행사의 업무가 바뀌었다(옆 메뉴의 업무 수를 다시 읽는다).
  onTasksChanged: () => void
}

function EventTabs({ tab, onTab }: { tab: Tab; onTab: (tab: Tab) => void }) {
  return (
    <div role="tablist" aria-label="행사 보기" className="flex border-b">
      {TABS.map(item => (
        <TabButton key={item.tab} aria-selected={tab === item.tab} onClick={() => onTab(item.tab)}>
          {item.label}
        </TabButton>
      ))}
    </div>
  )
}

// 업무 탭으로 넘겨 여는 것(개요의 업무 만들기, 담당자 없음 보기)과 머리의 고치기. 넘긴 것은 탭을 직접 바꾸면 버린다.
// moneyRefresh는 머리의 완료·완료 취소(와 그 거절)가 바꾼 정산을 재정 탭이 다시 읽게 하는 번호다.
type TaskLink = { create?: boolean; view?: 'unassigned' }
function useDetailState(onTab: (tab: Tab) => void) {
  const [taskLink, setTaskLink] = useState<TaskLink>({})
  const [editing, setEditing] = useState<EventEditing | null>(null)
  const [moneyRefresh, setMoneyRefresh] = useState(0)
  return {
    taskLink,
    editing,
    setEditing,
    moneyRefresh,
    refreshMoney: () => setMoneyRefresh(value => value + 1),
    moveTo: (next: Tab) => {
      setTaskLink({})
      onTab(next)
    },
    openTasks: (link: TaskLink) => {
      setTaskLink(link)
      onTab('tasks')
    },
  }
}

// 행사 하나: 머리(이름 줄, 탭, 요약 줄)와 탭 넷(개요, 업무, 재정, 인원 관리)의 내용. 업무 탭은 업무 화면을 그 행사로 좁혀 보인다.
// 행사를 읽기 전에는 머리에 탭만 보인다.
export default function EventDetailView({ view, eventId, tab, onTab, from, ...props }: Props) {
  const state = useDetailState(onTab)
  const detail = useEventDetail(view.council.id, eventId, {
    onLost: props.onLost,
    onForbidden: props.onForbidden,
  })
  const event = detail.state.kind === 'ready' ? detail.state.data.event : null
  return (
    <div className="flex flex-col gap-4">
      <Button
        variant="ghost"
        size="sm"
        className="-ml-3 self-start"
        onClick={() => leave(menuPath('events', view.council.id))}
      >
        <ChevronLeft aria-hidden />
        {backLabel(from)}
      </Button>
      <EventHeader
        councilId={view.council.id}
        event={event}
        editing={state.editing}
        onEdit={state.setEditing}
        onLost={props.onLost}
        onForbidden={props.onForbidden}
        onChanged={next => {
          detail.replace(next)
          state.refreshMoney()
          props.onChanged()
        }}
        onStale={() => {
          void detail.reload()
          state.refreshMoney()
        }}
        tabs={<EventTabs tab={tab} onTab={state.moveTo} />}
      />
      {event?.status === 'completed' && <Alert tone="info">{EVENT_COMPLETED_NOTICE}</Alert>}
      <EventPanel
        tab={tab}
        view={view}
        eventId={eventId}
        detail={detail}
        taskLink={state.taskLink}
        moneyRefresh={state.moneyRefresh}
        onTab={state.moveTo}
        onOpenTasks={state.openTasks}
        onEdit={focus => state.setEditing({ focus })}
        {...props}
      />
    </div>
  )
}

type PanelProps = Omit<Props, 'from' | 'onTab'> & {
  tab: Tab
  detail: ReturnType<typeof useEventDetail>
  taskLink: TaskLink
  moneyRefresh: number
  onTab: (tab: Tab) => void
  onOpenTasks: (link: TaskLink) => void
  onEdit: (focus: EventFieldFocus) => void
}

// 탭 하나의 내용. 개요, 업무, 재정, 인원 관리.
function EventPanel({ tab, view, eventId, detail, ...props }: PanelProps) {
  const handlers = { onLost: props.onLost, onForbidden: props.onForbidden }
  return (
    <div role="tabpanel" className="flex flex-col gap-3">
      {tab === 'tasks' ? (
        <TasksPage
          view={view}
          eventId={eventId}
          initialView={props.taskLink.view}
          initialCreate={props.taskLink.create}
          onForbidden={props.onForbidden}
          onChanged={() => {
            props.onTasksChanged()
            void detail.reload()
          }}
        />
      ) : tab === 'registrations' ? (
        <RegistrationTab
          view={view}
          eventId={eventId}
          event={detail.state.kind === 'ready' ? detail.state.data.event : null}
          onEditEvent={props.onEdit}
          {...handlers}
        />
      ) : tab === 'money' ? (
        <Loaded detail={detail}>
          {loaded => (
            <EventMoneyTab
              view={view}
              event={loaded}
              refresh={props.moneyRefresh}
              reloadEvent={detail.reload}
              {...handlers}
            />
          )}
        </Loaded>
      ) : (
        <OverviewPanel councilId={view.council.id} detail={detail} {...props} />
      )}
    </div>
  )
}

// 개요 탭. 개요에서 누른 업무와 업무 만들기는 업무 탭으로, 일시 넣기는 머리의 고치기로 넘긴다.
function OverviewPanel({
  councilId,
  detail,
  ...props
}: Pick<PanelProps, 'onTab' | 'onOpenTasks' | 'onEdit' | 'onLost' | 'onForbidden'> & {
  councilId: string
  detail: ReturnType<typeof useEventDetail>
}) {
  return (
    <Loaded detail={detail}>
      {loaded => (
        <EventOverview
          councilId={councilId}
          event={loaded}
          onTab={props.onTab}
          onOpenTask={taskId => openRecord('tasks', councilId, taskId)}
          onOpenUnassigned={() => props.onOpenTasks({ view: 'unassigned' })}
          onCreateTask={() => props.onOpenTasks({ create: true })}
          onEdit={props.onEdit}
          onLost={props.onLost}
          onForbidden={props.onForbidden}
        />
      )}
    </Loaded>
  )
}

// 행사를 읽는 동안과 읽지 못했을 때의 자리. 읽으면 탭 내용을 그린다.
function Loaded({
  detail,
  children,
}: {
  detail: ReturnType<typeof useEventDetail>
  children: (event: EventDetail) => ReactNode
}) {
  const { state } = detail
  if (state.kind === 'loading') return <StateMessage kind="loading">불러오는 중이에요</StateMessage>
  if (state.kind === 'failed')
    return (
      <div className="flex flex-col items-start gap-3">
        <StateMessage kind="error">{EVENT_LOAD_FAILED}</StateMessage>
        <Button variant="outline" onClick={() => void detail.reload()}>
          다시 시도
        </Button>
      </div>
    )
  return children(state.data.event)
}
