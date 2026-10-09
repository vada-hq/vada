import { z } from 'zod'
import { text, token } from './input.js'
import { PURCHASE_INTEGER_MAX, purchaseDate } from './purchases.js'

export const EXPENSE_VENDOR_MAX = 100
export const EXPENSE_DESCRIPTION_MAX = 200
export const EXPENSE_NOTE_MAX = 200
export const EXPENSE_VOID_REASON_MAX = 200
export const EXPENSE_ITEMS_MAX = 50
export const RECEIPTS_PER_EXPENSE_MAX = 10
export const RECEIPT_FILE_NAME_MAX = 200
export const RECEIPT_SIZE_MAX = 10 * 1024 * 1024
export const EXPENSE_METHODS = ['council_card', 'transfer', 'cash', 'personal'] as const
export const RECEIPT_KINDS = ['receipt', 'statement', 'tax_invoice', 'other'] as const
export const RECEIPT_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf'] as const
export type ExpenseMethod = typeof EXPENSE_METHODS[number]
export type ReceiptKind = typeof RECEIPT_KINDS[number]
export type ReceiptContentType = typeof RECEIPT_CONTENT_TYPES[number]
export type ExpenseAction = 'created' | 'updated' | 'voided' | 'receipt_added' | 'receipt_removed'
// 화면과 엑셀이 같은 이름을 쓴다.
export const EXPENSE_METHOD_LABELS: Record<ExpenseMethod, string> = { council_card: '학생회 카드', transfer: '계좌이체', cash: '현금',
  personal: '개인 결제(환급 필요)' }
export const RECEIPT_KIND_LABELS: Record<ReceiptKind, string> = { receipt: '영수증', statement: '거래명세서', tax_invoice: '세금계산서', other: '기타' }

const id = token(64)
const version = z.number().int().min(1).max(PURCHASE_INTEGER_MAX)
// 결제일. 달력에 있는 날짜이고, DB 검사와 같은 범위만 받는다.
const expenseDate = purchaseDate.refine(value => value >= '2000-01-01' && value <= '2999-12-31')
const fields = {
  // null이면 상시 운영 지출이다.
  eventId: id.nullable(),
  vendor: text(EXPENSE_VENDOR_MAX),
  description: text(EXPENSE_DESCRIPTION_MAX),
  amount: z.number().int().min(0).max(PURCHASE_INTEGER_MAX),
  paidOn: expenseDate,
  method: z.enum(EXPENSE_METHODS),
  // 같은 학생회 소속(memberships.id)만 받는다. 서버가 사용자로 바꿔 저장한다.
  payerMembershipId: id,
  note: text(EXPENSE_NOTE_MAX).nullable(),
  itemIds: z.array(id).max(EXPENSE_ITEMS_MAX).refine(ids => new Set(ids).size === ids.length),
}
export const CreateExpenseSchema = z.strictObject(fields)
// 수정은 모든 칸을 다시 보낸다. 연결 품목도 바뀐 목록 전체다.
export const UpdateExpenseSchema = z.strictObject({ version, ...fields })
export const VoidExpenseSchema = z.strictObject({ version, reason: text(EXPENSE_VOID_REASON_MAX) })
export const CreateReceiptUploadSchema = z.strictObject({
  fileName: text(RECEIPT_FILE_NAME_MAX),
  contentType: z.enum(RECEIPT_CONTENT_TYPES),
  size: z.number().int().min(1).max(RECEIPT_SIZE_MAX),
  kind: z.enum(RECEIPT_KINDS),
})
// 영수증 확인·삭제는 경로로 대상을 정한다. 본문은 빈 객체만 받는다.
export const ReceiptActionSchema = z.strictObject({})

export type CreateExpenseRequest = z.infer<typeof CreateExpenseSchema>
export type UpdateExpenseRequest = z.infer<typeof UpdateExpenseSchema>
export type VoidExpenseRequest = z.infer<typeof VoidExpenseSchema>
export type CreateReceiptUploadRequest = z.infer<typeof CreateReceiptUploadSchema>

export interface ExpensePerson { id: string; name: string }
// 지출에 연결했거나 연결할 수 있는 승인 품목.
export interface ExpenseItem {
  id: string
  event: { id: string; name: string }
  productName: string | null
  quantity: number | null
  estimatedUnitPrice: number | null
  requester: ExpensePerson
  purchasedAt: string | null
}
export interface ExpenseSummary {
  id: string
  // null이면 상시 운영 지출이다.
  event: { id: string; name: string } | null
  vendor: string
  description: string
  amount: number
  paidOn: string
  method: ExpenseMethod
  payer: ExpensePerson
  // 수정 대화상자가 결제한 사람을 고를 때 쓴다. 학생회를 떠났으면 null이다.
  payerMembershipId: string | null
  note: string | null
  recordedBy: ExpensePerson
  items: ExpenseItem[]
  // 연결 품목의 수량 × 예상 단가 합. 품목이 없거나 값을 모르는 품목이 있으면 null이다.
  approvedTotal: number | null
  // 다 올라가 확인된 증빙 수.
  receiptCount: number
  evidence: 'complete' | 'missing'
  voided: { by: ExpensePerson; at: string; reason: string } | null
  // 행사 정산이 끝났으면 true다. 수정·취소·증빙 삭제를 막는다(증빙 추가는 된다).
  settled: boolean
  version: number
  createdAt: string
  updatedAt: string
}
export interface ReceiptSummary {
  id: string
  fileName: string
  contentType: ReceiptContentType
  size: number
  kind: ReceiptKind
  uploadedBy: ExpensePerson
  createdAt: string
}
export interface ExpenseHistoryEntry {
  id: string
  action: ExpenseAction
  actor: ExpensePerson
  changes: Record<string, unknown>
  createdAt: string
}
export interface ExpenseDetail extends ExpenseSummary {
  receipts: ReceiptSummary[]
  history: ExpenseHistoryEntry[]
}
export interface ExpensesResponse {
  expenses: ExpenseSummary[]
  truncated: boolean
  // 셋 다 취소한 지출을 뺀다. 이번 달은 한국 시간 기준이다.
  totals: { thisMonth: number; total: number; missingEvidence: number }
}
export interface ExpenseResponse { expense: ExpenseDetail }
export interface ReceiptUploadResponse {
  receiptId: string
  // 브라우저가 이 주소로 파일을 그대로 PUT한다. headers를 바꾸지 않고 보낸다.
  upload: { url: string; headers: Record<string, string> }
  expiresAt: string
}
export interface LinkableItemsResponse { items: ExpenseItem[]; truncated: boolean }
