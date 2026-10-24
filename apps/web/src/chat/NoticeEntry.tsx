import type { ChatMessage } from '@vada/contracts'
import { Megaphone } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { timeLabel } from './chat-view'
import { newNoticeLabel } from './notice-seen'
import { activeRowClass, rowButtonClass } from './RoomRow'

// 방 목록 맨 위의 공지 한 칸. 단톡방 시절 공지방을 따로 두던 습관대로 방처럼 두고(RFC-1, DEC-14),
// 새 공지가 있으면 수와 굵은 글씨로 알린다. 내용은 방 목록처럼 미리 보이지 않는다.
export default function NoticeEntry({
  latest,
  fresh,
  now,
  active,
  onOpen,
}: {
  latest: ChatMessage | undefined
  // 아직 안 본 공지 수
  fresh: number
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
        <Megaphone aria-hidden className="text-blue-700" />
        <span
          className={cn(
            'flex-1 text-sm text-gray-900',
            fresh > 0 ? 'font-semibold' : 'font-medium',
          )}
        >
          공지
        </span>
        {latest && (
          <span className="shrink-0 text-xs text-gray-400">{timeLabel(latest.sentAt, now)}</span>
        )}
        {fresh > 0 && (
          <Badge tone="info" aria-label={`새 공지 ${fresh}개`}>
            {newNoticeLabel(fresh)}
          </Badge>
        )}
      </Button>
    </li>
  )
}
