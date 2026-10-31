import { z } from 'zod'
import { WON_MAX } from './budget.js'
import { commandIdInput, text } from './input.js'
import { koreanDate } from './korean-time.js'
import { PURCHASE_REASON_MAX, type PurchasePerson } from './purchases.js'
import { recordIdInput } from './team.js'

// 수입(DEC-45). 값은 DB CHECK와 같다.
export const INCOME_DESCRIPTION_MAX = 200
// 수입 목록은 기간마다 받은 날 최근 순 300개다. 넘치면 truncated다.
export const INCOME_LIST_LIMIT = 300

// 사람이 적는 출처. 참가비(행사 완료 때)와 이월금(결산 공개 때)은 서버가 만든다.
export const INCOME_SOURCES = ['fee', 'grant', 'business', 'donation', 'other'] as const
export const INCOME_AUTOMATIC_SOURCES = ['participation_fee', 'carryover'] as const
export type IncomeSource =
  (typeof INCOME_SOURCES)[number] | (typeof INCOME_AUTOMATIC_SOURCES)[number]

// 수입 적기. 기간은 받은 날로 서버가 고른다. 받은 날이 오늘(한국) 뒤인지는 서버 시계로 본다.
export const CreateIncomeSchema = z.strictObject({
  // 화면이 보내기 전에 만드는 명령 번호(DEC-84). 같은 번호를 다시 보내면 수입은 하나만 남는다.
  // 배포 전에 연 화면은 번호를 보내지 않으므로, 그 탭이 사라질 때까지 비워도 받는다. 그 뒤 필수로 바꾼다.
  commandId: commandIdInput.optional(),
  source: z.enum(INCOME_SOURCES),
  amount: z.number().int().min(1).max(WON_MAX),
  receivedOn: koreanDate,
  description: text(INCOME_DESCRIPTION_MAX).nullable().default(null),
  // 받은 날이 든 기간의 수입 예산 항목
  budgetItemId: recordIdInput.nullable().default(null),
  // 닫지 않은 이 학생회의 계좌
  accountId: recordIdInput.nullable().default(null),
})
export type CreateIncome = z.infer<typeof CreateIncomeSchema>

// 고치지 않고 사유와 함께 취소한다. 사유는 판에 남는다.
export const CancelIncomeSchema = z.strictObject({ reason: text(PURCHASE_REASON_MAX) })

export const IncomeListQuerySchema = z.strictObject({ period: recordIdInput })
export type IncomeListQuery = z.infer<typeof IncomeListQuerySchema>

// 수입마다 서버가 주는 할 수 있는 동작. 화면은 이것으로 버튼을 보이거나 숨긴다(DEC-38).
export const INCOME_ACTIONS = ['income.cancel'] as const
export type IncomeAction = (typeof INCOME_ACTIONS)[number]

export interface IncomeSummary {
  id: string
  source: IncomeSource
  amount: number
  // 받은 날(한국 날짜 YYYY-MM-DD)
  receivedOn: string
  description: string | null
  budgetItem: { id: string; purpose: string } | null
  // 닫은 계좌도 이름이 보인다.
  account: { id: string; name: string } | null
  // 적은 사람. 행사 완료로 생긴 참가비 수입은 완료한 사람이다.
  createdBy: PurchasePerson | null
  cancelled: boolean
}

export type IncomeChange = { field: 'created' } | { field: 'cancelled' }

export interface IncomeVersion {
  versionNo: number
  at: string
  by: PurchasePerson | null
  changes: IncomeChange[]
  // 취소할 때 받은 사유
  reason: string | null
}

export interface IncomeDetail extends IncomeSummary {
  period: { id: string; name: string }
  // 오래된 판부터 모두
  history: IncomeVersion[]
  actions: IncomeAction[]
}

export interface IncomesResponse {
  incomes: IncomeSummary[]
  truncated: boolean
}
export interface IncomeResponse {
  income: IncomeDetail
}
