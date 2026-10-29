import { useState, type ReactNode } from 'react'
import { ChevronLeft } from 'lucide-react'
import { menuPath, type CouncilView, type EventDetail } from '@vada/contracts'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import { CountBadge } from '@/components/ui/count-badge'
import { TabButton } from '@/components/ui/tab-button'
import { leave } from '@/lib/app-location'
import { openEventTasks, openRecord } from '@/lib/go-to'
import { EVENT_LOAD_FAILED } from '@/lib/messages'
import { withTaskLayout } from '@/lib/task-layout'
import type { RoomPage } from '../chat/ChatPage'
import RoomSwitch from '../chat/RoomSwitch'
import { shownRoomOf, unreadSum } from '../chat/space-rooms'
import SpaceMessages from '../chat/SpaceMessages'
import { useEventRooms, type EventRooms } from '../chat/useEventRooms'
import { EventMeetings } from '../meetings/EventMeetings'
import { RegistrationTab } from '../registrations/RegistrationTab'
import TasksPage from '../tasks/TasksPage'
import { backLabel } from './event-back'
import type { EventTab } from './event-view'
import { EventHeader, type EventEditing } from './EventHeader'
import type { EventFieldFocus } from './EventFields'
import { EventMoneyTab } from './EventMoneyTab'
import { EventOverview } from './EventOverview'
import { announceEventsChanged } from './events-changed'
import type { EventDialogHandlers } from './useEventSubmit'
import { useEventDetail } from './useEventDetail'

type Tab = EventTab
// 탭 이름과 차례는 와이어프레임 EVT-02(DEC-93): 구매가 인원 관리 앞이다. 주소 값(money, registrations)은 그대로다.
// 메시지가 맨 앞이고 기본 탭이다(DEC-90, 와이어프레임 EVT-MSG-01, 022 정한 것 28). 회의는 업무 다음이다(EVT-MEET-01, 029).
// 와이어프레임의 일정·문서 탭은 아직 그릴 내용이 없어 두지 않는다.
const TABS: { tab: Tab; label: string }[] = [
  { tab: 'messages', label: '메시지' },
  { tab: 'overview', label: '개요' },
  { tab: 'tasks', label: '업무' },
  { tab: 'meetings', label: '회의' },
  { tab: 'money', label: '구매' },
  { tab: 'registrations', label: '인원 관리' },
]

type Props = EventDialogHandlers & {
  view: CouncilView
  eventId: string
  // 열린 탭. 주소의 쿼리가 원문이라 새로고침해도 같다.
  tab: Tab
  onTab: (tab: Tab) => void
  // 메시지 탭에서 고른 방(주소의 쿼리). 없으면 처음 여는 방이다.
  room: string | null
  onRoom: (roomId: string) => void
  // 메시지 탭의 방 화면이 쓰는 운영진과 대화 목록(옆 메뉴 배지를 같이 맞춘다)
  team: RoomPage['team']
  rooms: RoomPage['rooms']
  // 들어온 곳의 주소. 뒤로 버튼의 이름이 된다.
  from: string | null
  // 내 변경이 목록에 닿았다(행사 목록을 다시 읽는다).
  onChanged: () => void
  // 행사의 업무가 바뀌었다(옆 메뉴의 업무 수를 다시 읽는다).
  onTasksChanged: () => void
}

const tabLabelOf = (tab: Tab) => TABS.find(item => item.tab === tab)?.label ?? ''

// 메시지 탭 옆 배지는 그 행사 방들의 안 읽은 수 합이다(DEC-90). 휴대폰 폭에서 여섯 탭이 넘치지 않게 좌우 여백을 줄인다.
function EventTabs({
  tab,
  unread,
  onTab,
}: {
  tab: Tab
  unread: number
  onTab: (tab: Tab) => void
}) {
  return (
    <div role="tablist" aria-label="행사 보기" className="flex border-b">
      {TABS.map(item => (
        <TabButton
          key={item.tab}
          aria-selected={tab === item.tab}
          className="gap-1.5 max-sm:px-2.5"
          onClick={() => onTab(item.tab)}
        >
          {item.label}
          {item.tab === 'messages' && (
            <CountBadge count={unread} label={`안 읽은 메시지 ${unread}개`} />
          )}
        </TabButton>
      ))}
    </div>
  )
}

// 업무 탭으로 넘겨 여는 것(개요의 업무 만들기)과 머리의 고치기. 넘긴 것은 탭을 직접 바꾸면 버린다.
// 개요의 담당자 없음 보기는 거르기라 주소로 연다(openEventTasks).
// moneyRefresh는 머리의 완료·완료 취소(와 그 거절)가 바꾼 정산을 구매 탭이 다시 읽게 하는 번호다.
type TaskLink = { create?: boolean }
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

// 행사 하나: 머리(이름 줄, 탭, 요약 줄)와 탭(메시지, 개요, 업무, 회의, 구매, 인원 관리)의 내용. 업무 탭은 업무 화면을 그 행사로 좁혀 보인다.
// 행사를 읽기 전에는 머리에 탭만 보인다.
export default function EventDetailView({ view, eventId, tab, onTab, from, ...props }: Props) {
  const state = useDetailState(onTab)
  const eventRooms = useEventRooms(view.council.id, eventId, props.onForbidden)
  const roomList = eventRooms.state.kind === 'ready' ? eventRooms.state.data.rooms : []
  const shownRoom = shownRoomOf(roomList, props.room)
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
        {backLabel(from, eventId)}
      </Button>
      <EventHeader
        councilId={view.council.id}
        event={event}
        editing={state.editing}
        onEdit={state.setEditing}
        onLost={props.onLost}
        onForbidden={props.onForbidden}
        // 이름과 완료는 옆 메뉴의 행사 줄에도 보인다.
        onChanged={next => {
          detail.replace(next)
          state.refreshMoney()
          void eventRooms.reload()
          void props.rooms.reload()
          props.onChanged()
          announceEventsChanged()
        }}
        onStale={() => {
          void detail.reload()
          state.refreshMoney()
          void eventRooms.reload()
          void props.rooms.reload()
        }}
        tabs={<EventTabs tab={tab} unread={unreadSum(roomList)} onTab={state.moveTo} />}
        tabLabel={tabLabelOf(tab)}
        bar={
          tab === 'messages' ? (
            <RoomSwitch rooms={roomList} activeId={shownRoom?.id ?? null} onPick={props.onRoom} />
          ) : undefined
        }
      />
      <EventPanel
        tab={tab}
        view={view}
        eventId={eventId}
        detail={detail}
        eventRooms={eventRooms}
        shownRoomId={shownRoom?.id ?? null}
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

type PanelProps = Omit<Props, 'from' | 'onTab' | 'room' | 'onRoom'> & {
  tab: Tab
  detail: ReturnType<typeof useEventDetail>
  eventRooms: EventRooms
  shownRoomId: string | null
  taskLink: TaskLink
  moneyRefresh: number
  onTab: (tab: Tab) => void
  onOpenTasks: (link: TaskLink) => void
  onEdit: (focus: EventFieldFocus) => void
}

// 탭 하나의 내용. 메시지, 개요, 업무, 회의, 구매, 인원 관리.
function EventPanel({ tab, view, eventId, detail, ...props }: PanelProps) {
  const handlers = { onLost: props.onLost, onForbidden: props.onForbidden }
  const councilId = view.council.id
  return (
    <div role="tabpanel" className="flex flex-col gap-3">
      {tab === 'messages' ? (
        <SpaceMessages
          page={{
            councilId,
            view,
            team: props.team,
            rooms: props.rooms,
            onForbidden: props.onForbidden,
            onOpenRequest: id => openRecord('purchases', councilId, id),
          }}
          source={props.eventRooms}
          roomId={props.shownRoomId}
        />
      ) : tab === 'tasks' ? (
        <TasksPage
          view={view}
          eventId={eventId}
          calendarEvent={detail.state.kind === 'ready' ? detail.state.data.event : undefined}
          initialCreate={props.taskLink.create}
          onForbidden={props.onForbidden}
          onChanged={() => {
            props.onTasksChanged()
            void detail.reload()
          }}
        />
      ) : tab === 'meetings' ? (
        <EventMeetings councilId={councilId} eventId={eventId} onForbidden={props.onForbidden} />
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
        <OverviewPanel
          councilId={view.council.id}
          memberId={view.me.memberId}
          detail={detail}
          {...props}
        />
      )}
    </div>
  )
}

// 개요 탭. 개요에서 누른 업무와 업무 만들기는 업무 탭으로, 일시 넣기는 머리의 고치기로 넘긴다.
// 업무 탭으로 가는 링크에는 그 사람이 마지막에 고른 업무 배치를 싣는다(lib/task-layout.ts).
function OverviewPanel({
  councilId,
  memberId,
  detail,
  ...props
}: Pick<PanelProps, 'onTab' | 'onOpenTasks' | 'onEdit' | 'onLost' | 'onForbidden'> & {
  councilId: string
  memberId: string
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
          onOpenUnassigned={() =>
            openEventTasks(councilId, loaded.id, withTaskLayout(memberId, { view: 'unassigned' }))
          }
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
