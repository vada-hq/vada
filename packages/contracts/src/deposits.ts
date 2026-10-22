import { z } from 'zod'
import { WON_MAX } from './budget.js'
import { text } from './input.js'
import { PURCHASE_REASON_MAX } from './purchases.js'

// 입금 확인과 환불함(기능 008, DEC-28, DEC-55). 금액은 정수 원이고 1원부터 10억 원까지다(입금 기록의 CHECK는 0 이상이라 API가 1원을 지킨다).
const won = z.number().int().min(1).max(WON_MAX)

// 금액을 빼면 서버가 신청의 적용 참가비로 채운다(적용 참가비가 0이면 400이라 금액을 적어야 한다).
export const ConfirmDepositSchema = z.strictObject({ amount: won.nullable().default(null) })
export type ConfirmDepositRequest = z.infer<typeof ConfirmDepositSchema>
// 확인 취소는 사유가 꼭 있다(판에 남는다).
export const CancelDepositSchema = z.strictObject({ reason: text(PURCHASE_REASON_MAX) })
export type CancelDepositRequest = z.infer<typeof CancelDepositSchema>
// 금액을 빼면 입금액 전부다. 입금액보다 크면 400이다.
export const RefundSchema = z.strictObject({ amount: won.nullable().default(null) })
export type RefundRequest = z.infer<typeof RefundSchema>

// 신청 하나의 입금 상태. 환불 대기는 취소한 신청에 환불 전 입금이 남은 것이다. 환불함은 이름이 비어 목록에 없고 응답에만 나온다.
export const DEPOSIT_STATUSES = ['none', 'confirmed', 'refund_pending', 'refunded'] as const
export type DepositStatus = (typeof DEPOSIT_STATUSES)[number]
export interface ApplicantDeposit {
  status: DepositStatus
  // 입금 금액. 입금이 없으면 null이다.
  amount: number | null
}
export interface DepositResponse {
  deposit: ApplicantDeposit
}

// 신청자 목록 거르기: 입금을 확인한 신청, 환불 대기 신청
export const APPLICANT_FILTERS = ['deposited', 'refund_pending'] as const
export type ApplicantFilter = (typeof APPLICANT_FILTERS)[number]
export const ApplicantsQuerySchema = z.strictObject({
  filter: z.enum(APPLICANT_FILTERS).optional(),
})
