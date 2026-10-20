import type { ChatMessage } from '@vada/contracts'
import { Megaphone } from 'lucide-react'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { dateLabel } from './chat-view'

// 전체방 위의 공지 띠: 가장 최근 공지 하나와 모아 보기. 들어오기 전 공지도 여기에 보인다.
export default function NoticeBand({
  notice,
  now,
  onOpenNotices,
}: {
  notice: ChatMessage
  now: Date
  onOpenNotices: () => void
}) {
  return (
    <Alert tone="info" className="flex items-start gap-2">
      <Megaphone aria-hidden className="mt-0.5 size-4 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-xs">{dateLabel(notice.sentAt, now)} 공지</p>
        <p className="line-clamp-2 text-sm wrap-anywhere">{notice.body}</p>
      </div>
      <Button variant="link" size="sm" onClick={onOpenNotices}>
        모아 보기
      </Button>
    </Alert>
  )
}
