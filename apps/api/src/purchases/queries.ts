import { and, asc, desc, eq, isNull, sql, type SQL } from 'drizzle-orm'
import {
  PURCHASE_PENDING_LIMIT,
  PURCHASE_RECENT_LIMIT,
  type PurchaseDecision,
  type PurchaseRequestDetail,
  type PurchaseRequestListQuery,
  type PurchaseRequestSummary,
  type PurchaseRequestsResponse,
} from '@vada/contracts'
import type { Actor } from '../access/actor.js'
import {
  approval,
  budgetItem,
  event,
  expense,
  lineItem,
  member,
  paymentLine,
  record,
  request,
} from '../db/schema.js'
import type { Db } from '../db/types.js'
import { eventRowOf } from '../events/queries.js'
import { ApiError } from '../http/errors.js'
import { requestHistoryOf } from './history.js'
import { payableRequestIds } from './payable-requests.js'
import { itemCountColumns, lastOutcomeOf } from './last-outcome.js'
import { completedEventIdsAmong } from '../policy/locks.js'
import {
  actionsOf,
  factsOf,
  lineItemActionsOf,
  lineItemFactsOf,
  lineItemPayable,
  requestStatusOf,
} from './policy.js'
import { displayNameOf, joinedDisplayNameOf, recordCouncilSql } from '../team/display-name.js'

type Reader = Pick<Db, 'select'>

// 요청 줄과 품목·결재 수. 학생회 경계는 기록의 학생회 번호로 건다. 기본 키로 묶어 다른 표의 칸은 그 기본 키에 딸린 값이다.
function summaryRows(
  db: Reader,
  actor: Actor,
  options: { where?: SQL | undefined; having?: SQL | undefined; order: SQL[]; limit: number },
) {
  return db
    .select({
      id: request.id,
      title: request.title,
      body: request.body,
      neededBy: request.neededBy,
      cancelledAt: request.cancelledAt,
      eventId: request.eventId,
      eventName: event.name,
      requestedBy: request.requestedBy,
      requesterName: joinedDisplayNameOf(member, record.councilId),
      createdAt: record.createdAt,
      ...itemCountColumns(),
    })
    .from(request)
    .innerJoin(record, eq(record.id, request.id))
    .innerJoin(member, eq(member.id, request.requestedBy))
    .innerJoin(lineItem, eq(lineItem.requestId, request.id))
    .leftJoin(event, eq(event.id, request.eventId))
    .where(and(eq(record.councilId, actor.councilId), options.where))
    .groupBy(request.id, record.id, member.id, event.id)
    .having(options.having)
    .orderBy(...options.order)
    .limit(options.limit)
}
type Row = Awaited<ReturnType<typeof summaryRows>>[number]

const statusOfRow = (row: Row) => requestStatusOf(row.cancelledAt !== null, row)

function summaryOf(row: Row, payable: boolean): PurchaseRequestSummary {
  return {
    id: row.id,
    title: row.title,
    status: statusOfRow(row),
    requestedBy: { id: row.requestedBy, name: row.requesterName },
    neededBy: row.neededBy,
    itemCount: row.items,
    createdAt: row.createdAt.toISOString(),
    event: row.eventId && row.eventName ? { id: row.eventId, name: row.eventName } : null,
    payable,
  }
}

// 결재 대기는 오래된 순이고 취소된 요청은 뺀다. 내 요청과 전체는 최근 순이다. 한 개 더 읽어 넘쳤는지 안다.
function listOptions(actor: Actor, view: PurchaseRequestListQuery['view']) {
  if (view === 'pending')
    return {
      where: isNull(request.cancelledAt),
      having: sql`count(*) filter (where ${lastOutcomeOf(lineItem.id)} is null) > 0`,
      order: [asc(record.createdAt), asc(request.id)],
      limit: PURCHASE_PENDING_LIMIT,
    }
  return {
    where: view === 'mine' ? eq(request.requestedBy, actor.memberId) : undefined,
    having: undefined,
    order: [desc(record.createdAt), desc(request.id)],
    limit: PURCHASE_RECENT_LIMIT,
  }
}

export async function requestListOf(
  db: Reader,
  actor: Actor,
  query: PurchaseRequestListQuery,
): Promise<PurchaseRequestsResponse> {
  const options = listOptions(actor, query.view)
  // 다른 학생회 행사는 없는 것과 같아 404다.
  if (query.event) await eventRowOf(db, actor, query.event)
  const where = query.event ? and(options.where, eq(request.eventId, query.event)) : options.where
  const rows = await summaryRows(db, actor, { ...options, where, limit: options.limit + 1 })
  const shown = rows.slice(0, options.limit)
  const payable = await payableRequestIds(db, shown)
  return {
    requests: shown.map(row => summaryOf(row, payable.has(row.id))),
    truncated: rows.length > options.limit,
  }
}

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

// 취소되지 않은 결제 내역이 있는 품목은 '결제함'이다(DEC-24).
export const isPaid = sql<boolean>`exists (select 1 from ${paymentLine} inner join ${expense} on ${expense.id} = ${paymentLine.expenseId} where ${paymentLine.lineItemId} = ${lineItem.id} and ${expense.cancelledAt} is null)`

async function itemsOf(db: Reader, actor: Actor, row: Row) {
  const rows = await db
    .select({
      id: lineItem.id,
      name: lineItem.name,
      quantity: lineItem.quantity,
      link: lineItem.link,
      options: lineItem.options,
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
    .where(eq(lineItem.requestId, row.id))
    .orderBy(asc(record.createdAt), asc(lineItem.id))
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
  return {
    ...summaryOf(
      row,
      items.some(item => item.payable),
    ),
    body: row.body,
    items,
    decisions,
    expenses: await expensesOf(db, requestId),
    history: await requestHistoryOf(db, requestId),
    // 완료한 행사의 요청은 취소도 결재도 잠겨 있어 동작을 주지 않는다(DEC-68). 쓰기와 같은 decide다.
    actions: actionsOf(actor, await factsOf(db, row)),
  }
}
