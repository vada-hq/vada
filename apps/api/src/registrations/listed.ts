import { and, isNotNull, isNull, or } from 'drizzle-orm'
import { deposit, registration } from '../db/schema.js'

// 신청자 목록에 남는 신청(DEC-55): 이름이 있고(기한이 지나 비우거나 환불해 비우지 않았다), 취소하지 않았거나 환불 전 입금이 남았다(환불 대기).
// 목록 조회(SQL)와 쓰기 응답의 listed(사실)가 이 파일의 두 모양으로 한 규칙을 쓴다. 입금 기록은 취소하지 않은 것만 본다.
export const listedFacts = (facts: {
  name: string | null
  cancelledAt: Date | null
  hasDeposit: boolean
  refundedAt: Date | null
}) =>
  facts.name !== null &&
  (facts.cancelledAt === null || (facts.hasDeposit && facts.refundedAt === null))

// SQL 쪽. 신청과 (취소하지 않은 입금에 이은) 입금이 같은 줄에 있을 때 쓴다.
export const listedSql = and(
  isNotNull(registration.name),
  or(isNull(registration.cancelledAt), and(isNotNull(deposit.id), isNull(deposit.refundedAt))),
)
