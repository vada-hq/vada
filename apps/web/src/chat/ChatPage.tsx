import { useEffect, useState, type ComponentProps } from 'react'
import type { CouncilView } from '@vada/contracts'
import PageColumn from '@/components/PageColumn'
import { useHideBottomNavigation } from '@/components/BottomNavigationVisibility'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import { PERMISSION_CHANGED, ROOMS_LOAD_FAILED } from '@/lib/messages'
import type { Team } from '../team/useTeam'
import DirectDialog from './DirectDialog'
import { roomToShow, saveRoom, savedRoom } from './last-room'
import RoomGate from './RoomGate'
import RoomList from './RoomList'
import RoomView from './RoomView'
import type { RoomList as RoomListHook, RoomSource } from './useRoomList'
import { useSplit } from '@/lib/use-split'
import ProductPanel from './ProductPanel'
import { ProductOpenContext, useProductPanel } from './product-open'

export type Screen = { kind: 'list' } | { kind: 'room'; roomId: string }

type Props = {
  councilId: string
  view: CouncilView
  team: Team
  rooms: RoomListHook
  // 권한이 바뀌었을 때 학생회를 다시 읽게 한다.
  onForbidden: () => void
  // 메시지에서 낸 요청을 재정 화면에서 연다.
  onOpenRequest: (requestId: string) => void
  onScreen: (screen: Screen) => void
}

export type RoomPage = Omit<Props, 'onScreen'>
type PageProps = RoomPage

// 방 목록을 아직 못 보일 때: 불러오는 중, 못 불러왔으면 다시 시도.
function RoomsNotReady({ rooms }: { rooms: RoomListHook }) {
  if (rooms.state.kind === 'loading')
    return <StateMessage kind="loading">대화방 불러오는 중…</StateMessage>
  return (
    <PageColumn className="gap-3">
      <StateMessage kind="error">{ROOMS_LOAD_FAILED}</StateMessage>
      <Button variant="outline" className="self-start" onClick={() => void rooms.reload()}>
        다시 시도
      </Button>
    </PageColumn>
  )
}

// 방 목록과 1:1 열기. 권한을 잃으면 대화상자를 닫고 이유를 목록 위에 보인다.
function ListScreen(props: Props & { activeRoomId: string | null }) {
  const { councilId, view, team, rooms, onForbidden, onScreen } = props
  const [directOpen, setDirectOpen] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const canDirect = view.permissions.includes('chat.direct')
  const { state } = rooms
  if (state.kind !== 'ready') return <RoomsNotReady rooms={rooms} />
  return (
    <>
      <RoomList
        data={state.data}
        note={note}
        activeRoomId={props.activeRoomId}
        canDirect={canDirect}
        onOpenRoom={roomId => onScreen({ kind: 'room', roomId })}
        onDirect={() => {
          setNote(null)
          setDirectOpen(true)
        }}
      />
      <DirectDialog
        councilId={councilId}
        meId={view.me.memberId}
        team={team}
        open={directOpen && canDirect}
        onClose={() => setDirectOpen(false)}
        onOpened={roomId => {
          setDirectOpen(false)
          void rooms.reload()
          onScreen({ kind: 'room', roomId })
        }}
        onForbidden={() => {
          setDirectOpen(false)
          setNote(PERMISSION_CHANGED)
          onForbidden()
        }}
      />
    </>
  )
}

// 방 하나. 뒤로 가기가 없으면(PC 두 칸) 목록이 옆에 늘 보인다.
export function Room({
  page,
  roomId,
  onBack,
  space,
}: {
  page: PageProps
  roomId: string
  onBack?: () => void
  space?: RoomSource
}) {
  const { view } = page
  return (
    <RoomView
      councilId={page.councilId}
      roomId={roomId}
      meId={view.me.memberId}
      rooms={space ?? page.rooms}
      bare={space !== undefined}
      // 공간 탭의 방은 본문 여백 안에 놓여 테두리로 칸을 가른다. 대화 화면의 방은 칸 끝까지 채운다.
      className={space && 'overflow-hidden rounded-lg border'}
      request={{
        canRequest: view.permissions.includes('purchase.request'),
        canAssign: view.permissions.includes('finance.manage'),
        team: page.team.data,
        onOpenRequest: page.onOpenRequest,
      }}
      canWriteExpense={view.permissions.includes('finance.manage')}
      onBack={onBack}
      onForbidden={page.onForbidden}
    />
  )
}

// PC 두 칸: 왼쪽 방 목록은 늘 보이고 오른쪽에 방을 연다(Slack·Teams·NAVER WORKS PC).
// 고른 방이 없으면 마지막에 연 방을 연다. 대화를 누른 목적은 방 고르기가 아니라 대화를 이어 가기다.
// 두 칸은 본문 폭 끝까지 쓴다(와이어프레임 MSG-03·US-MSG-01). 1024px 칸에 가두면 넓은 화면에서 흐름이 좁다.
function Split({
  page,
  screen,
  saved,
  onScreen,
}: {
  page: PageProps
  screen: Screen
  saved: string | null
  onScreen: (screen: Screen) => void
}) {
  const ready = page.rooms.state.kind === 'ready' ? page.rooms.state.data : null
  const roomId = screen.kind === 'room' ? screen.roomId : ready ? roomToShow(ready, saved) : null
  return (
    <div className="flex h-full">
      <div className="w-72 shrink-0 overflow-y-auto border-r bg-white p-4">
        <ListScreen {...page} activeRoomId={roomId} onScreen={onScreen} />
      </div>
      <div className="flex min-w-0 flex-1 flex-col bg-gray-50">
        {roomId && (
          <RoomGate
            rooms={page.rooms}
            councilId={page.councilId}
            roomId={roomId}
            onList={() => onScreen({ kind: 'list' })}
          >
            <Room key={roomId} page={page} roomId={roomId} />
          </RoomGate>
        )}
      </div>
    </div>
  )
}

// 대화: 휴대폰은 방 목록 → 방, PC는 목록과 방을 나란히.
// 어느 화면인지는 부르는 쪽(주소)이 정하고, 뒤로는 들어온 곳으로 가는 동작을 받는다.
function ChatBody({
  screen,
  onScreen,
  onBack,
  ...props
}: PageProps & { screen: Screen; onScreen: (screen: Screen) => void; onBack: () => void }) {
  const split = useSplit()
  useHideBottomNavigation(!split && screen.kind === 'room')
  const { councilId } = props
  const [saved, setSaved] = useState(() => savedRoom(councilId))
  const openedRoom = screen.kind === 'room' ? screen.roomId : null
  // 어떻게 열었든(눌러서, 주소로, 뒤로 가서) 연 방을 기억한다.
  useEffect(() => {
    if (!openedRoom) return
    saveRoom(councilId, openedRoom)
    setSaved(openedRoom)
  }, [councilId, openedRoom])
  const page = { ...props, onScreen }
  if (split) return <Split page={props} screen={screen} saved={saved} onScreen={onScreen} />
  if (screen.kind === 'room')
    return (
      <RoomGate
        rooms={props.rooms}
        councilId={councilId}
        roomId={screen.roomId}
        onList={() => onScreen({ kind: 'list' })}
      >
        <Room key={screen.roomId} page={props} roomId={screen.roomId} onBack={onBack} />
      </RoomGate>
    )
  return (
    <div className="p-4 sm:p-6">
      <ListScreen {...page} activeRoomId={null} />
    </div>
  )
}

export default function ChatPage(props: ComponentProps<typeof ChatBody>) {
  const product = useProductPanel()
  return (
    <ProductOpenContext value={product.open}>
      <div className="flex h-full min-h-0 min-w-0">
        <div className="min-w-0 flex-1">
          <ChatBody {...props} />
        </div>
        {product.target && (
          <ProductPanel page={props} target={product.target} onClose={product.close} />
        )}
      </div>
    </ProductOpenContext>
  )
}
