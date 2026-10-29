import { ArrowLeft } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { DIRECT_LIST_TITLE, directTitle } from './message-text'

export default function SideChatRoomTitle({
  name,
  readOnly,
  onBack,
  side,
  direct,
}: {
  name: string
  readOnly: boolean
  onBack: (() => void) | undefined
  side: boolean
  direct: boolean
}) {
  // 휴대폰은 1:1을 전체 화면으로 연다. 학생회 방과 갈리게 PC 오른쪽 칸 머리와 같은 호박색·제목을 쓴다(MSG-04).
  const amber = side || direct
  return (
    <div
      className={cn(
        'flex min-h-14 shrink-0 items-center gap-2 border-b px-4 py-2 sm:px-6',
        amber ? 'border-personal-border bg-personal-surface' : 'bg-white',
      )}
    >
      {onBack && (
        <Button
          variant="ghost"
          size={side ? 'sm' : 'icon'}
          touch
          aria-label={side ? DIRECT_LIST_TITLE : '대화방 목록'}
          onClick={onBack}
        >
          <ArrowLeft aria-hidden />
          {side && DIRECT_LIST_TITLE}
        </Button>
      )}
      <h2 className="min-w-0 flex-1 text-base font-semibold break-keep wrap-anywhere text-fg">
        {amber ? directTitle(name) : name}
      </h2>
      {readOnly && <Badge>보기만</Badge>}
    </div>
  )
}
