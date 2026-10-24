import type { RoomSummary } from '@vada/contracts'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { roomName, timeLabel, unreadLabel } from './chat-view'

// 줄 목록 한 줄의 단추 모양. 줄 전체가 누르는 곳이다.
export const rowButtonClass =
  'h-auto w-full justify-start gap-2 rounded-none px-4 py-3 text-left font-normal whitespace-normal'

// PC 두 칸에서 오른쪽에 열린 줄. 옆 메뉴의 고른 항목과 같은 색이다.
export const activeRowClass = 'aria-[current=true]:bg-accent'

// 방 한 줄: 이름(보기만), 마지막 시각, 나를 부름(@), 안 읽은 수. 줄 전체가 그 방을 여는 단추다.
export default function RoomRow({
  room,
  now,
  active,
  onOpen,
}: {
  room: RoomSummary
  now: Date
  active: boolean
  onOpen: () => void
}) {
  return (
    <li>
      <Button
        variant="ghost"
        aria-current={active || undefined}
        className={cn(rowButtonClass, activeRowClass)}
        onClick={onOpen}
      >
        <span className="min-w-0 flex-1 text-sm font-medium wrap-anywhere text-gray-900">
          {roomName(room)}
        </span>
        {room.readOnly && <Badge>보기만</Badge>}
        <span className="shrink-0 text-xs text-gray-400">{timeLabel(room.lastMessageAt, now)}</span>
        {room.mentions > 0 && (
          <Badge tone="warning" aria-label={`나를 부른 메시지 ${room.mentions}개`}>
            @
          </Badge>
        )}
        {room.unread > 0 && (
          <Badge tone="info" aria-label={`안 읽은 메시지 ${room.unread}개`}>
            {unreadLabel(room.unread)}
          </Badge>
        )}
      </Button>
    </li>
  )
}
