import { useNow } from '@/lib/use-now'
import type { RoomListResponse, RoomSummary } from '@vada/contracts'
import { MessageSquarePlus } from 'lucide-react'
import PageActions from '@/components/PageActions'
import PageColumn from '@/components/PageColumn'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import { cardClass } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { useNewNotices } from './notice-seen'
import NoticeEntry from './NoticeEntry'
import RoomRow from './RoomRow'

type Props = {
  councilId: string
  meId: string
  data: RoomListResponse
  // 권한이 바뀌어 1:1을 열지 못했다는 안내(목록 위에 보인다).
  note: string | null
  // PC 두 칸에서 지금 열린 방이나 공지 모아 보기. 휴대폰은 없다.
  activeRoomId: string | null
  noticesActive: boolean
  canDirect: boolean
  onOpenRoom: (roomId: string) => void
  onOpenNotices: () => void
  onDirect: () => void
}

const isDirect = (room: RoomSummary) => room.type === 'direct'

// 대화 첫 화면: 공지 칸과 방 줄 목록, 그 아래 1:1 대화 묶음. 방 순서는 서버가 정했다.
// 1:1 열기는 머리글 오른쪽에 둔다(Teams 목록 위 New message, 카카오톡 오른쪽 위).
export default function RoomList(props: Props) {
  const { data, note, activeRoomId, canDirect, onOpenRoom, onDirect } = props
  const now = useNow()
  const fresh = useNewNotices(props.councilId, data.notices, props.meId)
  const rooms = data.rooms.filter(room => !isDirect(room))
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
  return (
    <PageColumn className="gap-5">
      {canDirect && (
        <PageActions>
          <Button variant="outline" onClick={onDirect}>
            <MessageSquarePlus aria-hidden />
            1:1 대화
          </Button>
        </PageActions>
      )}
      {note && <StateMessage kind="notice">{note}</StateMessage>}
      <ul aria-label="대화방" className={cn(cardClass, 'divide-y')}>
        <NoticeEntry
          latest={data.notices[0]}
          fresh={fresh.length}
          now={now}
          active={props.noticesActive}
          onOpen={props.onOpenNotices}
        />
        {rooms.map(row)}
      </ul>
      {directs.length > 0 && (
        <section aria-label="1:1 대화" className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-gray-900">1:1 대화</h2>
          <ul className={cn(cardClass, 'divide-y')}>{directs.map(row)}</ul>
        </section>
      )}
    </PageColumn>
  )
}
