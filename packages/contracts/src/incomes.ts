import { z } from 'zod'
import type { ExpensePerson } from './expenses.js'
import { text, token } from './input.js'
import { PURCHASE_INTEGER_MAX, purchaseDate } from './purchases.js'

export const INCOME_DESCRIPTION_MAX = 100
export const INCOME_NOTE_MAX = 200
export const INCOME_VOID_REASON_MAX = 200
// 예산 화면의 수입 내역은 이만큼까지 준다.
export const INCOME_RECORDS_MAX = 300
export type IncomeAction = 'created' | 'updated' | 'voided'

const id = token(64)
const version = z.number().int().min(1).max(PURCHASE_INTEGER_MAX)
// 받은 날. 달력에 있는 날짜이고, DB 검사와 같은 범위만 받는다. 기간 안인지는 서버가 본다.
const receivedOn = purchaseDate.refine(value => value >= '2000-01-01' && value <= '2999-12-31')
// 통장에 들어온 돈 한 건. 수입 항목과 메모는 비울 때도 null로 꼭 보낸다.
const fields = {
  description: text(INCOME_DESCRIPTION_MAX),
  amount: z.number().int().min(1).max(PURCHASE_INTEGER_MAX),
  receivedOn,
  // 그 기간의 수입 줄. 고르지 않으면 null이다.
  budgetLineId: id.nullable(),
  note: text(INCOME_NOTE_MAX).nullable(),
}
export const CreateIncomeSchema = z.strictObject(fields)
// 수정은 모든 칸을 다시 보낸다.
export const UpdateIncomeSchema = z.strictObject({ version, ...fields })
export const VoidIncomeSchema = z.strictObject({ version, reason: text(INCOME_VOID_REASON_MAX) })
export type CreateIncomeRequest = z.infer<typeof CreateIncomeSchema>
export type UpdateIncomeRequest = z.infer<typeof UpdateIncomeSchema>
export type VoidIncomeRequest = z.infer<typeof VoidIncomeSchema>

export interface IncomeSummary {
  id: string
  // 그 기간의 수입 줄. 없으면 null이다.
  budgetLine: { id: string; name: string } | null
  description: string
  amount: number
  receivedOn: string
  note: string | null
  recordedBy: ExpensePerson
  voided: { by: ExpensePerson; at: string; reason: string } | null
  version: number
  createdAt: string
  updatedAt: string
}
export interface IncomeHistoryEntry {
  id: string
  action: IncomeAction
  actor: ExpensePerson
  // updated: 바뀐 칸마다 { from, to }(수입 항목은 이름), voided: { reason }
  changes: Record<string, unknown>
  createdAt: string
}
export interface IncomeDetail extends IncomeSummary {
  // 오래된 순
  history: IncomeHistoryEntry[]
}
export interface IncomeResponse { income: IncomeDetail }
