import { EVENT_LIST_LIMIT, type CouncilView } from '@vada/contracts'
import PageColumn from '@/components/PageColumn'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import { EVENTS_LOAD_FAILED } from '@/lib/messages'
import { useRecordDialogs } from '@/lib/use-record-dialogs'
import EventCard from './EventCard'
import { EventCreateDialog } from './EventCreateDialog'
import EventDetailView from './EventDetailView'
import type { EventTab } from './event-view'
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
      <ul className="flex flex-col gap-2">
        {events.map(event => (
          <li key={event.id}>
            <EventCard event={event} onOpen={() => onOpen(event.id)} />
          </li>
        ))}
      </ul>
      {truncated && (
        <StateMessage kind="notice">{`행사가 많아서 ${EVENT_LIST_LIMIT}개만 보여요.`}</StateMessage>
      )}
    </>
  )
}

// 옆 메뉴 '행사': 진행 중 → 예정 → 날짜 미정 → 끝남 순서의 목록(서버가 센다). 행사를 누르면 그 행사가 열린다.
export default function EventsPage({
  view,
  initialEventId,
  initialTab,
  onForbidden,
  onTasksChanged,
}: Props) {
  const dialogs = useRecordDialogs(initialEventId)
  const list = useEvents(view.council.id, onForbidden)
  const lost = { onLost: dialogs.lose, onForbidden }
  if (dialogs.openId !== null)
    return (
      <PageColumn>
        <EventDetailView
          key={dialogs.openId}
          view={view}
          eventId={dialogs.openId}
          initialTab={dialogs.openId === initialEventId ? initialTab : undefined}
          onBack={dialogs.closeDetail}
          onChanged={() => void list.reload()}
          onTasksChanged={onTasksChanged}
          {...lost}
        />
      </PageColumn>
    )
  return (
    <PageColumn>
      <div className="flex flex-wrap items-center gap-3">
        {view.permissions.includes('event.create') && (
          <Button onClick={dialogs.startCreate}>행사 만들기</Button>
        )}
        {dialogs.lost && <StateMessage kind="error">{dialogs.lost}</StateMessage>}
      </div>
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
