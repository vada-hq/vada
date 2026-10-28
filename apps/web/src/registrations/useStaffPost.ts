import { useRef, useState } from 'react'
import { statusOf, type FormActivationCondition } from '@vada/contracts'
import { postJson } from '@/lib/api'
import { PERMISSION_CHANGED } from '@/lib/messages'
import {
  REGISTRATION_STAFF_ERRORS,
  REGISTRATION_STAFF_FAILED,
  REGISTRATION_STAFF_LOST,
} from '@/lib/registration-messages'
import type { EventDialogHandlers } from '@/events/useEventSubmit'

export type StaffPostResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; code: string; missingConditions?: FormActivationCondition[] }

// 운영진이 보내는 참가 신청 쓰기 하나(양식, 신청 취소, 출석). 보내는 동안 다시 보내지 않는다.
// 403이면 학생회를 다시 읽게 하고, 404와 함께 부모가 대화상자를 닫고 이유를 보인다. 그 밖의 실패는 problem으로 버튼 옆에 보인다.
// actions를 주면, 다시 읽은 값에 새 동작이 나타났을 때(막힘이 풀려 버튼이 되살아남) 남은 거절 문구를 지운다.
// 거절 문구는 그 거절을 낳은 버튼 곁의 것이다. 동작이 사라지기만 한 경우는 지우지 않는다(EventCompletion과 같은 규칙).
export function useStaffPost(
  handlers: EventDialogHandlers,
  setSaving?: (saving: boolean) => void,
  actions?: readonly string[],
) {
  const [problem, setProblem] = useState<string | null>(null)
  const [seen, setSeen] = useState(actions)
  if (actions && seen !== actions) {
    setSeen(actions)
    if (problem !== null && actions.some(action => !seen?.includes(action))) setProblem(null)
  }
  const [busy, setBusy] = useState(false)
  const sending = useRef(false)

  async function send<T>(path: string, body: unknown = {}): Promise<StaffPostResult<T>> {
    if (sending.current) return { ok: false, status: 0, code: 'FAILED' }
    sending.current = true
    setBusy(true)
    setSaving?.(true)
    setProblem(null)
    const result = await postJson<T>(path, body)
    sending.current = false
    setBusy(false)
    setSaving?.(false)
    if (result.ok) return result
    if (result.status === statusOf('FORBIDDEN')) {
      handlers.onForbidden()
      handlers.onLost(PERMISSION_CHANGED)
    } else if (result.status === statusOf('NOT_FOUND')) {
      handlers.onLost(REGISTRATION_STAFF_LOST)
    } else {
      setProblem(REGISTRATION_STAFF_ERRORS[result.code] ?? REGISTRATION_STAFF_FAILED)
    }
    return result
  }

  return { send, busy, problem, clear: () => setProblem(null) }
}
