import { Check } from 'lucide-react'
import { filePath } from '@/chat/chat-api'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import { cardClass } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { useMessageEvidence } from './useMessageEvidence'

type Message = ReturnType<typeof useMessageEvidence>

// 사진 한 장의 작은 사진과 붙이기 상태(붙는 중, 붙음, 실패 이유)가 그 자리에 보인다.
function PhotoItem({
  councilId,
  id,
  index,
  status,
}: {
  councilId: string
  id: string
  index: number
  status: Message['status'][string] | undefined
}) {
  return (
    <li className="flex items-start gap-3">
      <img
        src={filePath(councilId, id)}
        alt={`메시지 사진 ${index + 1}`}
        loading="lazy"
        className="size-16 shrink-0 rounded-sm border object-cover"
      />
      <span className="flex min-w-0 flex-col gap-1 text-xs wrap-anywhere text-gray-600">
        {status?.state === 'attaching' && <span>붙이는 중…</span>}
        {status?.state === 'done' && (
          <span className="flex items-center gap-1">
            <Check aria-hidden className="size-3" />
            붙였어요
          </span>
        )}
        {status?.state === 'failed' && <StateMessage kind="error">{status.problem}</StateMessage>}
      </span>
    </li>
  )
}

// 지출을 적은 메시지에 사진이 있으면 상세 맨 위에서 먼저 붙이자고 한다. 증빙은 지울 수 없어 공개 범위를 먼저 알린다.
export function MessageEvidence({ councilId, message }: { councilId: string; message: Message }) {
  if (message.photoIds.length === 0) return null
  return (
    <section aria-label="이 메시지의 사진" className={cn(cardClass, 'flex flex-col gap-3 p-3')}>
      <h3 className="text-sm font-medium text-gray-700">
        이 메시지의 사진 {message.photoIds.length}장
      </h3>
      <StateMessage kind="notice">증빙은 모든 운영진이 봐요.</StateMessage>
      <ul aria-label="이 메시지의 사진 목록" className="flex flex-col gap-2">
        {message.photoIds.map((id, index) => (
          <PhotoItem
            key={id}
            councilId={councilId}
            id={id}
            index={index}
            status={message.status[id]}
          />
        ))}
      </ul>
      {message.left > 0 && (
        <div>
          <Button
            type="button"
            disabled={message.attaching}
            onClick={() => void message.attachAll()}
          >
            이 메시지의 사진 {message.left}장 붙이기
          </Button>
        </div>
      )}
    </section>
  )
}
