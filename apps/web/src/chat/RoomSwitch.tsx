import type { RoomSummary } from '@vada/contracts'
import { Button } from '@/components/ui/button'
import { CountBadge } from '@/components/ui/count-badge'
import { switchName } from './chat-view'
import { switchRooms } from './space-rooms'

// 공간 메시지 탭의 방 전환(022 정한 것 28, DEC-96): '공지방 · {부서} 방'과 방마다 안 읽은 배지. 탭 줄 아래 요약 줄 자리에 둔다.
// 공간(행사, 우리 학생회)을 모르고 받은 방만 그린다. 방이 많거나 이름이 길면 줄을 바꿔 휴대폰 폭에서 넘치지 않고, 휴대폰에서 누르는 칸은 44px이다.
export default function RoomSwitch({
  rooms,
  activeId,
  onPick,
}: {
  rooms: RoomSummary[]
  activeId: string | null
  onPick: (roomId: string) => void
}) {
  if (rooms.length <= 1) return null
  return (
    <div
      role="group"
      aria-label="대화방"
      className="flex flex-wrap items-center gap-2 border-b py-3"
    >
      {switchRooms(rooms).map(room => (
        <Button
          key={room.id}
          variant="outline"
          size="sm"
          touch
          aria-pressed={room.id === activeId}
          className="h-auto max-w-full text-left break-keep whitespace-normal wrap-anywhere aria-pressed:border-primary aria-pressed:bg-accent aria-pressed:text-accent-foreground"
          onClick={() => onPick(room.id)}
        >
          {switchName(room)}
          <CountBadge count={room.unread} label={`안 읽은 메시지 ${room.unread}개`} />
        </Button>
      ))}
    </div>
  )
}
