import { useEffect, useState } from 'react'
import type { EventDetail } from '@vada/contracts'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import { COMPLETION_ERRORS, PERMISSION_CHANGED } from '@/lib/messages'
import { CompletionDialog } from './CompletionDialog'
import { useCompletionPost } from './useCompletionPost'
import type { EventDialogHandlers } from './useEventSubmit'

type Props = EventDialogHandlers & {
  councilId: string
  event: EventDetail
  // 내 변경이 돌려준 행사. 부모가 화면의 값으로 놓고 목록과 정산을 다시 읽는다.
  onDone: (event: EventDetail) => void
  // 서버가 이미 바뀐 상태라며 거절했다. 행사와 정산을 다시 읽는다.
  onStale: () => void
}

type Asking = 'complete' | 'cancel' | null

// 열려 있는 동안 다시 읽은 행사가 바뀌면 닫고 이유를 보인다: 권한이 빠졌거나, 다른 사람이 이미 완료(또는 완료 취소)했다.
function useAskingGuard(
  asking: Asking,
  event: EventDetail,
  close: (message: string | null) => void,
  onLost: (message: string) => void,
) {
  const completed = event.status === 'completed'
  const allowed = event.actions.includes('event.complete')
  useEffect(() => {
    if (asking === null) return
    if (!allowed) {
      close(null)
      return onLost(PERMISSION_CHANGED)
    }
    if (asking === 'complete' && completed) close(COMPLETION_ERRORS.EVENT_COMPLETED ?? null)
    if (asking === 'cancel' && !completed) close(COMPLETION_ERRORS.EVENT_NOT_COMPLETED ?? null)
  }, [asking, allowed, completed, close, onLost])
}

// 완료와 완료 취소(회장단). 버튼은 서버가 준 동작(event.complete)이 있을 때만 보이고, 완료한 행사에서는 [완료 취소]가 된다.
// 거절 문구는 버튼 옆에 보인다. 두 번 눌러도 요청은 한 번만 나간다.
export function EventCompletion({ councilId, event, onDone, onStale, ...handlers }: Props) {
  const [asking, setAsking] = useState<Asking>(null)
  const post = useCompletionPost(councilId, event.id, { ...handlers, onDone })
  const { report } = post
  const close = (message: string | null) => {
    setAsking(null)
    report(message)
  }
  useAskingGuard(asking, event, close, handlers.onLost)
  if (!event.actions.includes('event.complete')) return null
  const completed = event.status === 'completed'
  async function confirm(reason: string | null) {
    const outcome = await post.send(completed ? 'cancel-completion' : 'complete', { reason })
    if (outcome === 'done' || outcome === 'lost') setAsking(null)
    if (outcome === 'rejected') {
      setAsking(null)
      onStale()
    }
  }
  return (
    <div className="flex flex-col items-start gap-2">
      <Button
        variant={completed ? 'outline' : 'default'}
        disabled={post.busy}
        onClick={() => {
          post.report(null)
          setAsking(completed ? 'cancel' : 'complete')
        }}
      >
        {completed ? '완료 취소' : '완료'}
      </Button>
      {asking === null && post.problem && <StateMessage kind="error">{post.problem}</StateMessage>}
      {asking !== null && (
        <CompletionDialog
          mode={asking}
          openTasks={event.tasks.open}
          busy={post.busy}
          error={post.problem}
          onClose={() => close(null)}
          onConfirm={reason => void confirm(reason)}
        />
      )}
    </div>
  )
}
