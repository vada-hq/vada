import { EXPENSE_ERRORS, EXPENSE_FAILED, EXPENSE_LOST } from '@/lib/messages'
import { reportLost, type PurchaseDialogHandlers } from './purchase-requests'

// 지출 대화상자가 부모에게 알리는 일은 구매 요청 대화상자와 같다(바꾼 뒤 다시 읽기, 사라짐·권한 잃음).
export type ExpenseDialogHandlers = PurchaseDialogHandlers

export const expenseProblem = (code: string) => EXPENSE_ERRORS[code] ?? EXPENSE_FAILED

// 사라짐이나 권한 잃음이면 부모에게 알리고 true다. 문구만 지출용이다.
export const reportExpenseLost = (
  handlers: Pick<ExpenseDialogHandlers, 'onLost' | 'onForbidden'>,
  status: number,
) => reportLost(handlers, status, EXPENSE_LOST)

// 이미 바뀐 상태라 다시 읽어야 하는 거절(취소된 지출, 환급할 수 없음).
const STALE_CODES = ['EXPENSE_CANCELLED', 'NOT_REIMBURSABLE', 'EVIDENCE_LIMIT']
export const isStale = (code: string) => STALE_CODES.includes(code)
