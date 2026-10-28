import { and, eq, inArray, isNull, sql, type SQL } from 'drizzle-orm'
import {
  deposit,
  expense,
  lineItem,
  record,
  registration,
  registrationForm,
  request,
} from '../db/schema.js'
import type { Db } from '../db/types.js'
import { refundPendingSql } from '../deposits/refund-pending.js'
import { expenseConditions, itemConditions } from './remaining.js'

type Reader = Pick<Db, 'select'>
type Scope = { councilId: string; eventIds: string[] }

// 한 지출에 빠진 것이 여럿이면 단건 정산처럼 각각 센다.
const countMatching = (...conditions: SQL[]) =>
  sql<number>`${sql.join(
    conditions.map(condition => sql`count(*) filter (where ${condition})`),
    sql` + `,
  )}`.mapWith(Number)

async function itemsByEvent(db: Reader, scope: Scope) {
  const { pending, unpaid } = itemConditions(db)
  return db
    .select({ eventId: request.eventId, count: countMatching(pending, unpaid) })
    .from(lineItem)
    .innerJoin(request, eq(request.id, lineItem.requestId))
    .innerJoin(record, eq(record.id, request.id))
    .where(
      and(
        eq(record.councilId, scope.councilId),
        inArray(request.eventId, scope.eventIds),
        isNull(request.cancelledAt),
      ),
    )
    .groupBy(request.eventId)
}

async function expensesByEvent(db: Reader, scope: Scope) {
  const { noEvidence, noReason, unreimbursed } = expenseConditions(db)
  return db
    .select({ eventId: expense.eventId, count: countMatching(noEvidence, noReason, unreimbursed) })
    .from(expense)
    .innerJoin(record, eq(record.id, expense.id))
    .where(
      and(
        eq(record.councilId, scope.councilId),
        inArray(expense.eventId, scope.eventIds),
        isNull(expense.cancelledAt),
      ),
    )
    .groupBy(expense.eventId)
}

async function refundsByEvent(db: Reader, scope: Scope) {
  return db
    .select({
      eventId: registrationForm.eventId,
      count: sql<number>`count(distinct ${registration.id})`.mapWith(Number),
    })
    .from(registration)
    .innerJoin(record, eq(record.id, registration.id))
    .innerJoin(registrationForm, eq(registrationForm.id, registration.formId))
    .innerJoin(deposit, eq(deposit.registrationId, registration.id))
    .where(
      and(
        eq(record.councilId, scope.councilId),
        inArray(registrationForm.eventId, scope.eventIds),
        refundPendingSql,
      ),
    )
    .groupBy(registrationForm.eventId)
}

// 카드에는 대상 목록이 필요 없어 행사 수와 관계없이 세 집계 쿼리로 합계만 읽는다.
export async function remainingCountsByEvent(db: Reader, scope: Scope) {
  const counts = new Map(scope.eventIds.map(id => [id, 0]))
  if (!scope.eventIds.length) return counts
  const groups = [
    await itemsByEvent(db, scope),
    await expensesByEvent(db, scope),
    await refundsByEvent(db, scope),
  ]
  for (const rows of groups)
    for (const row of rows)
      if (row.eventId) counts.set(row.eventId, (counts.get(row.eventId) ?? 0) + row.count)
  return counts
}
