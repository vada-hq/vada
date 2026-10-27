import { useState } from 'react'
import { EVENT_LIST_LIMIT, menuPath, type CouncilView } from '@vada/contracts'
import type { RoomPage } from '../chat/ChatPage'
import PageActions from '@/components/PageActions'
import PageColumn from '@/components/PageColumn'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { navigate } from '@/lib/app-location'
import { openRecord } from '@/lib/go-to'
import { ADDRESS_LOST, EVENT_LOST, EVENTS_LOAD_FAILED } from '@/lib/messages'
import { useRecordDialogs } from '@/lib/use-record-dialogs'
import EventRow from './EventRow'
import { NewEventDialog } from './EventCreateDialog'
import EventDetailView from './EventDetailView'
import { canCreateEvent, eventGroups } from './event-view'
import { useEventAddress } from './useEventAddress'
import { useEvents, type EventList } from './useEvents'

type Props = {
  view: CouncilView
  // 권한이 바뀌었을 때(403) 학생회를 다시 읽게 한다.
  onForbidden: () => void
  // 행사의 업무가 바뀌었을 때(옆 메뉴의 업무 수를 다시 읽는다).
  onTasksChanged: () => void
  // 행사 메시지 탭의 방 화면이 쓰는 운영진과 대화 목록
  team: RoomPage['team']
  rooms: RoomPage['rooms']
}

// 빈 화면에서 첫 행사를 시작할 수 있어야 한다(DEC-96).
function NoEvents({ canCreate, onCreate }: { canCreate: boolean; onCreate: () => void }) {
  return (
    <Card className="flex flex-col items-center gap-3 p-6 text-center">
      <StateMessage kind="empty">행사 없음</StateMessage>
      {canCreate ? (
        <Button touch onClick={onCreate}>
          새 행사
        </Button>
      ) : (
        <p className="text-sm break-keep text-muted-foreground">회장단과 부서장이 만들어요</p>
      )}
    </Card>
  )
}

function Cards({
  list,
  view,
  onOpen,
  onCreate,
}: {
  list: EventList
  view: CouncilView
  onOpen: (eventId: string) => void
  onCreate: () => void
}) {
  const { state } = list
  if (state.kind === 'loading') return <StateMessage kind="loading">행사 불러오는 중…</StateMessage>
  if (state.kind === 'failed')
    return (
      <div className="flex flex-col gap-3">
        <StateMessage kind="error">{EVENTS_LOAD_FAILED}</StateMessage>
        <Button variant="outline" className="self-start" onClick={() => void list.reload()}>
          다시 시도
        </Button>
      </div>
    )
  const { events, truncated } = state.data
  if (events.length === 0) return <NoEvents canCreate={canCreateEvent(view)} onCreate={onCreate} />
  return (
    <>
      {eventGroups(events).map(group => (
        <section
          key={group.key}
          aria-labelledby={`events-${group.key}`}
          className="flex flex-col gap-2"
        >
          <h2 id={`events-${group.key}`} className="text-sm font-semibold text-gray-600">
            {group.title} <span className="font-normal text-gray-500">{group.events.length}</span>
          </h2>
          <Card className="overflow-hidden">
            <ul className="divide-y">
              {group.events.map(event => (
                <li key={event.id}>
                  <EventRow event={event} onOpen={() => onOpen(event.id)} />
                </li>
              ))}
            </ul>
          </Card>
        </section>
      ))}
      {truncated && (
        <StateMessage kind="notice">{`행사가 많아서 ${EVENT_LIST_LIMIT}개만 보여요.`}</StateMessage>
      )}
    </>
  )
}

// 행사를 볼 수 없을 때(없거나 다른 학생회 것이거나 권한을 잃음)는 있는지 없는지를 가르지 않고 같은 말을 한다.
// 권한이 바뀌어 잃었으면(찾을 수 없다는 말이 아닌 이유) 그 이유를 아래에 덧붙인다.
function NotFound({ councilId, reason }: { councilId: string; reason: string }) {
  return (
    <div className="flex flex-col items-start gap-3">
      <StateMessage kind="notice">{ADDRESS_LOST}</StateMessage>
      {reason !== EVENT_LOST && <StateMessage kind="error">{reason}</StateMessage>}
      <Button
        variant="outline"
        onClick={() => navigate(menuPath('events', councilId), { replace: true })}
      >
        행사 목록
      </Button>
    </div>
  )
}

// 열린 행사(주소가 정한다). 뒤로는 들어온 곳이고, 탭은 주소의 쿼리다.
function OpenEvent({
  view,
  open,
  onForbidden,
  onChanged,
  onTasksChanged,
  team,
  rooms,
}: Pick<Props, 'view' | 'onForbidden' | 'onTasksChanged' | 'team' | 'rooms'> & {
  open: NonNullable<ReturnType<typeof useEventAddress>>
  onChanged: () => void
}) {
  const [gone, setGone] = useState<{ id: string; reason: string } | null>(null)
  if (gone?.id === open.eventId)
    return <NotFound councilId={view.council.id} reason={gone.reason} />
  return (
    <EventDetailView
      key={open.eventId}
      view={view}
      eventId={open.eventId}
      tab={open.tab}
      room={open.room}
      onRoom={open.setRoom}
      team={team}
      rooms={rooms}
      from={open.from}
      onTab={open.setTab}
      onChanged={onChanged}
      onTasksChanged={onTasksChanged}
      onLost={reason => setGone({ id: open.eventId, reason })}
      onForbidden={onForbidden}
    />
  )
}

// 옆 메뉴 '행사': 다가오는 행사, 날짜 미정, 지난 행사로 묶은 목록(순서는 서버가 정한다). 행사를 누르면 그 행사의 주소로 열린다.
export default function EventsPage({ view, onForbidden, onTasksChanged, team, rooms }: Props) {
  const councilId = view.council.id
  const open = useEventAddress(councilId, view.me.memberId)
  const dialogs = useRecordDialogs()
  const list = useEvents(councilId, onForbidden)
  const lost = { onLost: dialogs.lose, onForbidden }
  if (open)
    return (
      <PageColumn>
        <OpenEvent
          view={view}
          open={open}
          onForbidden={onForbidden}
          onChanged={() => void list.reload()}
          onTasksChanged={onTasksChanged}
          team={team}
          rooms={rooms}
        />
      </PageColumn>
    )
  return (
    <PageColumn>
      {canCreateEvent(view) &&
        !(list.state.kind === 'ready' && list.state.data.events.length === 0) && (
          <PageActions>
            <Button onClick={dialogs.startCreate}>새 행사</Button>
          </PageActions>
        )}
      {dialogs.lost && <StateMessage kind="error">{dialogs.lost}</StateMessage>}
      {dialogs.creating && (
        <NewEventDialog
          view={view}
          onClose={dialogs.closeCreate}
          onMade={() => void list.reload()}
          {...lost}
        />
      )}
      <Cards
        list={list}
        view={view}
        onCreate={dialogs.startCreate}
        onOpen={id => openRecord('events', councilId, id)}
      />
    </PageColumn>
  )
}
