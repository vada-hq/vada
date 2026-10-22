import { useRef, useState } from 'react'
import { statusOf, type EventDetail, type EventResponse } from '@vada/contracts'
import { postJson } from '@/lib/api'
import {
  COMPLETION_ERRORS,
  COMPLETION_FAILED,
  EVENT_LOST,
  PERMISSION_CHANGED,
} from '@/lib/messages'
import { eventPath } from './event-api'
import type { EventDialogHandlers } from './useEventSubmit'

// 완료 쪽 거절(정산이 남음, 시작 전, 회계 기간 없음, 이미 완료)은 모두 이 상태다.
const CONFLICT = statusOf('SETTLEMENT_PENDING')

// done: 반영했다. rejected: 서버가 이미 바뀐 상태라며 거절했다(409. 다시 읽어야 한다). failed: 연결·입력 문제. lost: 대상이 사라졌거나 권한을 잃었다.
export type CompletionOutcome = 'done' | 'rejected' | 'failed' | 'lost'

// 완료와 완료 취소 요청 하나. 보내는 동안 다시 보내지 않는다.
// 403이면 학생회를 다시 읽게 하고 404와 함께 부모가 닫고 이유를 보인다. 409와 그 밖의 실패는 problem으로 그 동작 옆에 보인다.
export function useCompletionPost(
  councilId: string,
  eventId: string,
  handlers: EventDialogHandlers & { onDone: (event: EventDetail) => void },
) {
  const [problem, setProblem] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const sending = useRef(false)

  async function send(
    action: 'complete' | 'cancel-completion',
    body: unknown,
  ): Promise<CompletionOutcome> {
    if (sending.current) return 'failed'
    sending.current = true
    setBusy(true)
    setProblem(null)
    const result = await postJson<EventResponse>(`${eventPath(councilId, eventId)}/${action}`, body)
    sending.current = false
    setBusy(false)
    if (result.ok) {
      handlers.onDone(result.data.event)
      return 'done'
    }
    if (result.status === statusOf('FORBIDDEN')) {
      handlers.onForbidden()
      handlers.onLost(PERMISSION_CHANGED)
      return 'lost'
    }
    if (result.status === statusOf('NOT_FOUND')) {
      handlers.onLost(EVENT_LOST)
      return 'lost'
    }
    setProblem(COMPLETION_ERRORS[result.code] ?? COMPLETION_FAILED)
    return result.status === CONFLICT ? 'rejected' : 'failed'
  }

  return { send, busy, problem, report: setProblem }
}
