import { z } from 'zod'
import { WON_MAX } from './budget.js'
import { EmptyRequestSchema, text } from './input.js'
import { koreanDate } from './korean-time.js'
import { PURCHASE_ITEMS_MAX, PURCHASE_REASON_MAX, type PurchasePerson } from './purchases.js'
import { recordIdInput } from './team.js'

// 지출(DEC-24, DEC-36, DEC-45). 값은 DB CHECK와 같다.
export const EXPENSE_VENDOR_MAX = 100
export const EXPENSE_DESCRIPTION_MAX = 200
export const EXPENSE_REASON_MAX = 1000
// 지출 목록은 결제일 최근 순 300개다. 넘치면 truncated다.
export const EXPENSE_LIST_LIMIT = 300

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
    vendor: text(EXPENSE_VENDOR_MAX),
    description: text(EXPENSE_DESCRIPTION_MAX),
    amount: z.number().int().min(1).max(WON_MAX),
    paidOn: koreanDate,
    method: z.enum(EXPENSE_METHODS).default('card'),
    // 비면 학생회 돈으로 냈다.
    paidBy: recordIdInput.nullable().default(null),
    reason: text(EXPENSE_REASON_MAX).nullable().default(null),
    budgetItemId: recordIdInput.nullable().default(null),
    requestedBy: recordIdInput.nullable().default(null),
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

// 지출마다 서버가 주는 할 수 있는 동작. 화면은 이것으로 버튼을 보이거나 숨긴다(DEC-38).
export const EXPENSE_ACTIONS = ['expense.cancel', 'expense.reimburse'] as const
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
}

export interface ExpensePaymentLine {
  lineItemId: string
  name: string
  amount: number
  requestId: string
  requestTitle: string
}

export interface ExpenseEvidence {
  id: string
  type: EvidenceType
}

export interface ExpenseApproval {
  id: string
  by: PurchasePerson | null
  at: string
  outcome: 'approved' | 'rejected'
}

export type ExpenseChange = { field: 'created' } | { field: 'cancelled' } | { field: 'reimbursed' }

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
}
export interface ExpenseResponse {
  expense: ExpenseDetail
}
