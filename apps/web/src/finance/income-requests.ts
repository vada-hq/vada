import { INCOME_ERRORS, INCOME_FAILED, INCOME_LOST } from '@/lib/income-messages'
import { reportLost, type PurchaseDialogHandlers } from './purchase-requests'

// 수입 대화상자가 부모에게 알리는 일은 구매 요청·지출 대화상자와 같다(바꾼 뒤 다시 읽기, 사라짐·권한 잃음).
export type IncomeDialogHandlers = PurchaseDialogHandlers

export const incomeProblem = (code: string) => INCOME_ERRORS[code] ?? INCOME_FAILED

// 사라짐이나 권한 잃음이면 부모에게 알리고 true다. 문구만 수입용이다.
export const reportIncomeLost = (
  handlers: Pick<IncomeDialogHandlers, 'onLost' | 'onForbidden'>,
  status: number,
) => reportLost(handlers, status, INCOME_LOST)

// 이미 바뀐 상태라 다시 읽어야 하는 거절(취소된 수입, 직접 취소할 수 없는 수입, 완료한 행사, 공개한 기간).
// 이때 서버가 주는 동작에서 취소가 빠진다.
const STALE_CODES = ['INCOME_CANCELLED', 'INCOME_AUTOMATIC', 'EVENT_COMPLETED', 'PERIOD_CLOSED']
export const isStale = (code: string) => STALE_CODES.includes(code)
