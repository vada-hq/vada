import { and, isNotNull, isNull } from 'drizzle-orm'
import { deposit, registration } from '../db/schema.js'

// 환불 대기(DEC-55): 취소한 신청에 취소하지 않은 입금 기록이 있고 환불 전이다. 이 규칙은 여기 한 곳이다.
// 입금 기록은 취소하지 않은 것만 이 조건에 들어온다고 보고 부른다(조회가 그것만 읽는다).
export const refundPendingFacts = (facts: {
  registrationCancelledAt: Date | null
  hasDeposit: boolean
  refundedAt: Date | null
}) => facts.registrationCancelledAt !== null && facts.hasDeposit && facts.refundedAt === null

// SQL 쪽. 신청과 (취소하지 않은 입금에 이은) 입금이 같은 줄에 있을 때 쓴다.
export const refundPendingSql = and(
  isNotNull(registration.cancelledAt),
  isNotNull(deposit.id),
  isNull(deposit.cancelledAt),
  isNull(deposit.refundedAt),
)
