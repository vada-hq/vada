import { z } from 'zod'
import { WON_MAX, type EventRef, type FiscalPeriodView } from './budget.js'
import { PHOTO_KEY_MAX } from './chat.js'
import { commandIdInput, EmptyRequestSchema, text, token } from './input.js'
import { koreanDate } from './korean-time.js'
import { PURCHASE_ITEMS_MAX, PURCHASE_REASON_MAX, type PurchasePerson } from './purchases.js'
import { recordIdInput } from './team.js'

// 지출(DEC-24, DEC-36, DEC-45). 값은 DB CHECK와 같다.
export const EXPENSE_VENDOR_MAX = 100
export const EXPENSE_DESCRIPTION_MAX = 200
export const EXPENSE_REASON_MAX = 1000
// 지출 목록은 결제일 최근 순 300개다. 넘치면 truncated다.
export const EXPENSE_LIST_LIMIT = 300

// 지출 하나에 붙일 수 있는 증빙 사진 수. 증빙 하나에 사진 하나다.
export const EVIDENCE_MAX = 20

export const EXPENSE_METHODS = ['card', 'transfer', 'cash'] as const
export type ExpenseMethod = (typeof EXPENSE_METHODS)[number]
export const EVIDENCE_TYPES = [
  'receipt',
  'statement',
  'tax_invoice',
  'card_statement',
  'transfer_confirmation',
  'item_photo',
  'site_photo',
  'stock_photo',
  'other',
] as const
export type EvidenceType = (typeof EVIDENCE_TYPES)[number]

const PaymentLineSchema = z.strictObject({
  lineItemId: recordIdInput,
  amount: z.number().int().min(1).max(WON_MAX),
})

const sumOf = (lines: { amount: number }[]) => lines.reduce((sum, line) => sum + line.amount, 0)

// 지출 적기. 요청을 거친 지출은 결제 내역(lines)만 두고, 요청 없는 지출만 예산 항목과 부탁한 사람을 고른다.
// 결제일이 오늘 뒤인지는 서버 시계로 본다(여기서는 날짜 형식만 본다).
export const CreateExpenseSchema = z
  .strictObject({
    // 화면이 보내기 전에 만드는 명령 번호(DEC-84). 같은 번호를 다시 보내면 지출은 하나만 남는다.
    commandId: commandIdInput,
    vendor: text(EXPENSE_VENDOR_MAX),
    description: text(EXPENSE_DESCRIPTION_MAX),
    amount: z.number().int().min(1).max(WON_MAX),
    paidOn: koreanDate,
    method: z.enum(EXPENSE_METHODS),
    // 비면 학생회 돈으로 냈다.
    paidBy: recordIdInput.nullable().default(null),
    reason: text(EXPENSE_REASON_MAX).nullable().default(null),
    budgetItemId: recordIdInput.nullable().default(null),
    // 결제 내역의 요청에 행사가 있으면 그 행사로 채우고, 다르게 주면 409 EVENT_MISMATCH다.
    eventId: recordIdInput.nullable().default(null),
    requestedBy: recordIdInput.nullable().default(null),
    // 돈이 나간 계좌. 닫지 않은 이 학생회의 계좌만 받는다.
    accountId: recordIdInput.nullable().default(null),
    // 이 지출의 근거가 된 메시지. 내가 지금 볼 수 있는 것만 된다. 응답에는 싣지 않는다.
    sourceMessageId: recordIdInput.nullable().default(null),
    lines: z.array(PaymentLineSchema).max(PURCHASE_ITEMS_MAX).default([]),
  })
  .refine(
    input =>
      new Set(input.lines.map(line => line.lineItemId)).size === input.lines.length &&
      (input.lines.length === 0 ||
        (input.budgetItemId === null &&
          input.requestedBy === null &&
          sumOf(input.lines) === input.amount)),
  )
export type CreateExpense = z.infer<typeof CreateExpenseSchema>

// 취소는 사유를 받아 판에 남긴다. 환급은 본문이 없다.
export const CancelExpenseSchema = z.strictObject({ reason: text(PURCHASE_REASON_MAX) })
export const ReimburseExpenseSchema = EmptyRequestSchema

// 사유와 행사 고치기(재정부, 정산 전). 칸을 빼면 그대로이고 null은 비운다. 하나는 꼭 있어야 한다.
export const UpdateExpenseSchema = z
  .strictObject({
    reason: text(EXPENSE_REASON_MAX).nullable().optional(),
    eventId: recordIdInput.nullable().optional(),
  })
  .refine(input => input.reason !== undefined || input.eventId !== undefined)
export type UpdateExpense = z.infer<typeof UpdateExpenseSchema>

// 행사를 주면 그 행사의 지출만 준다.
export const ExpenseListQuerySchema = z.strictObject({ event: recordIdInput.optional() })
export type ExpenseListQuery = z.infer<typeof ExpenseListQuerySchema>

// 증빙 붙이기. 키는 올리기 주소(POST uploads)가 준 것이고, 종류를 고르지 않으면 영수증이다.
export const AttachEvidenceSchema = z.strictObject({
  key: token(PHOTO_KEY_MAX),
  type: z.enum(EVIDENCE_TYPES).default('receipt'),
})
export type AttachEvidence = z.infer<typeof AttachEvidenceSchema>

// 대화 사진을 증빙으로 붙이기. 사진 번호는 대화 사진의 파일 번호이고, 서버가 저장소 안에서 복사한다.
export const AttachChatEvidenceSchema = z.strictObject({
  photoId: recordIdInput,
  type: z.enum(EVIDENCE_TYPES).default('receipt'),
})

// 지출마다 서버가 주는 할 수 있는 동작. 화면은 이것으로 버튼을 보이거나 숨긴다(DEC-38).
export const EXPENSE_ACTIONS = [
  'expense.cancel',
  'expense.reimburse',
  'expense.update',
  'expense.attach_evidence',
] as const
export type ExpenseAction = (typeof EXPENSE_ACTIONS)[number]

export interface ExpenseSummary {
  id: string
  vendor: string
  description: string
  amount: number
  // 결제일(한국 날짜 YYYY-MM-DD)
  paidOn: string
  method: ExpenseMethod
  paidBy: PurchasePerson | null
  // 먼저 낸 사람이 있고 환급했다.
  reimbursed: boolean
  evidenceCount: number
  cancelled: boolean
  event: EventRef | null
}

export interface ExpensePaymentLine {
  lineItemId: string
  name: string
  amount: number
  requestId: string
  requestTitle: string
  // 승인할 때 정한 품목의 예산 항목 이름
  budgetPurpose: string | null
}

export interface ExpenseEvidence {
  id: string
  type: EvidenceType
  // 사진 보기 `GET expenses/:expenseId/files/:fileId`의 번호
  fileId: string
}

export interface ExpenseApproval {
  id: string
  by: PurchasePerson | null
  at: string
  outcome: 'approved' | 'rejected'
}

export type ExpenseChange =
  | { field: 'created' }
  | { field: 'cancelled' }
  | { field: 'reimbursed' }
  | { field: 'reason' }
  | { field: 'event' }

export interface ExpenseVersion {
  versionNo: number
  at: string
  by: PurchasePerson | null
  changes: ExpenseChange[]
  // 취소할 때 받은 사유
  reason: string | null
}

export interface ExpenseDetail extends ExpenseSummary {
  reason: string | null
  requestedBy: PurchasePerson | null
  budgetItem: { id: string; purpose: string } | null
  // 돈이 나간 계좌. 닫은 계좌도 이름이 보인다.
  account: { id: string; name: string } | null
  lines: ExpensePaymentLine[]
  evidence: ExpenseEvidence[]
  approvals: ExpenseApproval[]
  // 오래된 판부터 모두
  history: ExpenseVersion[]
  actions: ExpenseAction[]
}

export interface ExpensesResponse {
  expenses: ExpenseSummary[]
  truncated: boolean
  // 이전 배포에서 이미 받은 목록도 열 수 있다. 새 서버는 두 값을 항상 준다.
  allocations?: ExpenseAllocation[]
  periods?: FiscalPeriodView[]
}
// 목록에 받은 지출의 예산 배분. 결제일과 다른 기간의 항목도 그대로 준다(DEC-92).
export interface ExpenseAllocation {
  expenseId: string
  budgetItemId: string
  purpose: string
  periodId: string
  amount: number
}
export interface ExpenseResponse {
  expense: ExpenseDetail
}
