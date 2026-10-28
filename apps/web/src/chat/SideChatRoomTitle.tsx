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
}: {
  name: string
  readOnly: boolean
  onBack: (() => void) | undefined
  side: boolean
}) {
  return (
    <div
      className={cn(
        'flex min-h-14 shrink-0 items-center gap-2 border-b px-4 py-2 sm:px-6',
        side ? 'border-amber-200 bg-amber-50' : 'bg-white',
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
      <h2 className="min-w-0 flex-1 text-base font-semibold break-keep wrap-anywhere text-gray-900">
        {side ? directTitle(name) : name}
      </h2>
      {readOnly && <Badge>보기만</Badge>}
    </div>
  )
}
