import { useNow } from '@/lib/use-now'
import type { ReactNode } from 'react'
import type { RoomListResponse, RoomSummary } from '@vada/contracts'
import { Plus } from 'lucide-react'
import PageColumn from '@/components/PageColumn'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import { cardClass } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import RoomRow from './RoomRow'

type Props = {
  data: RoomListResponse
  // 권한이 바뀌어 1:1을 열지 못했다는 안내(목록 위에 보인다).
  note: string | null
  // 갤러리에서 고른 줄을 표시한다. 전체 목록에서는 없다.
  activeRoomId: string | null
  canDirect: boolean
  onOpenRoom: (roomId: string) => void
  onDirect: () => void
}

const isDirect = (room: RoomSummary) => room.type === 'direct'
const isEventRoom = (room: RoomSummary) => Boolean(room.eventId)

// 묶음 하나: 작은 제목과 방 줄 카드. 방이 없으면 두지 않는다. 다만 머리에 하는 버튼(action)이 있으면
// 그 버튼에 닿도록 묶음을 두고 빈 줄('○○ 없음')을 보인다.
function Group({
  title,
  rooms,
  row,
  action,
}: {
  title: string
  rooms: RoomSummary[]
  row: (room: RoomSummary) => ReactNode
  action?: ReactNode
}) {
  if (rooms.length === 0 && !action) return null
  return (
    <section aria-label={title} className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-fg">{title}</h2>
        {action}
      </div>
      {rooms.length > 0 ? (
        <ul className={cn(cardClass, 'divide-y')}>{rooms.map(row)}</ul>
      ) : (
        <StateMessage kind="empty" className="text-xs">
          {title} 없음
        </StateMessage>
      )}
    </section>
  )
}

// 전체 방 목록: 학생회 방 줄, '행사' 묶음, '1:1 대화' 묶음. 방 순서는 서버가 정했다.
// v7 MSG-01 판정대로 전체 목록에는 행사 방을 남긴다. 서버는 첫 메시지 뒤에 싣고 이름에 행사를 붙인다(DEC-90).
// 1:1은 '1:1 대화' 묶음 머리의 [+]에서 시작한다(Slack 'Direct messages' [+], notes/chat-redesign 4a).
// 페이지 머리글 버튼만 둔 곳은 없고, 1:1이 묶음 안에 있어야 어디서 시작하는지 보인다.
export default function RoomList(props: Props) {
  const { data, note, activeRoomId, canDirect, onOpenRoom, onDirect } = props
  const now = useNow()
  const rooms = data.rooms.filter(room => !isDirect(room) && !isEventRoom(room))
  const events = data.rooms.filter(room => !isDirect(room) && isEventRoom(room))
  const directs = data.rooms.filter(isDirect)
  const row = (room: RoomSummary) => (
    <RoomRow
      key={room.id}
      room={room}
      now={now}
      active={room.id === activeRoomId}
      onOpen={() => onOpenRoom(room.id)}
    />
  )
  const startDirect = canDirect && (
    // -my-1.5: 버튼이 묶음 머리 줄을 높이지 않아 '행사' 묶음과 머리 높이가 같다.
    <Button
      variant="ghost"
      size="icon"
      touch
      className="-my-1.5"
      aria-label="1:1 대화 시작"
      onClick={onDirect}
    >
      <Plus aria-hidden />
    </Button>
  )
  return (
    <PageColumn className="gap-5">
      {note && <StateMessage kind="notice">{note}</StateMessage>}
      <ul aria-label="대화방" className={cn(cardClass, 'divide-y')}>
        {rooms.map(row)}
      </ul>
      <Group title="행사" rooms={events} row={row} />
      <Group title="1:1 대화" rooms={directs} row={row} action={startDirect || undefined} />
    </PageColumn>
  )
}
