import { useNow } from '@/lib/use-now'
import type { ChatMessage, RoomListResponse } from '@vada/contracts'
import { MessageSquarePlus } from 'lucide-react'
import PageColumn from '@/components/PageColumn'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { dateLabel } from './chat-view'
import RoomCard from './RoomCard'

function RecentNotices({
  notices,
  now,
  onOpenNotices,
}: {
  notices: ChatMessage[]
  now: Date
  onOpenNotices: () => void
}) {
  return (
    <Card className="flex flex-col gap-2 p-4">
      <div className="flex items-center gap-2">
        <h2 className="flex-1 text-sm font-semibold text-gray-900">최근 공지</h2>
        <Button variant="link" size="sm" onClick={onOpenNotices}>
          공지 모아 보기
        </Button>
      </div>
      {notices.length === 0 ? (
        <StateMessage kind="empty">아직 공지가 없어요.</StateMessage>
      ) : (
        <ul className="flex flex-col gap-2">
          {notices.map(notice => (
            <li key={notice.id} className="text-sm wrap-anywhere">
              <span className="text-xs text-gray-400">{dateLabel(notice.sentAt, now)}</span>
              <p className="line-clamp-2 text-gray-800">{notice.body}</p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

type Props = {
  data: RoomListResponse
  // 권한이 바뀌어 1:1을 열지 못했다는 안내(목록 위에 보인다).
  note: string | null
  canDirect: boolean
  onOpenRoom: (roomId: string) => void
  onOpenNotices: () => void
  onDirect: () => void
}

// 대화 첫 화면: 최근 공지 3개, 내가 참여한 방 카드, [1:1 대화]. 방 순서는 서버가 정했다.
export default function RoomList({
  data,
  note,
  canDirect,
  onOpenRoom,
  onOpenNotices,
  onDirect,
}: Props) {
  const now = useNow()
  return (
    <PageColumn>
      {note && <StateMessage kind="notice">{note}</StateMessage>}
      <RecentNotices notices={data.notices} now={now} onOpenNotices={onOpenNotices} />
      <ul className="flex flex-col gap-2">
        {data.rooms.map(room => (
          <li key={room.id}>
            <RoomCard room={room} now={now} onOpen={() => onOpenRoom(room.id)} />
          </li>
        ))}
      </ul>
      {canDirect && (
        <Button variant="outline" className="self-start" onClick={onDirect}>
          <MessageSquarePlus aria-hidden />
          1:1 대화
        </Button>
      )}
    </PageColumn>
  )
}
