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
import { actionsOf, lineItemStatusOf, requestStatusOf } from './status.js'

type Reader = Pick<Db, 'select'>

// 품목마다 결재는 한 번이라(되돌리지 않는다) 품목에 붙는 결재 줄은 많아야 하나다.
export const decidedOn = and(
  eq(approval.targetId, lineItem.id),
  eq(approval.targetKind, 'line_item'),
)
export const decidedAs = (outcome: 'approved' | 'rejected') =>
  sql<number>`count(${approval.id}) filter (where ${approval.outcome} = ${outcome})`.mapWith(Number)

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
      requesterName: member.name,
      createdAt: record.createdAt,
      items: sql<number>`count(distinct ${lineItem.id})`.mapWith(Number),
      approved: decidedAs('approved'),
      rejected: decidedAs('rejected'),
    })
    .from(request)
    .innerJoin(record, eq(record.id, request.id))
    .innerJoin(member, eq(member.id, request.requestedBy))
    .innerJoin(lineItem, eq(lineItem.requestId, request.id))
    .leftJoin(approval, decidedOn)
    .leftJoin(event, eq(event.id, request.eventId))
    .where(and(eq(record.councilId, actor.councilId), options.where))
    .groupBy(request.id, record.id, member.id, event.id)
    .having(options.having)
    .orderBy(...options.order)
    .limit(options.limit)
}
type Row = Awaited<ReturnType<typeof summaryRows>>[number]

const statusOfRow = (row: Row) => requestStatusOf(row.cancelledAt !== null, row)

function summaryOf(row: Row): PurchaseRequestSummary {
  return {
    id: row.id,
    title: row.title,
    status: statusOfRow(row),
    requestedBy: { id: row.requestedBy, name: row.requesterName },
    neededBy: row.neededBy,
    itemCount: row.items,
    createdAt: row.createdAt.toISOString(),
    event: row.eventId && row.eventName ? { id: row.eventId, name: row.eventName } : null,
  }
}

// 결재 대기는 오래된 순이고 취소된 요청은 뺀다. 내 요청과 전체는 최근 순이다. 한 개 더 읽어 넘쳤는지 안다.
function listOptions(actor: Actor, view: PurchaseRequestListQuery['view']) {
  if (view === 'pending')
    return {
      where: isNull(request.cancelledAt),
      having: sql`count(distinct ${lineItem.id}) > count(${approval.id})`,
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
  return {
    requests: rows.slice(0, options.limit).map(summaryOf),
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
const isPaid = sql<boolean>`exists (select 1 from ${paymentLine} inner join ${expense} on ${expense.id} = ${paymentLine.expenseId} where ${paymentLine.lineItemId} = ${lineItem.id} and ${expense.cancelledAt} is null)`

async function itemsOf(db: Reader, requestId: string) {
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
      outcome: approval.outcome,
      paid: isPaid.mapWith(Boolean),
    })
    .from(lineItem)
    .innerJoin(record, eq(record.id, lineItem.id))
    .leftJoin(budgetItem, eq(budgetItem.id, lineItem.budgetItemId))
    .leftJoin(approval, decidedOn)
    .where(eq(lineItem.requestId, requestId))
    .orderBy(asc(record.createdAt), asc(lineItem.id))
  return rows.map(row => ({
    id: row.id,
    name: row.name,
    quantity: row.quantity,
    link: row.link,
    options: row.options,
    amount: row.amount === null ? null : Number(row.amount),
    budgetItem:
      row.budgetItemId && row.purpose ? { id: row.budgetItemId, purpose: row.purpose } : null,
    status: lineItemStatusOf(row.outcome),
    paid: row.paid,
  }))
}

async function decisionsOf(db: Reader, requestId: string) {
  const rows = await db
    .select({
      id: approval.id,
      lineItemId: approval.targetId,
      outcome: approval.outcome,
      actorId: approval.actorId,
      actorName: member.name,
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
    if (row.outcome === 'approved' || row.outcome === 'rejected')
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
  const status = statusOfRow(row)
  return {
    ...summaryOf(row),
    body: row.body,
    items: await itemsOf(db, requestId),
    decisions,
    expenses: await expensesOf(db, requestId),
    history: await requestHistoryOf(db, requestId),
    actions: actionsOf(actor, {
      requestedBy: row.requestedBy,
      status,
      decided: decisions.length,
    }),
  }
}

// 결재가 시작됐는지 센다. 취소 거래가 요청 행을 잠근 뒤에 읽는다.
export async function decidedCountOf(db: Reader, requestId: string) {
  const [found] = await db
    .select({ n: sql<number>`count(${approval.id})`.mapWith(Number) })
    .from(approval)
    .innerJoin(lineItem, and(eq(lineItem.id, approval.targetId), eq(lineItem.requestId, requestId)))
    .where(eq(approval.targetKind, 'line_item'))
  return found?.n ?? 0
}
