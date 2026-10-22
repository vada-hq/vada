import { statusOf, type CheckInResult } from '@vada/contracts'
import { postJson } from '@/lib/api'
import {
  PERMISSION_CHANGED,
  REGISTRATION_STAFF_ERRORS,
  REGISTRATION_STAFF_FAILED,
} from '@/lib/messages'
import type { EventDialogHandlers } from '@/events/useEventSubmit'
import { checkInPath } from './registration-api'

// 찍은 결과. 이름과 학번은 스캔한 운영진이 사람을 알아보도록 크게 보인다.
export type ScanOutcome =
  | { kind: 'checked' | 'already'; registrationId: string; name: string; studentId: string | null }
  | { kind: 'missing' }
  | { kind: 'failed'; message: string }

// QR 글자에서 꺼낸 해시로 출석을 보낸다. 403이면 부모가 닫고 이유를 보이므로 'lost'다.
export async function checkInByHash(
  councilId: string,
  eventId: string,
  tokenHash: string,
  handlers: EventDialogHandlers,
): Promise<ScanOutcome | 'lost'> {
  const result = await postJson<CheckInResult>(checkInPath(councilId, eventId), { tokenHash })
  if (result.ok) {
    const { registrationId, name, studentId, already } = result.data
    return { kind: already ? 'already' : 'checked', registrationId, name, studentId }
  }
  if (result.status === statusOf('FORBIDDEN')) {
    handlers.onForbidden()
    handlers.onLost(PERMISSION_CHANGED)
    return 'lost'
  }
  if (result.status === statusOf('NOT_FOUND')) return { kind: 'missing' }
  return {
    kind: 'failed',
    message: REGISTRATION_STAFF_ERRORS[result.code] ?? REGISTRATION_STAFF_FAILED,
  }
}
