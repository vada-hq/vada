import { EXPENSE_ERRORS, EXPENSE_FAILED, EXPENSE_LOST } from '@/lib/messages'
import { reportLost, type PurchaseDialogHandlers } from './purchase-requests'

// 지출 대화상자가 부모에게 알리는 일은 구매 요청 대화상자와 같다(바꾼 뒤 다시 읽기, 사라짐·권한 잃음).
export type ExpenseDialogHandlers = PurchaseDialogHandlers

export const expenseProblem = (code: string) => EXPENSE_ERRORS[code] ?? EXPENSE_FAILED

// 지출 적기의 409 MESSAGE_INVALID는 근거 메시지 이야기라 사진 고르기·붙이기와 문구가 다르다.
const EXPENSE_CREATE_ERRORS: Record<string, string> = {
  ...EXPENSE_ERRORS,
  MESSAGE_INVALID:
    '이 메시지를 근거로 할 수 없어요. 볼 수 없는 대화의 메시지예요. 닫고 대화에서 다시 열어 주세요.',
}
export const expenseCreateProblem = (code: string) => EXPENSE_CREATE_ERRORS[code] ?? EXPENSE_FAILED

// 대화 사진을 증빙으로 붙일 때(사진 고르기, 메시지의 사진). 올린 파일이 아니라 대화의 사진이라 다시 올리라고 하지 않는다.
const CHAT_EVIDENCE_ERRORS: Record<string, string> = {
  ...EXPENSE_ERRORS,
  UPLOAD_MISMATCH: '이 사진은 증빙으로 붙일 수 없는 파일이에요. 다른 사진을 골라 주세요.',
}
export const chatEvidenceProblem = (code: string) => CHAT_EVIDENCE_ERRORS[code] ?? EXPENSE_FAILED

// 사라짐이나 권한 잃음이면 부모에게 알리고 true다. 문구만 지출용이다.
export const reportExpenseLost = (
  handlers: Pick<ExpenseDialogHandlers, 'onLost' | 'onForbidden'>,
  status: number,
) => reportLost(handlers, status, EXPENSE_LOST)

// 이미 바뀐 상태라 다시 읽어야 하는 거절(취소된 지출, 환급할 수 없음, 완료한 행사).
const STALE_CODES = ['EXPENSE_CANCELLED', 'NOT_REIMBURSABLE', 'EVIDENCE_LIMIT', 'EVENT_COMPLETED']
export const isStale = (code: string) => STALE_CODES.includes(code)
