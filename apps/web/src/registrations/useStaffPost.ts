import { useRef, useState } from 'react'
import { statusOf } from '@vada/contracts'
import { postJson } from '@/lib/api'
import { PERMISSION_CHANGED } from '@/lib/messages'
import {
  REGISTRATION_STAFF_ERRORS,
  REGISTRATION_STAFF_FAILED,
  REGISTRATION_STAFF_LOST,
} from '@/lib/registration-messages'
import type { EventDialogHandlers } from '@/events/useEventSubmit'

export type StaffPostResult<T> = { ok: true; data: T } | { ok: false; status: number }

// 운영진이 보내는 참가 신청 쓰기 하나(양식, 신청 취소, 출석). 보내는 동안 다시 보내지 않는다.
// 403이면 학생회를 다시 읽게 하고, 404와 함께 부모가 대화상자를 닫고 이유를 보인다. 그 밖의 실패는 problem으로 버튼 옆에 보인다.
export function useStaffPost(handlers: EventDialogHandlers, setSaving?: (saving: boolean) => void) {
  const [problem, setProblem] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const sending = useRef(false)

  async function send<T>(path: string, body: unknown = {}): Promise<StaffPostResult<T>> {
    if (sending.current) return { ok: false, status: 0 }
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
    return { ok: false, status: result.status }
  }

  return { send, busy, problem, clear: () => setProblem(null) }
}
