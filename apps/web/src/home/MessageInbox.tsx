import { MessageSquare } from 'lucide-react'
import type { RoomSummary } from '@vada/contracts'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { roomName, unreadLabel } from '../chat/chat-view'
import { isPersonalRoom } from './home-view'

type Props = {
  // 칩으로 보일 방(차례와 수는 inboxRooms가 정했다)
  rooms: RoomSummary[]
  onOpenRoom: (roomId: string) => void
  // 대화 방 목록으로 간다.
  onSeeAll: () => void
}

// 와이어프레임 HOME-01 메시지함 칩: 둥근 칩, 1:1·부서 간은 호박색(사이드챗과 같은 색), 수는 굵은 빨강.
const chipClass =
  'h-auto max-w-full rounded-full px-2.5 py-1 font-normal whitespace-normal wrap-anywhere'
const PERSONAL_CHIP = 'border-amber-200 bg-amber-50 text-amber-900 hover:bg-amber-100'

// 1:1은 이름만으로는 방인지 사람인지 모르므로 '· 1:1'을 붙인다(대화 목록은 '1:1 대화' 묶음 머리가 대신한다).
const chipName = (room: RoomSummary) =>
  room.type === 'direct' ? `${roomName(room)} · 1:1` : roomName(room)

// 홈 메시지함(DEC-90): 숫자 카드 아래 한 줄에 안 읽은 방 칩과 '전체 보기'. 방 이름과 수만 보이고 대화 내용은 싣지 않는다(DEC-69).
// 안 읽은 방이 없으면 부분째 두지 않는다.
export default function MessageInbox({ rooms, onOpenRoom, onSeeAll }: Props) {
  if (rooms.length === 0) return null
  return (
    <section aria-label="메시지함" className="flex flex-wrap items-center gap-2">
      <h2 className="flex items-center gap-1.5 text-sm font-semibold text-gray-900">
        <MessageSquare aria-hidden className="size-4 text-gray-500" />
        메시지함
      </h2>
      {rooms.map(room => (
        <Button
          key={room.id}
          variant="outline"
          size="sm"
          className={cn(chipClass, isPersonalRoom(room) && PERSONAL_CHIP)}
          onClick={() => onOpenRoom(room.id)}
        >
          {chipName(room)}{' '}
          <span className="font-bold text-red-600">{unreadLabel(room.unread)}</span>
        </Button>
      ))}
      <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={onSeeAll}>
        전체 보기
      </Button>
    </section>
  )
}
