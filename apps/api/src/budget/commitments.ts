import { and, asc, eq, sql } from 'drizzle-orm'
import type { FinanceCommitmentsResponse } from '@vada/contracts'
import type { Actor } from '../access/actor.js'
import { budgetItem, event, lineItem, record, request } from '../db/schema.js'
import type { Db } from '../db/types.js'
import { pickedPeriodOf } from './queries.js'
import { committedLine, paidFor } from './usage.js'

export async function financeCommitmentsOf(
  db: Pick<Db, 'select'>,
  actor: Actor,
  now: Date,
  periodId?: string,
): Promise<FinanceCommitmentsResponse> {
  const period = await pickedPeriodOf(db, actor, now, periodId)
  if (!period) return { items: [] }
  const rows = await db
    .select({
      id: lineItem.id,
      name: lineItem.name,
      requestId: request.id,
      requestTitle: request.title,
      eventId: event.id,
      eventName: event.name,
      budgetItemId: budgetItem.id,
      purpose: budgetItem.purpose,
      amount:
        sql<number>`coalesce(${lineItem.amount}, 0) - ${paidFor(lineItem.id, actor.councilId)}`.mapWith(
          Number,
        ),
    })
    .from(lineItem)
    .innerJoin(record, eq(record.id, lineItem.id))
    .innerJoin(request, eq(request.id, lineItem.requestId))
    .innerJoin(budgetItem, eq(budgetItem.id, lineItem.budgetItemId))
    .leftJoin(event, eq(event.id, request.eventId))
    .where(
      and(
        eq(record.councilId, actor.councilId),
        eq(budgetItem.budgetId, period.budgetId),
        committedLine(actor.councilId),
      ),
    )
    .orderBy(asc(record.createdAt), asc(lineItem.id))
  return {
    items: rows.map(({ eventId, eventName, budgetItemId, purpose, ...row }) => ({
      ...row,
      event: eventId && eventName ? { id: eventId, name: eventName } : null,
      budgetItem: { id: budgetItemId, purpose },
    })),
  }
}
