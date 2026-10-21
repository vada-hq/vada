import { statusOf } from '@vada/contracts'
import { PERMISSION_CHANGED, TASK_ERRORS, TASK_FAILED, TASK_LOST } from '@/lib/messages'

// 업무 대화상자가 부모에게 알리는 일. 부모가 대화상자를 닫고 message를 보인다.
export type TaskDialogHandlers = {
  // 내가 바꾼 뒤 목록과 수를 다시 읽게 한다.
  onChanged: () => void
  // 대상이 사라졌거나(404) 권한을 잃었다(403). 부모가 대화상자를 닫고 이유를 보인다.
  onLost: (message: string) => void
  // 403이면 학생회를 다시 읽어 권한 목록을 새로 받는다.
  onForbidden: () => void
}

// 사라짐(404)이나 권한 잃음(403)이면 그 이유를, 그 밖의 실패면 null이다.
function lostMessage(status: number) {
  if (status === statusOf('NOT_FOUND')) return TASK_LOST
  if (status === statusOf('FORBIDDEN')) return PERMISSION_CHANGED
  return null
}

export const problemText = (code: string) => TASK_ERRORS[code] ?? TASK_FAILED

export function reportLost(
  handlers: Pick<TaskDialogHandlers, 'onLost' | 'onForbidden'>,
  status: number,
) {
  const message = lostMessage(status)
  if (message === null) return false
  if (status === statusOf('FORBIDDEN')) handlers.onForbidden()
  handlers.onLost(message)
  return true
}
