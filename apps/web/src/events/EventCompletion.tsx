import { useState } from 'react'
import type { ErrorCode, EventDetail } from '@vada/contracts'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import { COMPLETION_ERRORS, COMPLETION_FAILED, PERMISSION_CHANGED } from '@/lib/messages'
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

// 닫는 이유: 권한이 빠졌거나(permission), 서버가 막은 그 쓰기의 오류 코드다.
type Gone = 'permission' | 'EVENT_COMPLETED' | 'EVENT_NOT_COMPLETED' | ErrorCode

const ACTION_OF = { complete: 'event.complete', cancel: 'event.cancel_completion' } as const

// 열려 있는 동안 다시 읽은 행사가 그 동작을 빼면 닫고 이유를 보인다. 이유는 서버가 준 blockers(상태가 막음)가 먼저이고,
// 없으면 다른 사람이 이미 완료(또는 완료 취소)했거나 권한이 빠진 것이다. 상태 때문에 빠진 동작을 권한 잃음으로 다루지 않는다.
function goneOf(asking: Asking, event: EventDetail): Gone | null {
  if (asking === null) return null
  const action = ACTION_OF[asking]
  if (event.actions.includes(action)) return null
  const blocked = event.blockers[action]
  if (blocked) return blocked
  if (asking === 'complete' && event.status === 'completed') return 'EVENT_COMPLETED'
  if (asking === 'cancel' && event.status !== 'completed') return 'EVENT_NOT_COMPLETED'
  return 'permission'
}

// 닫고 이유를 보인다. 권한을 잃었으면 부모에게도 알린다.
function closeFor(
  gone: Gone,
  close: (message: string | null) => void,
  onLost: (message: string) => void,
) {
  if (gone === 'permission') {
    close(null)
    return onLost(PERMISSION_CHANGED)
  }
  close(COMPLETION_ERRORS[gone] ?? COMPLETION_FAILED)
}

// 지금 보일 버튼: 서버가 준 동작이 정한다. 둘 다 없으면 null이다.
function modeOf(event: EventDetail): Asking {
  if (event.actions.includes('event.cancel_completion')) return 'cancel'
  return event.actions.includes('event.complete') ? 'complete' : null
}

// 버튼이 없을 때 자리를 채우는 한 줄: 방금 거절 문구가 먼저이고, 없으면 상태가 막은 이유(blockers)다.
function lineOf(event: EventDetail, problem: string | null) {
  if (problem) return { kind: 'error' as const, text: problem }
  const code = event.blockers['event.complete'] ?? event.blockers['event.cancel_completion']
  return code
    ? { kind: 'notice' as const, text: COMPLETION_ERRORS[code] ?? COMPLETION_FAILED }
    : null
}

type Line = ReturnType<typeof lineOf>

// 버튼 하나, 또는 버튼이 없을 때 그 자리의 한 줄. 버튼이 있으면 거절 문구만 곁에 보인다.
function CompletionTrigger(props: { mode: Asking; busy: boolean; line: Line; onAsk: () => void }) {
  const { mode, busy, line, onAsk } = props
  return (
    <>
      {mode !== null && (
        <Button variant={mode === 'cancel' ? 'outline' : 'default'} disabled={busy} onClick={onAsk}>
          {mode === 'cancel' ? '완료 취소' : '완료'}
        </Button>
      )}
      {line && (mode === null || line.kind === 'error') && (
        <StateMessage kind={line.kind}>{line.text}</StateMessage>
      )}
    </>
  )
}

// 완료와 완료 취소(회장단). 버튼은 서버가 준 동작(event.complete, event.cancel_completion)이 있을 때만 보인다.
// 둘 다 없고 상태가 막았으면(blockers) 버튼 대신 그 이유 한 줄을 보인다. 거절 문구는 같은 자리에 보이고, 버튼이 사라져도 남는다.
// 두 번 눌러도 요청은 한 번만 나간다.
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
  const mode = modeOf(event)
  // 거절 문구는 그 거절을 낳은 버튼 곁의 것이다. 다시 읽은 행사가 버튼을 되살리면(막힘이 풀림) 지운다.
  const [hadMode, setHadMode] = useState(mode !== null)
  if (hadMode !== (mode !== null)) {
    setHadMode(mode !== null)
    if (mode !== null) post.report(null)
  }
  const line = asking === null ? lineOf(event, post.problem) : null
  async function confirm(reason: string | null) {
    const outcome = await guarded(
      () => post.send(asking === 'cancel' ? 'cancel-completion' : 'complete', { reason }),
      result => result !== 'failed',
    )
    if (outcome !== 'failed') setAsking(null)
    if (outcome === 'rejected') onStale()
  }
  if (mode === null && asking === null && !line) return null
  return (
    <div className="flex flex-col items-start gap-2">
      <CompletionTrigger
        mode={mode}
        busy={post.busy}
        line={line}
        onAsk={() => {
          post.report(null)
          setAsking(mode)
        }}
      />
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
