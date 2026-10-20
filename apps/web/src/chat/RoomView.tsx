import { useState } from 'react'
import type { ChatMessage } from '@vada/contracts'
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
import NoticeBand from './NoticeBand'
import type { RoomList } from './useRoomList'
import { useNoticeMark } from './useNoticeMark'
import { useReadMarker } from './useReadMarker'
import { useRoom, type Room, type RoomState } from './useRoom'
import { useStickToBottom } from './useStickToBottom'

type Props = {
  councilId: string
  roomId: string
  meId: string
  rooms: RoomList
  canMarkNotice: boolean
  onBack: () => void
  onOpenNotices: () => void
  // 권한이 바뀌었을 때(403) 학생회를 다시 읽게 한다.
  onForbidden: () => void
}

function Title({
  name,
  readOnly,
  onBack,
}: {
  name: string
  readOnly: boolean
  onBack: () => void
}) {
  return (
    <div className="flex items-center gap-2">
      <Button variant="ghost" size="icon" aria-label="대화방 목록" onClick={onBack}>
        <ArrowLeft />
      </Button>
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
      <Button variant="outline" size="sm" disabled={busy} onClick={() => void load()}>
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
  onBack: () => void
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
        <Button variant="outline" onClick={onBack}>
          대화방 목록
        </Button>
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
  canMarkNotice,
  onMarkNotice,
}: {
  councilId: string
  state: Ready
  room: Room
  canMarkNotice: boolean
  onMarkNotice: (message: ChatMessage, isNotice: boolean) => Promise<string | null>
}) {
  const now = useNow()
  const { ref: scrollRef, onScroll } = useStickToBottom(state.messages.at(-1)?.id)
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
        <ul className="flex flex-col divide-y">
          {state.messages.map(message => (
            <MessageItem
              key={message.id}
              councilId={councilId}
              message={message}
              now={now}
              canMarkNotice={canMarkNotice}
              onMarkNotice={onMarkNotice}
            />
          ))}
        </ul>
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
}: Pick<Props, 'councilId' | 'roomId' | 'meId' | 'rooms'> & { state: Ready; room: Room }) {
  if (state.room.readOnly)
    return <StateMessage kind="notice">{SEND_ERRORS.ROOM_READ_ONLY}</StateMessage>
  return (
    <div className="shrink-0 bg-white">
      <Composer
        councilId={councilId}
        roomId={roomId}
        participants={state.participants}
        meId={meId}
        onSent={() => {
          void room.sync()
          void rooms.reload()
        }}
        onLost={room.lose}
      />
    </div>
  )
}

// 방 하나: 이름, 전체방이면 공지 띠, 들어온 뒤의 메시지 흐름.
export default function RoomView({
  councilId,
  roomId,
  meId,
  rooms,
  canMarkNotice,
  onBack,
  onOpenNotices,
  onForbidden,
}: Props) {
  const room = useRoom(councilId, roomId)
  const { state } = room
  const now = useNow()
  const { note, markNotice } = useNoticeMark({ councilId, room, rooms, onForbidden })
  useReadMarker({ councilId, roomId }, state, {
    onRead: () => void rooms.reload(),
    onLost: room.lose,
  })

  if (state.kind !== 'ready')
    return <Unavailable state={state} onBack={onBack} onRetry={() => void room.retry()} />
  const allMembers = state.room.type === 'all_members'
  const band = rooms.state.kind === 'ready' ? rooms.state.data.notices[0] : undefined
  return (
    <PageColumn className="h-full gap-3">
      <Title name={roomName(state.room)} readOnly={state.room.readOnly} onBack={onBack} />
      {note && <StateMessage kind="notice">{note}</StateMessage>}
      {allMembers && band && <NoticeBand notice={band} now={now} onOpenNotices={onOpenNotices} />}
      <Messages
        councilId={councilId}
        state={state}
        room={room}
        canMarkNotice={canMarkNotice && allMembers}
        onMarkNotice={markNotice}
      />
      <Bottom
        state={state}
        councilId={councilId}
        roomId={roomId}
        meId={meId}
        room={room}
        rooms={rooms}
      />
    </PageColumn>
  )
}
