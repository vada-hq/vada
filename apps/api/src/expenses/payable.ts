import { and, eq, inArray, sql } from 'drizzle-orm'
import type { Actor } from '../access/actor.js'
import { budgetItem, lineItem, record, request } from '../db/schema.js'
import type { Tx } from '../db/types.js'
import { ApiError } from '../http/errors.js'
import { completedEventIdsAmong } from '../policy/locks.js'
import { lastOutcomeOf } from '../purchases/last-outcome.js'
import { lineItemFactsOf, lineItemPayable } from '../purchases/policy.js'

// 결제할 수 있는 품목의 판정은 purchases/policy.ts의 lineItemPayable 한 곳이다(읽기의 payable과 같은 사실).
// 승인한 품목은 재정부가 취소할 수 있어 이 읽기 뒤에 바뀔 수 있지만, 품목 취소도 같은 학생회 행 잠금 아래에서 하므로 두 쓰기는 한 줄로 선다.
export async function assertPayable(tx: Tx, actor: Actor, lineItemIds: readonly string[]) {
  if (!lineItemIds.length) return
  const rows = await tx
    .select({
      outcome: sql<string | null>`${lastOutcomeOf(lineItem.id)}`,
      requestCancelledAt: request.cancelledAt,
      requestEventId: request.eventId,
      budgetEventId: budgetItem.eventId,
    })
    .from(lineItem)
    .innerJoin(request, eq(request.id, lineItem.requestId))
    .innerJoin(record, eq(record.id, lineItem.id))
    .leftJoin(budgetItem, eq(budgetItem.id, lineItem.budgetItemId))
    .where(and(inArray(lineItem.id, [...lineItemIds]), eq(record.councilId, actor.councilId)))
  const completed = await completedEventIdsAmong(tx, [
    ...new Set(
      rows.flatMap(row => [row.requestEventId, row.budgetEventId]).filter(id => id !== null),
    ),
  ])
  const payable = rows.filter(row =>
    lineItemPayable(
      lineItemFactsOf(
        {
          outcome: row.outcome,
          paid: false,
          requestCancelled: row.requestCancelledAt !== null,
          requestEventId: row.requestEventId,
          budgetEventId: row.budgetEventId,
        },
        completed,
      ),
    ),
  )
  if (payable.length !== lineItemIds.length) throw new ApiError('LINE_ITEM_NOT_PAYABLE')
}
