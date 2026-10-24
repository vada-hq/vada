import type { ChatMessage } from '@vada/contracts'
import { Megaphone } from 'lucide-react'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { dateLabel } from './chat-view'
import { newNoticeLabel } from './notice-seen'

// 전체방 위의 공지 띠: 안 본 공지 수와 그중 가장 최근 것을 한 줄로(Teams 고정 메시지, 카카오톡 공지).
// 들어오기 전 공지도 여기에 보인다.
export default function NoticeBand({
  notice,
  newCount,
  now,
  onOpenNotices,
}: {
  notice: ChatMessage
  // 안 본 공지 수
  newCount: number
  now: Date
  onOpenNotices: () => void
}) {
  return (
    <Alert tone="info" className="flex items-center gap-2 py-2">
      <Megaphone aria-hidden className="size-4 shrink-0" />
      <p className="min-w-0 flex-1 truncate text-sm">
        <span className="mr-2 font-semibold">새 공지 {newNoticeLabel(newCount)}</span>
        <span className="sr-only">{dateLabel(notice.sentAt, now)} 공지 </span>
        {notice.body}
      </p>
      <Button variant="link" size="sm" className="shrink-0" onClick={onOpenNotices}>
        모아 보기
      </Button>
    </Alert>
  )
}
