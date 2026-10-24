import { and, eq, inArray, isNull, sql } from 'drizzle-orm'
import type { Actor } from '../access/actor.js'
import { lineItem, record, request } from '../db/schema.js'
import type { Tx } from '../db/types.js'
import { ApiError } from '../http/errors.js'
import { lastOutcomeOf } from '../purchases/last-outcome.js'

// 결제할 수 있는 품목은 이 학생회의 취소되지 않은 요청에서 마지막 결과가 승인인 것이다(취소한 품목은 아니다).
// 승인한 품목은 재정부가 취소할 수 있어 이 읽기 뒤에 바뀔 수 있지만, 품목 취소도 같은 학생회 행 잠금 아래에서 하므로 두 쓰기는 한 줄로 선다.
export async function assertPayable(tx: Tx, actor: Actor, lineItemIds: readonly string[]) {
  if (!lineItemIds.length) return
  const rows = await tx
    .select({ id: lineItem.id })
    .from(lineItem)
    .innerJoin(request, and(eq(request.id, lineItem.requestId), isNull(request.cancelledAt)))
    .innerJoin(record, eq(record.id, lineItem.id))
    .where(
      and(
        inArray(lineItem.id, [...lineItemIds]),
        eq(record.councilId, actor.councilId),
        sql`${lastOutcomeOf(lineItem.id)} = 'approved'`,
      ),
    )
  if (rows.length !== lineItemIds.length) throw new ApiError('LINE_ITEM_NOT_PAYABLE')
}
