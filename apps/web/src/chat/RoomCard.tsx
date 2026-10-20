import type { RoomSummary } from '@vada/contracts'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { roomName, timeLabel, unreadLabel } from './chat-view'

// 방 카드: 이름, 마지막 시각, 안 읽은 수, '나를 부름', '보기만'. 카드 전체가 그 방을 여는 버튼이다.
export default function RoomCard({
  room,
  now,
  onOpen,
}: {
  room: RoomSummary
  now: Date
  onOpen: () => void
}) {
  return (
    <Button
      variant="outline"
      className="h-auto w-full flex-col items-stretch gap-2 px-4 py-3 text-left font-normal whitespace-normal"
      onClick={onOpen}
    >
      <span className="flex items-center gap-2">
        <span className="min-w-0 flex-1 text-sm font-medium wrap-anywhere text-gray-900">
          {roomName(room)}
        </span>
        <span className="shrink-0 text-xs text-gray-400">{timeLabel(room.lastMessageAt, now)}</span>
      </span>
      {(room.unread > 0 || room.mentions > 0 || room.readOnly) && (
        <span className="flex flex-wrap items-center gap-1.5">
          {room.unread > 0 && (
            <Badge tone="info" aria-label={`안 읽은 메시지 ${room.unread}개`}>
              {unreadLabel(room.unread)}
            </Badge>
          )}
          {room.mentions > 0 && <Badge tone="warning">나를 부름</Badge>}
          {room.readOnly && <Badge>보기만</Badge>}
        </span>
      )}
    </Button>
  )
}
