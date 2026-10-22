import { and, eq, isNull } from 'drizzle-orm'
import { deposit } from '../db/schema.js'
import type { Db } from '../db/types.js'

// 신청의 취소하지 않은 입금 기록(부분 유일 인덱스라 많아야 하나). 환불했으면 refundedAt이 있다.
export async function activeDepositOf(db: Pick<Db, 'select'>, registrationId: string) {
  const [row] = await db
    .select({ id: deposit.id, amount: deposit.amount, refundedAt: deposit.refundedAt })
    .from(deposit)
    .where(and(eq(deposit.registrationId, registrationId), isNull(deposit.cancelledAt)))
  return row ? { id: row.id, amount: Number(row.amount), refundedAt: row.refundedAt } : null
}
