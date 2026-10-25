import type { RoomSummary } from '@vada/contracts'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { roomName, timeLabel, unreadLabel } from './chat-view'

// 줄 목록 한 줄의 단추 모양. 줄 전체가 누르는 곳이다.
const rowButtonClass =
  'h-auto w-full flex-col items-stretch gap-1 rounded-none px-4 py-3 text-left font-normal whitespace-normal'

// PC 두 칸에서 오른쪽에 열린 줄. 옆 메뉴의 고른 항목과 같은 색이다.
const activeRowClass = 'aria-[current=true]:bg-accent'

// 마지막 말: '{보낸 사람}: {미리보기}'(와이어프레임 MSG-01). 보낸 사람이 없는 메시지는 미리보기만이다.
const lastLine = ({ senderName, preview }: NonNullable<RoomSummary['lastMessage']>) =>
  senderName === null ? preview : `${senderName}: ${preview}`

// 방 한 줄(와이어프레임 MSG-01): 첫 줄은 이름과 배지(보기만, 나를 부름, 안 읽은 수), 오른쪽에 마지막 시각.
// 안 읽은 수는 와이어프레임과 홈 메시지함처럼 빨강이다.
// 그 아래 마지막 말 한 줄(넘치면 말줄임)과 참여 인원. 줄 전체가 그 방을 여는 단추다.
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
        <span className="flex items-center gap-2">
          <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
            <span className="min-w-0 text-sm font-semibold wrap-anywhere text-gray-900">
              {roomName(room)}
            </span>
            {room.readOnly && <Badge>보기만</Badge>}
            {room.mentions > 0 && (
              <Badge tone="warning" aria-label={`나를 부른 메시지 ${room.mentions}개`}>
                @
              </Badge>
            )}
            {room.unread > 0 && (
              <Badge tone="count" aria-label={`안 읽은 메시지 ${room.unread}개`}>
                {unreadLabel(room.unread)}
              </Badge>
            )}
          </span>
          <span className="shrink-0 self-start text-xs text-gray-400">
            {timeLabel(room.lastMessageAt, now)}
          </span>
        </span>
        {room.lastMessage && (
          <span className="truncate text-xs text-gray-500">{lastLine(room.lastMessage)}</span>
        )}
        <span className="text-xs text-gray-400">참여 {room.memberCount}명</span>
      </Button>
    </li>
  )
}
