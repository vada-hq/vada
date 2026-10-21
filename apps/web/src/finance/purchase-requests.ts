import { statusOf } from '@vada/contracts'
import { PERMISSION_CHANGED, PURCHASE_ERRORS, PURCHASE_FAILED, PURCHASE_LOST } from '@/lib/messages'

// 구매 요청 대화상자가 부모에게 알리는 일. 부모가 대화상자를 닫고 message를 보인다.
export type PurchaseDialogHandlers = {
  // 내가 바꾼 뒤 목록과 수를 다시 읽게 한다.
  onChanged: () => void
  // 대상이 사라졌거나(404) 권한을 잃었다(403). 부모가 대화상자를 닫고 이유를 보인다.
  onLost: (message: string) => void
  // 403이면 학생회를 다시 읽어 권한 목록을 새로 받는다.
  onForbidden: () => void
}

function lostMessage(status: number, notFound: string) {
  if (status === statusOf('NOT_FOUND')) return notFound
  if (status === statusOf('FORBIDDEN')) return PERMISSION_CHANGED
  return null
}

export const problemText = (code: string) => PURCHASE_ERRORS[code] ?? PURCHASE_FAILED

// 사라짐이나 권한 잃음이면 부모에게 알리고 true, 그 밖의 실패면 false다.
export function reportLost(
  handlers: Pick<PurchaseDialogHandlers, 'onLost' | 'onForbidden'>,
  status: number,
  notFound = PURCHASE_LOST,
) {
  const message = lostMessage(status, notFound)
  if (message === null) return false
  if (status === statusOf('FORBIDDEN')) handlers.onForbidden()
  handlers.onLost(message)
  return true
}
