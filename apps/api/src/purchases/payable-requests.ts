import { and, eq, inArray, sql } from 'drizzle-orm'
import { budgetItem, lineItem } from '../db/schema.js'
import type { Db } from '../db/types.js'
import { completedEventIdsAmong } from '../policy/locks.js'
import { lastOutcomeOf } from './last-outcome.js'
import { lineItemFactsOf, lineItemPayable } from './policy.js'

type Reader = Pick<Db, 'select'>

// 결제할 수 있는 품목이 하나라도 있는 요청들(지출의 '결제할 요청' 고르기). 품목 하나의 판정(lineItemPayable)을 그대로 쓴다.
export async function payableRequestIds(
  db: Reader,
  requests: readonly { id: string; eventId: string | null; cancelledAt: Date | null }[],
): Promise<Set<string>> {
  const open = requests.filter(request => request.cancelledAt === null)
  if (!open.length) return new Set()
  const approved = await db
    .select({ requestId: lineItem.requestId, budgetEventId: budgetItem.eventId })
    .from(lineItem)
    .leftJoin(budgetItem, eq(budgetItem.id, lineItem.budgetItemId))
    .where(
      and(
        inArray(
          lineItem.requestId,
          open.map(request => request.id),
        ),
        sql`${lastOutcomeOf(lineItem.id)} = 'approved'`,
      ),
    )
  const completed = await completedEventIdsAmong(db, [
    ...new Set(
      [...open.map(request => request.eventId), ...approved.map(item => item.budgetEventId)].filter(
        id => id !== null,
      ),
    ),
  ])
  const eventOf = new Map(open.map(request => [request.id, request.eventId]))
  return new Set(
    approved
      .filter(item =>
        lineItemPayable(
          lineItemFactsOf(
            {
              outcome: 'approved',
              paid: false,
              requestCancelled: false,
              requestEventId: eventOf.get(item.requestId) ?? null,
              budgetEventId: item.budgetEventId,
            },
            completed,
          ),
        ),
      )
      .map(item => item.requestId),
  )
}
