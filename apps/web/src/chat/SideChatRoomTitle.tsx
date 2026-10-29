import { ArrowLeft } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DIRECT_LIST_TITLE, directTitle } from './message-text'
import { SidePanelCloseButton } from './SidePanelClose'

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
  // 휴대폰은 1:1을 전체 화면으로 연다. 학생회 방과는 색이 아니라 제목('○○님과 1:1')으로 가른다(MSG-04).
  const personal = side || direct
  return (
    <div className="flex min-h-14 shrink-0 items-center gap-2 border-b bg-white px-4 py-2 sm:px-6">
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
        {personal ? directTitle(name) : name}
      </h2>
      {readOnly && <Badge>보기만</Badge>}
      <SidePanelCloseButton />
    </div>
  )
}
