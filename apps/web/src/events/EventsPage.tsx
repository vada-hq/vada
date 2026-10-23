import { useState } from 'react'
import { EVENT_LIST_LIMIT, type CouncilView } from '@vada/contracts'
import PageActions from '@/components/PageActions'
import PageColumn from '@/components/PageColumn'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { EVENTS_LOAD_FAILED } from '@/lib/messages'
import { useRecordDialogs } from '@/lib/use-record-dialogs'
import EventRow from './EventRow'
import { EventCreateDialog } from './EventCreateDialog'
import EventDetailView from './EventDetailView'
import { eventGroups, type EventTab } from './event-view'
import { useEvents, type EventList } from './useEvents'

type Props = {
  view: CouncilView
  // 업무에서 눌러 연 행사. 있으면 그 행사를 열고 시작한다.
  initialEventId?: string | undefined
  // 그 행사를 열 탭(홈에서 정산이 남은 행사는 '돈').
  initialTab?: EventTab | undefined
  // 권한이 바뀌었을 때(403) 학생회를 다시 읽게 한다.
  onForbidden: () => void
  // 행사의 업무가 바뀌었을 때(옆 메뉴의 업무 수를 다시 읽는다).
  onTasksChanged: () => void
}

function Cards({ list, onOpen }: { list: EventList; onOpen: (eventId: string) => void }) {
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
  if (events.length === 0) return <StateMessage kind="empty">아직 행사가 없어요.</StateMessage>
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

// 홈에서 정한 탭은 처음 연 그 행사에 한 번만 쓴다. 닫고 다시 열면 개요다.
function useFirstTab(eventId: string | undefined, tab: EventTab | undefined) {
  const [first, setFirst] = useState(tab)
  return {
    tabFor: (openId: string) => (openId === eventId ? first : undefined),
    consume: (then: () => void) => {
      setFirst(undefined)
      then()
    },
  }
}

// 옆 메뉴 '행사': 다가오는 행사, 날짜 미정, 지난 행사로 묶은 목록(순서는 서버가 정한다). 행사를 누르면 그 행사가 열린다.
export default function EventsPage({
  view,
  initialEventId,
  initialTab,
  onForbidden,
  onTasksChanged,
}: Props) {
  const dialogs = useRecordDialogs(initialEventId)
  const first = useFirstTab(initialEventId, initialTab)
  const list = useEvents(view.council.id, onForbidden)
  const lost = { onLost: dialogs.lose, onForbidden }
  if (dialogs.openId !== null)
    return (
      <PageColumn>
        <EventDetailView
          key={dialogs.openId}
          view={view}
          eventId={dialogs.openId}
          initialTab={first.tabFor(dialogs.openId)}
          onBack={() => first.consume(dialogs.closeDetail)}
          onChanged={() => void list.reload()}
          onTasksChanged={onTasksChanged}
          {...lost}
        />
      </PageColumn>
    )
  return (
    <PageColumn>
      {view.permissions.includes('event.create') && (
        <PageActions>
          <Button onClick={dialogs.startCreate}>행사 만들기</Button>
        </PageActions>
      )}
      {dialogs.lost && <StateMessage kind="error">{dialogs.lost}</StateMessage>}
      {dialogs.creating && (
        <EventCreateDialog
          view={view}
          onClose={dialogs.closeCreate}
          onDone={event => {
            dialogs.closeCreate()
            dialogs.openRecord(event.id)
            void list.reload()
          }}
          {...lost}
        />
      )}
      <Cards list={list} onOpen={dialogs.openRecord} />
    </PageColumn>
  )
}
