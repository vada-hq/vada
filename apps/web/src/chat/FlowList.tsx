import { useState } from 'react'
import type { ChatMessage } from '@vada/contracts'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import { OLDER_LOAD_FAILED } from '@/lib/messages'
import { cn } from '@/lib/utils'
import MessageItem from './MessageItem'
import type { FlowItem } from './message-flow'
import type { MessageActionSet } from './useMessageActions'

// 방 흐름과 답글 패널(022 조각 11)이 같이 쓰는 메시지 줄과 '이전 … 보기'.
export function Older({
  onLoad,
  label = '이전 메시지 보기',
}: {
  onLoad: () => Promise<boolean>
  label?: string
}) {
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const load = async () => {
    setBusy(true)
    setFailed(!(await onLoad()))
    setBusy(false)
  }
  return (
    <div className="flex flex-col items-center gap-1">
      <Button variant="outline" size="sm" busy={busy} onClick={() => void load()}>
        {label}
      </Button>
      {failed && <StateMessage kind="error">{OLDER_LOAD_FAILED}</StateMessage>}
    </div>
  )
}

// 새 메시지 경계(Slack '여기부터 새 메시지')
function UnreadLine() {
  return (
    <li className="flex items-center gap-2 py-1 text-xs font-medium text-red-600">
      <span className="h-px flex-1 bg-red-200" aria-hidden />
      여기부터 새 메시지
      <span className="h-px flex-1 bg-red-200" aria-hidden />
    </li>
  )
}

function DateLine({ label }: { label: string }) {
  return (
    <li className="flex items-center gap-2 pt-3 pb-1 text-xs text-gray-500">
      <span className="h-px flex-1 bg-gray-300" aria-hidden />
      {label}
      <span className="h-px flex-1 bg-gray-300" aria-hidden />
    </li>
  )
}

// 날짜 구분선, 새 메시지 경계, 메시지 줄. 메시지가 적으면 입력칸 바로 위에 붙인다(Slack·카카오톡). 답글 패널도 같은 줄을 쓴다.
export function Flow({
  items,
  councilId,
  meId,
  menu,
  fresh,
  className = 'mt-auto',
}: {
  items: FlowItem[]
  councilId: string
  meId: string
  menu: MessageActionSet
  // 방을 열 때 읽은 뒤 답글이 달린 원글인가('새 답글', 022 정한 것 32)
  fresh?: ((message: ChatMessage) => boolean) | undefined
  className?: string
}) {
  return (
    <ul className={cn('flex flex-col', className)}>
      {items.map(item =>
        item.kind === 'date' ? (
          <DateLine key={item.key} label={item.label} />
        ) : item.kind === 'unread' ? (
          <UnreadLine key={item.key} />
        ) : (
          <MessageItem
            key={item.key}
            councilId={councilId}
            message={item.message}
            continued={item.continued}
            mine={item.message.senderId === meId}
            newReplies={fresh?.(item.message)}
            {...menu}
          />
        ),
      )}
    </ul>
  )
}
