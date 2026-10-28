import { and, asc, eq } from 'drizzle-orm'
import { type PurchaseDecision, type PurchaseRequestDetail } from '@vada/contracts'
import { shipmentChangeCode } from '../shipments/policy.js'
import { shipmentsOf } from '../shipments/queries.js'
import type { Actor } from '../access/actor.js'
import {
  approval,
  budgetItem,
  expense,
  lineItem,
  member,
  paymentLine,
  record,
  request,
} from '../db/schema.js'
import type { Db } from '../db/types.js'
import { ApiError } from '../http/errors.js'
import { requestHistoryOf } from './history.js'
import { lastOutcomeOf } from './last-outcome.js'
import { completedEventIdsAmong } from '../policy/locks.js'
import {
  actionsOf,
  factsOf,
  lineItemActionsOf,
  lineItemFactsOf,
  lineItemPayable,
} from './policy.js'
import { displayNameOf, recordCouncilSql } from '../team/display-name.js'
import { purchaseSourceMessage } from './source-message.js'
import { isPaid, summaryRows, summaryOf, type PurchaseSummaryRow as Row } from './summary.js'
export { isPaid } from './summary.js'
export { requestListOf } from './list.js'

type Reader = Pick<Db, 'select'>
// 이 학생회의 요청 하나. 다른 학생회의 요청은 없는 것과 같아 404다. 취소한 요청도 읽을 수 있다.
export async function requestRowOf(db: Reader, actor: Actor, requestId: string) {
  const [row] = await summaryRows(db, actor, {
    where: eq(request.id, requestId),
    order: [asc(request.id)],
    limit: 1,
  })
  if (!row) throw new ApiError('NOT_FOUND')
  return row
}

const itemRows = (db: Reader, requestId: string) =>
  db
    .select({
      id: lineItem.id,
      name: lineItem.name,
      quantity: lineItem.quantity,
      link: lineItem.link,
      options: lineItem.options,
      estimatedUnitPrice: lineItem.estimatedUnitPrice,
      estimatedShippingFee: lineItem.estimatedShippingFee,
      amount: lineItem.amount,
      budgetItemId: lineItem.budgetItemId,
      purpose: budgetItem.purpose,
      budgetEventId: budgetItem.eventId,
      outcome: lastOutcomeOf(lineItem.id),
      paid: isPaid.mapWith(Boolean),
    })
    .from(lineItem)
    .innerJoin(record, eq(record.id, lineItem.id))
    .leftJoin(budgetItem, eq(budgetItem.id, lineItem.budgetItemId))
    .where(eq(lineItem.requestId, requestId))
    .orderBy(asc(record.createdAt), asc(lineItem.id))

async function itemsOf(db: Reader, actor: Actor, row: Row) {
  const rows = await itemRows(db, row.id)
  // 쓰기와 같은 판정(decideLineItem)으로 품목 동작을 준다.
  const completed = await completedEventIdsAmong(db, [
    ...new Set([row.eventId, ...rows.map(item => item.budgetEventId)].filter(id => id !== null)),
  ])
  return rows.map(item => {
    const facts = lineItemFactsOf(
      {
        outcome: item.outcome,
        paid: item.paid,
        requestCancelled: row.cancelledAt !== null,
        requestEventId: row.eventId,
        budgetEventId: item.budgetEventId,
      },
      completed,
    )
    return {
      id: item.id,
      name: item.name,
      quantity: item.quantity,
      link: item.link,
      options: item.options,
      estimatedUnitPrice: item.estimatedUnitPrice === null ? null : Number(item.estimatedUnitPrice),
      estimatedShippingFee:
        item.estimatedShippingFee === null ? null : Number(item.estimatedShippingFee),
      amount: item.amount === null ? null : Number(item.amount),
      budgetItem:
        item.budgetItemId && item.purpose ? { id: item.budgetItemId, purpose: item.purpose } : null,
      status: facts.status,
      paid: item.paid,
      payable: lineItemPayable(facts),
      actions: lineItemActionsOf(actor, facts),
    }
  })
}

async function decisionsOf(db: Reader, requestId: string) {
  const rows = await db
    .select({
      id: approval.id,
      lineItemId: approval.targetId,
      outcome: approval.outcome,
      actorId: approval.actorId,
      actorName: displayNameOf(member, recordCouncilSql(requestId)),
      actedAt: approval.actedAt,
      reason: approval.reason,
    })
    .from(approval)
    .innerJoin(lineItem, and(eq(lineItem.id, approval.targetId), eq(lineItem.requestId, requestId)))
    .leftJoin(member, eq(member.id, approval.actorId))
    .where(and(eq(approval.targetKind, 'line_item'), eq(approval.actorKind, 'member')))
    .orderBy(asc(approval.actedAt), asc(approval.id))
  const decisions: PurchaseDecision[] = []
  for (const row of rows)
    if (row.outcome === 'approved' || row.outcome === 'rejected' || row.outcome === 'cancelled')
      decisions.push({
        id: row.id,
        lineItemId: row.lineItemId,
        outcome: row.outcome,
        by: row.actorName ? { id: row.actorId, name: row.actorName } : null,
        at: row.actedAt.toISOString(),
        reason: row.reason,
      })
  return decisions
}

// 이 요청의 품목을 결제한 지출. 취소된 지출도 표시를 달아 보인다.
async function expensesOf(db: Reader, requestId: string) {
  const rows = await db
    .select({
      id: expense.id,
      vendor: expense.vendor,
      amount: expense.amount,
      paidAt: expense.paidAt,
      cancelledAt: expense.cancelledAt,
    })
    .from(paymentLine)
    .innerJoin(lineItem, eq(lineItem.id, paymentLine.lineItemId))
    .innerJoin(expense, eq(expense.id, paymentLine.expenseId))
    .where(eq(lineItem.requestId, requestId))
    .groupBy(expense.id)
    .orderBy(asc(expense.paidAt), asc(expense.id))
  return rows.map(row => ({
    id: row.id,
    vendor: row.vendor,
    amount: Number(row.amount),
    paidAt: row.paidAt.toISOString(),
    cancelled: row.cancelledAt !== null,
  }))
}

export async function requestDetailOf(
  db: Reader,
  actor: Actor,
  requestId: string,
): Promise<PurchaseRequestDetail> {
  const row = await requestRowOf(db, actor, requestId)
  const decisions = await decisionsOf(db, requestId)
  const items = await itemsOf(db, actor, row)
  const facts = await factsOf(db, row)
  return {
    ...summaryOf(
      row,
      items.some(item => item.payable),
    ),
    body: row.body,
    sourceMessage: await purchaseSourceMessage(db, actor, requestId),
    items,
    decisions,
    expenses: await expensesOf(db, requestId),
    shipments: await shipmentsOf(db, actor, row),
    canAddShipment:
      shipmentChangeCode(actor, facts) === null && items.some(item => item.status === 'approved'),
    history: await requestHistoryOf(db, requestId),
    // 완료한 행사의 요청은 취소도 결재도 잠겨 있어 동작을 주지 않는다(DEC-68). 쓰기와 같은 decide다.
    actions: actionsOf(actor, facts),
  }
}
