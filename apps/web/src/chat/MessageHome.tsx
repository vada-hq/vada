import { useEffect, useState, type ComponentProps } from 'react'
import type { RoomSummary } from '@vada/contracts'
import PageActions from '@/components/PageActions'
import PageHeading from '@/components/PageHeading'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import { CountBadge } from '@/components/ui/count-badge'
import { Room, type RoomPage } from './ChatPage'
import { roomToShow, saveRoom, savedRoom, savedDirectTab, saveDirectTab } from './last-room'
import { councilRoomScope } from './message-text'
import RoomSwitch from './RoomSwitch'
import { councilRooms, directRooms, elsewhereRooms, unreadSum } from './space-rooms'
import { useSplit } from '@/lib/use-split'
import { SideChatList } from './SideChat'

// 실제 작업 공간에서는 제목과 오른쪽 행동을 공통 머리글로 보낸다. 갤러리도 같은 머리와 탭을 쓴다.
export function MessageHomeHeader({
  rooms,
  active,
  onPick,
  onAll,
  elsewhereUnread = 0,
  direct,
}: {
  rooms: RoomSummary[]
  active: RoomSummary | undefined
  onPick: (roomId: string) => void
  onAll: () => void
  // 탭 줄에 없는 방(행사·부서 간)의 안 읽은 수. [전체 보기]에 단다.
  elsewhereUnread?: number
  direct?: ComponentProps<typeof RoomSwitch>['direct']
}) {
  return (
    <header className="shrink-0 bg-white px-4 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-2 empty:hidden">
        <PageHeading trail={{ title: '메시지', crumbs: [] }}>
          <h1 className="py-3 text-xl font-semibold break-keep">메시지</h1>
        </PageHeading>
        <PageActions>
          <Button variant="outline" size="sm" touch onClick={onAll}>
            전체 보기
            <CountBadge count={elsewhereUnread} label={`안 읽은 메시지 ${elsewhereUnread}개`} />
          </Button>
        </PageActions>
      </div>
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-4 border-b">
        <RoomSwitch
          rooms={rooms}
          activeId={active?.id ?? null}
          onPick={onPick}
          className="border-b-0"
          direct={direct}
        />
        {active && (
          <p className="ml-auto py-3 text-right text-xs break-keep wrap-anywhere text-muted-foreground">
            {councilRoomScope(active)}
          </p>
        )}
      </div>
    </header>
  )
}

// 첫 화면은 서버가 준 학생회 방의 흐름이다. 전체 목록에 있는 행사·1:1은 자동으로 고르지 않는다.
const directUnreadOf = ({ state }: RoomPage['rooms']) =>
  state.kind === 'ready' ? unreadSum(directRooms(state.data.rooms)) : 0
const elsewhereUnreadOf = ({ state }: RoomPage['rooms']) =>
  state.kind === 'ready' ? unreadSum(elsewhereRooms(state.data.rooms)) : 0

export default function MessageHome({
  page,
  wanted,
  onPick,
  onAll,
  onDirect,
  onDirectTab,
}: {
  page: RoomPage
  wanted: string | undefined
  onPick: (roomId: string) => void
  onAll: () => void
  onDirect: (roomId: string) => void
  onDirectTab: () => void
}) {
  const split = useSplit()
  const [directSelected, setDirectSelected] = useState(
    () => !wanted && savedDirectTab(page.councilId, page.view.me.memberId),
  )
  const showDirect = !split && !wanted && directSelected
  const { state } = page.rooms
  const rooms = state.kind === 'ready' ? councilRooms(state.data.rooms) : []
  // 기억은 매번 기기에서 읽는다. 주소로 연 방도 기억되므로, 메뉴로 다시 오면 그 방이다.
  const chosen =
    state.kind === 'ready' ? roomToShow(state.data, wanted ?? savedRoom(page.councilId)) : null
  const room = rooms.find(item => item.id === chosen)
  useEffect(() => {
    if (chosen) saveRoom(page.councilId, chosen)
  }, [page.councilId, chosen])
  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col">
      <MessageHomeHeader
        rooms={rooms}
        active={showDirect ? undefined : room}
        onAll={onAll}
        elsewhereUnread={elsewhereUnreadOf(page.rooms)}
        onPick={roomId => {
          saveRoom(page.councilId, roomId)
          saveDirectTab(page.councilId, page.view.me.memberId, false)
          setDirectSelected(false)
          onPick(roomId)
        }}
        direct={
          !split
            ? {
                active: showDirect,
                unread: directUnreadOf(page.rooms),
                onPick: () => {
                  saveDirectTab(page.councilId, page.view.me.memberId, true)
                  setDirectSelected(true)
                  onDirectTab()
                },
              }
            : undefined
        }
      />
      <div className="min-h-0 min-w-0 flex-1">
        {showDirect ? (
          <SideChatList page={page} onOpen={onDirect} />
        ) : room ? (
          <Room key={room.id} page={page} roomId={room.id} onDirect={onDirect} home />
        ) : (
          <StateMessage kind="empty" className="p-4 sm:p-6">
            대화방 없음
          </StateMessage>
        )}
      </div>
    </div>
  )
}
