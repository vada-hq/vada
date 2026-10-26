import { useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import PageColumn from '@/components/PageColumn'
import StateMessage from '@/components/StateMessage'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  OLDER_LOAD_FAILED,
  ROOM_LOAD_FAILED,
  ROOM_LOST,
  ROOM_SYNC_FAILED,
  SEND_ERRORS,
} from '@/lib/messages'
import { useNow } from '@/lib/use-now'
import { roomName } from './chat-view'
import Composer from './Composer'
import MessageItem from './MessageItem'
import { firstUnreadId, flowOf, type FlowItem } from './message-flow'
import { useMessageFlows } from './MessageFlows'
import type { RequestAccess } from './RequestFlowView'
import type { RoomList } from './useRoomList'
import type { MessageActionSet } from './useMessageActions'
import { useReadMarker } from './useReadMarker'
import { useRoom, type Room, type RoomState } from './useRoom'
import { useStickToBottom } from './useStickToBottom'

type Props = {
  councilId: string
  roomId: string
  meId: string
  rooms: RoomList
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

function Older({ onLoad }: { onLoad: () => Promise<boolean> }) {
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const load = async () => {
    setBusy(true)
    setFailed(!(await onLoad()))
    setBusy(false)
  }
  return (
    <div className="flex flex-col items-center gap-1">
      <Button variant="outline" size="sm" busy={busy} onClick={() => void load()}>
        이전 메시지 보기
      </Button>
      {failed && <StateMessage kind="error">{OLDER_LOAD_FAILED}</StateMessage>}
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

// 새 메시지 경계(Slack '여기부터 새 메시지')
function UnreadLine() {
  return (
    <li className="flex items-center gap-2 py-1 text-xs font-medium text-red-600">
      <span className="h-px flex-1 bg-red-200" aria-hidden />
      여기부터 새 메시지
      <span className="h-px flex-1 bg-red-200" aria-hidden />
    </li>
  )
}

function DateLine({ label }: { label: string }) {
  return (
    <li className="flex items-center gap-2 pt-3 pb-1 text-xs text-gray-500">
      <span className="h-px flex-1 bg-gray-300" aria-hidden />
      {label}
      <span className="h-px flex-1 bg-gray-300" aria-hidden />
    </li>
  )
}

// 날짜 구분선, 새 메시지 경계, 메시지 줄. 메시지가 적으면 입력칸 바로 위에 붙인다(Slack·카카오톡).
function Flow({
  items,
  councilId,
  meId,
  menu,
}: {
  items: FlowItem[]
  councilId: string
  meId: string
  menu: MessageActionSet
}) {
  return (
    <ul className="mt-auto flex flex-col">
      {items.map(item =>
        item.kind === 'date' ? (
          <DateLine key={item.key} label={item.label} />
        ) : item.kind === 'unread' ? (
          <UnreadLine key={item.key} />
        ) : (
          <MessageItem
            key={item.key}
            councilId={councilId}
            message={item.message}
            continued={item.continued}
            mine={item.message.senderId === meId}
            {...menu}
          />
        ),
      )}
    </ul>
  )
}

function Messages({
  councilId,
  state,
  room,
  meId,
  unread,
  menu,
}: {
  councilId: string
  meId: string
  state: Ready
  room: Room
  // 방을 열 때의 안 읽은 수. 경계는 처음 그린 흐름에서 한 번만 정한다(새로 온 메시지로 옮겨 가지 않게).
  unread: number
  // 메시지 '…' 메뉴에 들어갈 동작들(구매 요청, 지출)
  menu: MessageActionSet
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
        />
      )}
      {state.syncFailed && <StateMessage kind="error">{ROOM_SYNC_FAILED}</StateMessage>}
    </div>
  )
}

// 입력칸. 상대가 떠난 1:1처럼 보기만 되는 방에는 입력칸 대신 알림을 보인다.
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
    return <StateMessage kind="notice">{SEND_ERRORS.ROOM_READ_ONLY}</StateMessage>
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
const unreadOf = (rooms: RoomList, roomId: string) =>
  rooms.state.kind === 'ready'
    ? (rooms.state.data.rooms.find(item => item.id === roomId)?.unread ?? 0)
    : 0

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
}: Props) {
  const room = useRoom(councilId, roomId)
  const { state } = room
  const [unreadAtOpen] = useState(() => unreadOf(rooms, roomId))
  const flows = useMessageFlows({
    councilId,
    meId,
    request,
    canWriteExpense,
    onForbidden,
    onMade: room.markMade,
  })
  useReadMarker({ councilId, roomId }, state, {
    onRead: () => void rooms.reload(),
    onLost: room.lose,
  })

  if (state.kind !== 'ready')
    return <Unavailable state={state} onBack={onBack} onRetry={() => void room.retry()} />
  return (
    <PageColumn className="h-full gap-3">
      {sendLabel === undefined && (
        <Title name={roomName(state.room)} readOnly={state.room.readOnly} onBack={onBack} />
      )}
      {flows.views}
      <Messages
        councilId={councilId}
        meId={meId}
        state={state}
        room={room}
        unread={unreadAtOpen}
        menu={flows.menu}
      />
      <Bottom {...{ state, councilId, roomId, meId, room, rooms, sendLabel }} />
    </PageColumn>
  )
}
