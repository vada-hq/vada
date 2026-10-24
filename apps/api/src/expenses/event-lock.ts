import { and, eq, inArray } from 'drizzle-orm'
import type { Actor } from '../access/actor.js'
import { budgetItemEventsOf } from '../budget/queries.js'
import { budgetItem, expense, lineItem, paymentLine, record, request } from '../db/schema.js'
import type { Db } from '../db/types.js'

type Reader = Pick<Db, 'select'>

// 품목에 매인 행사들: 품목을 낸 요청의 행사와 승인하며 고른 예산 항목의 행사. 이 학생회의 것만 본다.
// 그 품목을 결제하는 지출은 그 행사의 기록이라 완료한 행사에서는 적을 수 없다(DEC-68).
export async function eventsOfLines(db: Reader, actor: Actor, lineItemIds: readonly string[]) {
  if (!lineItemIds.length) return []
  const rows = await db
    .select({ requestEvent: request.eventId, itemEvent: budgetItem.eventId })
    .from(lineItem)
    .innerJoin(request, eq(request.id, lineItem.requestId))
    .innerJoin(record, eq(record.id, lineItem.id))
    .leftJoin(budgetItem, eq(budgetItem.id, lineItem.budgetItemId))
    .where(and(inArray(lineItem.id, [...lineItemIds]), eq(record.councilId, actor.councilId)))
  return rows.flatMap(row => [row.requestEvent, row.itemEvent])
}

// 품목을 낸 요청들의 행사만(예산 항목의 행사는 뺀다). 지출의 행사는 요청의 행사와 같게 지킨다(EVENT_MISMATCH).
export async function requestEventsOfLines(
  db: Reader,
  actor: Actor,
  lineItemIds: readonly string[],
) {
  if (!lineItemIds.length) return []
  const rows = await db
    .select({ eventId: request.eventId })
    .from(lineItem)
    .innerJoin(request, eq(request.id, lineItem.requestId))
    .innerJoin(record, eq(record.id, lineItem.id))
    .where(and(inArray(lineItem.id, [...lineItemIds]), eq(record.councilId, actor.councilId)))
  return rows.flatMap(row => (row.eventId ? [row.eventId] : []))
}

// 지출에 결제 내역으로 이어진 품목 요청들의 행사.
export async function requestEventsOfExpense(db: Reader, actor: Actor, expenseId: string) {
  const lines = await db
    .select({ lineItemId: paymentLine.lineItemId })
    .from(paymentLine)
    .where(eq(paymentLine.expenseId, expenseId))
  return requestEventsOfLines(
    db,
    actor,
    lines.map(line => line.lineItemId),
  )
}

// 지출 하나의 행사들: 지출에 적은 행사, 지출이 고른 예산 항목의 행사, 결제한 품목들의 행사.
// 지출의 행사는 요청의 행사와 같게 지키지만(조각 5) 그 전에 만든 지출도 같은 잠금을 받도록 모두 본다.
export async function eventsOfExpense(tx: Reader, actor: Actor, expenseId: string) {
  const [own] = await tx
    .select({ eventId: expense.eventId, budgetItemId: expense.budgetItemId })
    .from(expense)
    .where(eq(expense.id, expenseId))
  const lines = await tx
    .select({ lineItemId: paymentLine.lineItemId })
    .from(paymentLine)
    .where(eq(paymentLine.expenseId, expenseId))
  return [
    own?.eventId,
    ...(own?.budgetItemId ? await budgetItemEventsOf(tx, actor, [own.budgetItemId]) : []),
    ...(await eventsOfLines(
      tx,
      actor,
      lines.map(line => line.lineItemId),
    )),
  ]
}
