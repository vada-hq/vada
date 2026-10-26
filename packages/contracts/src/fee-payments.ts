import { z } from 'zod'
import { text, token } from './input.js'
import { koreanDate } from './korean-time.js'
import { STUDENT_ID_PATTERN } from './registrations.js'

// 학생회비 납부자 명단(DEC-26). 한 번에 붙여 넣는 학번 수와 학번 형식.
export const FEE_PAYMENT_BATCH_MAX = 20_000
const STUDENT_ID_MAX = 12
// 학번 하나와 구분 글자 둘(쉼표와 공백, 줄바꿈 등)을 센다. 20,000개가 이 안에 들어간다.
const SEPARATOR_ROOM = 2
export const FEE_PAYMENT_TEXT_MAX = FEE_PAYMENT_BATCH_MAX * (STUDENT_ID_MAX + SEPARATOR_ROOM)
// 형식이 틀린 줄을 알려 줄 때 돌려주는 줄 번호의 상한
export const INVALID_LINES_MAX = 100
export const FEE_PAYMENT_SEARCH_LIMIT = 50

export const AddFeePaymentsSchema = z
  .strictObject({
    paidFrom: koreanDate,
    paidUntil: koreanDate,
    // 줄바꿈·쉼표·공백으로 나눈 학번들
    students: text(FEE_PAYMENT_TEXT_MAX),
    // 같은 기간의 기존 명단을 바꾸는 확인을 거친 경우에만 보낸다.
    replace: z.boolean().optional(),
  })
  .refine(value => value.paidUntil >= value.paidFrom)
export type AddFeePaymentsRequest = z.infer<typeof AddFeePaymentsSchema>

export const RemoveFeePaymentSchema = z.strictObject({})

export const FeePaymentSearchSchema = z.strictObject({
  studentId: token(STUDENT_ID_MAX).regex(STUDENT_ID_PATTERN).optional(),
})

export type AddFeePaymentsResponse = { added: number; skipped: number }
// 형식이 틀린 학번이 있으면 아무것도 쓰지 않고 그 줄 번호(1부터)를 알려 준다.
export type InvalidFeePaymentsResponse = { error: 'INVALID_INPUT'; lines: number[] }
export type FeePaymentPeriod = { paidFrom: string; paidUntil: string; count: number }
export type FeePaymentMatch = { id: string; studentId: string; paidFrom: string; paidUntil: string }
export type FeePaymentsResponse = { periods: FeePaymentPeriod[]; matches: FeePaymentMatch[] }
