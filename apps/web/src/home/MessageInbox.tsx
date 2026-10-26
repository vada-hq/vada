import { MessageSquare } from 'lucide-react'
import type { RoomSummary } from '@vada/contracts'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { roomName, unreadLabel } from '../chat/chat-view'
import { isPersonalRoom } from './home-view'

type Props = {
  // 칩으로 보일 방(차례와 수는 inboxRooms가 정했다)
  rooms: RoomSummary[]
  // 인사 카드 안(인사 h2 아래)이면 제목을 h3으로 둔다.
  inCard?: boolean
  onOpenRoom: (roomId: string, eventId?: string | null) => void
  // 대화 방 목록으로 간다.
  onSeeAll: () => void
}

// 와이어프레임 HOME-01 메시지함 칩: 둥근 칩, 1:1·부서 간은 호박색(사이드챗과 같은 색), 수는 굵은 빨강.
// 휴대폰에서는 누르는 크기를 44px 이상으로 둔다(WCAG 2.5.5).
const chipClass =
  'h-auto max-w-full rounded-full px-2.5 py-1 text-left font-normal whitespace-normal wrap-anywhere max-sm:min-h-11'
const PERSONAL_CHIP = 'border-amber-200 bg-amber-50 text-amber-900 hover:bg-amber-100'

// 1:1은 이름만으로는 방인지 사람인지 모르므로 '· 1:1'을 붙인다(색만으로 가르지 않는다, WCAG 1.4.1).
// 대화 목록은 '1:1 대화' 묶음 머리가 대신한다. 상대 이름이 없으면 '1:1 대화'만 둔다.
const chipName = (room: RoomSummary) =>
  room.type === 'direct' && room.name !== null ? `${room.name} · 1:1` : roomName(room)

// 홈 메시지함(DEC-90): 숫자 카드 아래 한 줄에 안 읽은 방 칩과 '전체 보기'. 방 이름과 수만 보이고 대화 내용은 싣지 않는다(DEC-69).
// 안 읽은 방이 없으면 부분째 두지 않는다.
export default function MessageInbox({ rooms, inCard = false, onOpenRoom, onSeeAll }: Props) {
  if (rooms.length === 0) return null
  const Heading = inCard ? 'h3' : 'h2'
  return (
    <section aria-label="메시지함" className="flex flex-wrap items-center gap-2">
      {/* 와이어프레임 HomeMessageBox처럼 부분 제목보다 낮은 회색 작은 라벨이다(칩이 주인공). */}
      <Heading className="flex items-center gap-1 text-xs font-normal text-gray-500">
        <MessageSquare aria-hidden className="size-3.5" />
        메시지함
      </Heading>
      {rooms.map(room => (
        <Button
          key={room.id}
          variant="outline"
          size="sm"
          className={cn(chipClass, isPersonalRoom(room) && PERSONAL_CHIP)}
          aria-label={`${chipName(room)}, 안 읽은 메시지 ${room.unread}개`}
          onClick={() => onOpenRoom(room.id, room.eventId)}
        >
          {chipName(room)}{' '}
          <span className="font-bold text-red-600">{unreadLabel(room.unread)}</span>
        </Button>
      ))}
      <Button
        variant="link"
        size="sm"
        className="h-auto p-0 text-xs max-sm:min-h-11"
        onClick={onSeeAll}
      >
        전체 보기
      </Button>
    </section>
  )
}
