import { useState } from 'react'
import type { EventDetail } from '@vada/contracts'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import { COMPLETION_ERRORS, PERMISSION_CHANGED } from '@/lib/messages'
import { useAskingGuard } from '@/lib/use-asking-guard'
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

type Gone = 'permission' | 'completed' | 'not_completed'

// 서버가 주는 동작 이름: 완료하지 않은 행사는 완료, 완료한 행사는 완료 취소(화면 규칙은 기능 012 조각 2가 고친다).
const completionActionOf = (event: EventDetail) =>
  event.status === 'completed' ? 'event.cancel_completion' : 'event.complete'

// 열려 있는 동안 다시 읽은 행사가 바뀌면 닫고 이유를 보인다: 권한이 빠졌거나, 다른 사람이 이미 완료(또는 완료 취소)했다.
function goneOf(asking: Asking, event: EventDetail): Gone | null {
  const completed = event.status === 'completed'
  if (asking === 'complete' && completed) return 'completed'
  if (asking === 'cancel' && !completed) return 'not_completed'
  return event.actions.includes(completionActionOf(event)) ? null : 'permission'
}

// 막힌 이유에 맞는 문구로 확인을 닫는다. 권한을 잃었으면 부모에게도 알린다.
function closeFor(
  gone: Gone,
  close: (message: string | null) => void,
  onLost: (message: string) => void,
) {
  if (gone === 'permission') {
    close(null)
    return onLost(PERMISSION_CHANGED)
  }
  const code = gone === 'completed' ? 'EVENT_COMPLETED' : 'EVENT_NOT_COMPLETED'
  close(COMPLETION_ERRORS[code] ?? null)
}

// 완료와 완료 취소(회장단). 버튼은 서버가 준 동작(event.complete, event.cancel_completion)이 있을 때만 보이고, 완료한 행사에서는 [완료 취소]가 된다.
// 거절 문구는 버튼 옆에 보인다. 두 번 눌러도 요청은 한 번만 나간다.
export function EventCompletion({ councilId, event, onDone, onStale, ...handlers }: Props) {
  const [asking, setAsking] = useState<Asking>(null)
  const post = useCompletionPost(councilId, event.id, { ...handlers, onDone })
  const { report } = post
  const close = (message: string | null) => {
    setAsking(null)
    report(message)
  }
  const guarded = useAskingGuard(asking !== null, goneOf(asking, event), gone =>
    closeFor(gone, close, handlers.onLost),
  )
  if (!event.actions.includes(completionActionOf(event))) return null
  const completed = event.status === 'completed'
  async function confirm(reason: string | null) {
    const outcome = await guarded(
      () => post.send(completed ? 'cancel-completion' : 'complete', { reason }),
      result => result !== 'failed',
    )
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
