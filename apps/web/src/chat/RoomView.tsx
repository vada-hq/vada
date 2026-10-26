import { useState } from 'react'
import type { ChatMessage } from '@vada/contracts'
import { ArrowLeft } from 'lucide-react'
import PageColumn from '@/components/PageColumn'
import StateMessage from '@/components/StateMessage'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ROOM_LOAD_FAILED, ROOM_LOST, ROOM_SYNC_FAILED, SEND_ERRORS } from '@/lib/messages'
import { useNow } from '@/lib/use-now'
import { ARCHIVED_LABEL, roomName } from './chat-view'
import Composer from './Composer'
import { Flow, Older } from './FlowList'
import { firstUnreadId, flowOf } from './message-flow'
import { useMessageFlows } from './MessageFlows'
import { ProductOpenContext, useEventProductOpener } from './product-open'
import type { RequestAccess } from './RequestFlowView'
import type { RoomSource } from './useRoomList'
import type { MessageActionSet } from './useMessageActions'
import { useReadMarker } from './useReadMarker'
import { useRoom, type Room, type RoomState } from './useRoom'
import { useStickToBottom } from './useStickToBottom'
import { useReplyLinks } from './useReplyLinks'

type Props = {
  councilId: string
  roomId: string
  meId: string
  // 이 방이 든 목록(대화 목록, 또는 행사 메시지 탭의 방들). 읽음·보내기 뒤 다시 읽는다.
  rooms: RoomSource
  // 메시지에서 구매 요청 만들기: 권한(`purchase.request`, 대신 내기 `finance.manage`)은 받은 값 그대로다.
  request: RequestAccess
  // 메시지에서 지출 적기: `finance.manage`를 받은 값 그대로 쓴다.
  canWriteExpense: boolean
  // 휴대폰에서 목록으로 돌아가기. PC 두 칸에서는 목록이 옆에 있어 없다.
  onBack?: (() => void) | undefined
  // 권한이 바뀌었을 때(403) 학생회를 다시 읽게 한다.
  onForbidden: () => void
  // 1:1 패널의 방(022 조각 7): 제목은 패널 머리가 보이고, 보내기 버튼에 받는 사람을 적는다('{이름}에게 보내기').
  sendLabel?: string | undefined
  // 행사 메시지 탭의 방: 방 전환이 방 이름을 보이므로 제목 줄을 두지 않는다(022 정한 것 28).
  bare?: boolean
  // 주소(답글 알림)가 연 원글(022 조각 11). key는 주소 칸마다 달라 같은 알림을 또 누르면 다시 연다.
  replyTo?: { messageId: string; key: string } | undefined
}

function Title({
  name,
  readOnly,
  onBack,
}: {
  name: string
  readOnly: boolean
  onBack: Props['onBack']
}) {
  return (
    <div className="flex min-h-10 items-center gap-2">
      {onBack && (
        <Button variant="ghost" size="icon" aria-label="대화방 목록" onClick={onBack}>
          <ArrowLeft />
        </Button>
      )}
      <h2 className="min-w-0 flex-1 text-base font-semibold wrap-anywhere text-gray-900">{name}</h2>
      {readOnly && <Badge>보기만</Badge>}
    </div>
  )
}

// 방을 읽을 수 없는 모습: 잃었을 때(401·403·404)는 흐름을 비우고 알리고, 못 불러왔을 때는 다시 시도를 준다.
function Unavailable({
  state,
  onBack,
  onRetry,
}: {
  state: RoomState
  onBack: Props['onBack']
  onRetry: () => void
}) {
  if (state.kind === 'loading') return <StateMessage kind="loading">방 불러오는 중…</StateMessage>
  const lost = state.kind === 'lost'
  return (
    <div className="flex flex-col gap-3">
      <StateMessage kind={lost ? 'notice' : 'error'}>
        {lost ? ROOM_LOST : ROOM_LOAD_FAILED}
      </StateMessage>
      <div className="flex gap-2">
        {onBack && (
          <Button variant="outline" onClick={onBack}>
            대화방 목록
          </Button>
        )}
        {!lost && (
          <Button variant="outline" onClick={onRetry}>
            다시 시도
          </Button>
        )}
      </div>
    </div>
  )
}

type Ready = Extract<RoomState, { kind: 'ready' }>

function Messages({
  councilId,
  state,
  room,
  meId,
  unread,
  menu,
  fresh,
}: {
  councilId: string
  meId: string
  state: Ready
  room: Room
  // 방을 열 때의 안 읽은 수. 경계는 처음 그린 흐름에서 한 번만 정한다(새로 온 메시지로 옮겨 가지 않게).
  unread: number
  // 메시지 '…' 메뉴에 들어갈 동작들(답글, 구매 요청, 지출)
  menu: MessageActionSet
  fresh: (message: ChatMessage) => boolean
}) {
  const now = useNow()
  const [unreadFrom] = useState(() => firstUnreadId(state.messages, unread, meId))
  const last = state.messages.at(-1)
  const { ref: scrollRef, onScroll } = useStickToBottom(last?.id, last?.senderId === meId)
  return (
    // 입력칸은 이 흐름 밖에 붙어 있고 메시지 흐름만 스크롤된다.
    <div
      ref={scrollRef}
      onScroll={onScroll}
      className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto"
    >
      {state.hasOlder && <Older onLoad={room.loadOlder} />}
      {state.messages.length === 0 ? (
        <StateMessage kind="empty">아직 메시지가 없어요.</StateMessage>
      ) : (
        <Flow
          items={flowOf(state.messages, now, unreadFrom)}
          councilId={councilId}
          meId={meId}
          menu={menu}
          fresh={fresh}
        />
      )}
      {state.syncFailed && <StateMessage kind="error">{ROOM_SYNC_FAILED}</StateMessage>}
    </div>
  )
}

// 입력칸. 상대가 떠난 1:1처럼 보기만 되는 방에는 입력칸 대신 알림을 보인다.
// 행사 방이 보기만이면 완료로 보관된 것이라 '완료된 행사'다(022 정한 것 26).
function Bottom({
  state,
  councilId,
  roomId,
  meId,
  room,
  rooms,
  sendLabel,
}: Pick<Props, 'councilId' | 'roomId' | 'meId' | 'rooms' | 'sendLabel'> & {
  state: Ready
  room: Room
}) {
  if (state.room.readOnly)
    return (
      <StateMessage kind="notice">
        {state.room.eventId ? ARCHIVED_LABEL : SEND_ERRORS.ROOM_READ_ONLY}
      </StateMessage>
    )
  return (
    <div className="shrink-0 bg-white">
      <Composer
        councilId={councilId}
        roomId={roomId}
        participants={state.participants}
        meId={meId}
        sendLabel={sendLabel}
        onSent={() => {
          void room.sync()
          void rooms.reload()
        }}
        onLost={room.lose}
      />
    </div>
  )
}

// 방을 열 때의 안 읽은 수
const unreadOf = (rooms: RoomSource, roomId: string) =>
  rooms.state.kind === 'ready'
    ? (rooms.state.data.rooms.find(item => item.id === roomId)?.unread ?? 0)
    : 0

// 행사 방 메시지에서 연 요청은 그 행사로 시작한다(DEC-90, 022 정한 것 29). 보관된 행사(보기만)는 요청을 이을 수 없어 고르지 않는다.
const requestEventOf = (state: RoomState) =>
  state.kind === 'ready' && !state.room.readOnly ? (state.room.eventId ?? null) : null

// 방 하나: 이름과 내가 볼 수 있는 메시지 흐름(공지방은 같은 기수의 들어오기 전 것도, DEC-90).
export default function RoomView({
  councilId,
  roomId,
  meId,
  rooms,
  request,
  canWriteExpense,
  onBack,
  onForbidden,
  sendLabel,
  bare = false,
  replyTo,
}: Props) {
  const room = useRoom(councilId, roomId)
  const { state } = room
  const [unreadAtOpen] = useState(() => unreadOf(rooms, roomId))
  const eventId = requestEventOf(state)
  const productOpener = useEventProductOpener(eventId)
  const flows = useMessageFlows({
    councilId,
    meId,
    request,
    eventId,
    canWriteExpense,
    onForbidden,
    onMade: room.markMade,
  })
  const replies = useReplyLinks(roomId, state, room, replyTo)
  useReadMarker(
    { councilId, roomId },
    state.kind === 'ready' ? state.messages.at(-1)?.id : undefined,
    {
      onRead: () => void rooms.reload(),
      onLost: room.lose,
    },
  )

  if (state.kind !== 'ready')
    return <Unavailable state={state} onBack={onBack} onRetry={() => void room.retry()} />
  return (
    <PageColumn className="h-full gap-3">
      {sendLabel === undefined && !bare && (
        <Title name={roomName(state.room)} readOnly={state.room.readOnly} onBack={onBack} />
      )}
      {flows.views}
      <ProductOpenContext value={productOpener}>
        <Messages
          councilId={councilId}
          meId={meId}
          state={state}
          room={room}
          unread={unreadAtOpen}
          menu={{ ...flows.menu, onReply: replies.onReply }}
          fresh={replies.fresh}
        />
      </ProductOpenContext>
      <Bottom {...{ state, councilId, roomId, meId, room, rooms, sendLabel }} />
    </PageColumn>
  )
}
