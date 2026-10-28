import { useState, type ComponentProps } from 'react'
import type { CouncilView } from '@vada/contracts'
import { ArrowLeft } from 'lucide-react'
import PageColumn from '@/components/PageColumn'
import PageHeading from '@/components/PageHeading'
import { useHideBottomNavigation } from '@/components/BottomNavigationVisibility'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import { PERMISSION_CHANGED, ROOMS_LOAD_FAILED } from '@/lib/messages'
import type { Team } from '../team/useTeam'
import DirectDialog from './DirectDialog'
import MessageHome from './MessageHome'
import RoomGate from './RoomGate'
import RoomList from './RoomList'
import RoomView from './RoomView'
import type { RoomList as RoomListHook, RoomSource } from './useRoomList'
import ProductPanel from './ProductPanel'
import { ProductOpenContext, useProductPanel } from './product-open'
import { useSplit } from '@/lib/use-split'
import SideChat from './SideChat'
import { SideChatAccess } from './SideChatContext'
import { useSideChatPanel } from './SideChatState'

export type Screen =
  | { kind: 'home'; roomId?: string; sideRoomId?: string }
  | { kind: 'list' }
  | { kind: 'room'; roomId: string }

type Props = {
  councilId: string
  view: CouncilView
  team: Team
  rooms: RoomListHook
  onForbidden: () => void
  onOpenRequest: (requestId: string) => void
  onScreen: (screen: Screen) => void
}

export type RoomPage = Omit<Props, 'onScreen'>

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

// 1:1을 열 권한을 잃으면 대화상자를 닫고 이유를 목록 위에 보인다.
function ListScreen(props: Props & { onDirect: (roomId: string) => void }) {
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
        activeRoomId={null}
        canDirect={canDirect}
        onOpenRoom={roomId => {
          if (state.data.rooms.some(room => room.id === roomId && room.type === 'direct'))
            props.onDirect(roomId)
          else onScreen({ kind: 'room', roomId })
        }}
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
          props.onDirect(roomId)
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

// 방 흐름은 메시지 첫 화면과 행사 탭에서도 같은 부품을 쓴다.
export function Room({
  page,
  roomId,
  onBack,
  space,
  home = false,
  side = false,
  onDirect,
}: {
  page: RoomPage
  roomId: string
  onBack?: () => void
  space?: RoomSource
  home?: boolean
  side?: boolean
  onDirect?: (roomId: string) => void
}) {
  const { view } = page
  return (
    <SideChatAccess page={page} onOpen={onDirect}>
      <RoomView
        councilId={page.councilId}
        roomId={roomId}
        meId={view.me.memberId}
        rooms={space ?? page.rooms}
        bare={home || space !== undefined}
        side={side}
        // 행사 탭은 본문 여백 안에 놓여 테두리로 칸을 가른다. 메시지 메뉴는 칸 끝까지 채운다.
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
    </SideChatAccess>
  )
}

// 휴대폰의 1:1과 부서 간 방은 들어온 곳으로 돌아가기 전까지 아래 메뉴를 숨긴다(MSG-04).
function ChatBody({
  screen,
  onScreen,
  onBack,
  onDirect,
  ...props
}: RoomPage & {
  screen: Screen
  onScreen: (screen: Screen) => void
  onBack: () => void
  onDirect: (roomId: string) => void
}) {
  useHideBottomNavigation(screen.kind === 'room')
  if (screen.kind === 'room')
    return (
      <RoomGate
        rooms={props.rooms}
        councilId={props.councilId}
        roomId={screen.roomId}
        onList={() => onScreen({ kind: 'home' })}
      >
        <Room
          key={screen.roomId}
          page={props}
          roomId={screen.roomId}
          onBack={onBack}
          onDirect={onDirect}
        />
      </RoomGate>
    )
  if (props.rooms.state.kind !== 'ready') return <RoomsNotReady rooms={props.rooms} />
  if (screen.kind === 'home')
    return (
      <MessageHome
        page={props}
        wanted={screen.roomId}
        onPick={roomId => onScreen({ kind: 'home', roomId })}
        onAll={() => onScreen({ kind: 'list' })}
        onDirect={onDirect}
        onDirectTab={() => onScreen({ kind: 'home' })}
      />
    )
  return (
    <div className="flex h-full flex-col gap-5 overflow-y-auto p-4 sm:p-6">
      <header className="flex items-center gap-2">
        <Button variant="ghost" size="icon" touch aria-label="메시지 첫 화면" onClick={onBack}>
          <ArrowLeft aria-hidden />
        </Button>
        <PageHeading trail={{ title: '메시지', crumbs: [] }}>
          <h1 className="text-xl font-semibold">메시지</h1>
        </PageHeading>
      </header>
      <ListScreen {...props} onScreen={onScreen} onDirect={onDirect} />
    </div>
  )
}

export default function ChatPage(props: Omit<ComponentProps<typeof ChatBody>, 'onDirect'>) {
  const product = useProductPanel()
  const split = useSplit()
  const side = useSideChatPanel({ ...props, meId: props.view.me.memberId, split })
  return (
    <ProductOpenContext value={product.open}>
      <div className="flex h-full min-h-0 min-w-0">
        <div className="min-w-0 flex-1">
          <ChatBody {...props} onDirect={side.open} />
        </div>
        {split && props.screen.kind === 'home' && !product.target && (
          <SideChat page={props} roomId={side.roomId} onOpen={side.open} onClose={side.close} />
        )}
        {product.target && (
          <ProductPanel page={props} target={product.target} onClose={product.close} />
        )}
      </div>
    </ProductOpenContext>
  )
}
