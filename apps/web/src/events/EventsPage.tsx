import { useState } from 'react'
import { CalendarDays } from 'lucide-react'
import { EVENT_LIST_LIMIT, menuPath, type CouncilView } from '@vada/contracts'
import { EmptyState } from '@/components/EmptyState'
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
}

// 빈 목록: 무엇이 여기에 오는지와 첫 행사를 어떻게 만드는지 말한다(NN/g, 빈 화면).
function NoEvents({ canCreate }: { canCreate: boolean }) {
  return (
    <Card>
      <EmptyState
        icon={CalendarDays}
        title="아직 행사가 없어요"
        description={
          canCreate
            ? "오른쪽 위 '새 행사'로 첫 행사를 만들어 보세요. 이름만 넣으면 돼요."
            : '회장단과 부서장이 행사를 만들면 여기에 보여요.'
        }
      />
    </Card>
  )
}

function Cards({
  list,
  view,
  onOpen,
}: {
  list: EventList
  view: CouncilView
  onOpen: (eventId: string) => void
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
  if (events.length === 0) return <NoEvents canCreate={canCreateEvent(view)} />
  return (
    <>
      {eventGroups(events).map(group => (
        <section
          key={group.key}
          aria-labelledby={`events-${group.key}`}
          className="flex flex-col gap-2"
        >
          <h2 id={`events-${group.key}`} className="text-sm font-semibold text-gray-600">
            {group.title} <span className="font-normal text-gray-400">{group.events.length}</span>
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
}: Pick<Props, 'view' | 'onForbidden' | 'onTasksChanged'> & {
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
export default function EventsPage({ view, onForbidden, onTasksChanged }: Props) {
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
        />
      </PageColumn>
    )
  return (
    <PageColumn>
      {canCreateEvent(view) && (
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
      <Cards list={list} view={view} onOpen={id => openRecord('events', councilId, id)} />
    </PageColumn>
  )
}
