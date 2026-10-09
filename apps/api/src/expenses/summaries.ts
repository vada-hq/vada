import { and, asc, desc, eq, inArray, sql, type SQL } from 'drizzle-orm'
import { alias, type PgDatabase, type PgQueryResultHKT } from 'drizzle-orm/pg-core'
import type { ExpenseDetail, ExpenseItem, ExpenseSummary, ReceiptContentType } from '@vada/contracts'
import { budgetLines, eventFinances, events, expenseEvents, expenseItems, expenseReceipts, expenses, memberships, purchaseItems as items,
  users } from '../db/schema.js'

type Reader = Pick<PgDatabase<PgQueryResultHKT>, 'select'>
const payers = alias(users, 'expense_payers')
const payerMemberships = alias(memberships, 'expense_payer_memberships')
const recorders = alias(users, 'expense_recorders')
const voiders = alias(users, 'expense_voiders')
const requesters = alias(users, 'expense_item_requesters')
const actors = alias(users, 'expense_actors')
const uploaders = alias(users, 'expense_uploaders')
const itemEventsTable = alias(events, 'linked_item_events')
const lines = alias(budgetLines, 'expense_budget_lines')

// 연결 품목의 승인 금액. 품목이 없거나 수량·단가를 모르는 품목이 있으면 비교하지 않는다.
export function approvedTotalOf(list: ExpenseItem[]) {
  if (!list.length || list.some(item => item.quantity === null || item.estimatedUnitPrice === null)) return null
  return list.reduce((sum, item) => sum + item.quantity! * item.estimatedUnitPrice!, 0)
}

// 품목과 그 품목이 연결된 지출. 연결 품목과 연결할 수 있는 품목 목록이 같이 쓴다.
export async function expenseItemRows(db: Reader, organizationId: string, where: SQL | undefined, limit = 1000) {
  const rows = await db.select({
    id: items.id, eventId: items.eventId, eventName: itemEventsTable.name, productName: items.productName, quantity: items.quantity,
    estimatedUnitPrice: items.estimatedUnitPrice, purchasedAt: items.purchasedAt, requester: { id: requesters.id, name: requesters.name },
    expenseId: expenseItems.expenseId,
  }).from(items)
    .innerJoin(itemEventsTable, and(eq(itemEventsTable.id, items.eventId), eq(itemEventsTable.organizationId, items.organizationId)))
    .innerJoin(requesters, eq(requesters.id, items.requesterId))
    .leftJoin(expenseItems, and(eq(expenseItems.purchaseItemId, items.id), eq(expenseItems.organizationId, items.organizationId)))
    .where(and(eq(items.organizationId, organizationId), where))
    .orderBy(asc(itemEventsTable.name), asc(items.createdAt), asc(items.id)).limit(limit)
  return rows.map(row => ({ expenseId: row.expenseId, item: { id: row.id, event: { id: row.eventId, name: row.eventName },
    productName: row.productName, quantity: row.quantity, estimatedUnitPrice: row.estimatedUnitPrice, requester: row.requester,
    purchasedAt: row.purchasedAt?.toISOString() ?? null } satisfies ExpenseItem }))
}

// 목록·상세·변경 응답이 같은 칸을 쓴다. 증빙은 확인된(ready) 파일만 센다.
export async function expenseSummaries(db: Reader, organizationId: string, where: SQL | undefined, limit: number): Promise<ExpenseSummary[]> {
  const rows = await db.select({
    expense: expenses, eventName: events.name, settledAt: eventFinances.settledAt, lineName: lines.name, payerName: payers.name,
    payerMembershipId: payerMemberships.id,
    recorderName: recorders.name, voiderName: voiders.name,
    receiptCount: sql<number>`(select count(*)::int from ${expenseReceipts} where ${expenseReceipts.expenseId} = ${expenses.id} and ${expenseReceipts.status} = 'ready')`,
  }).from(expenses)
    .leftJoin(events, and(eq(events.id, expenses.eventId), eq(events.organizationId, expenses.organizationId)))
    // 정산된 행사의 지출이면 화면이 수정·취소·증빙 삭제를 감춘다.
    .leftJoin(eventFinances, and(eq(eventFinances.eventId, expenses.eventId), eq(eventFinances.organizationId, expenses.organizationId)))
    .leftJoin(lines, and(eq(lines.id, expenses.budgetLineId), eq(lines.organizationId, expenses.organizationId)))
    .innerJoin(payers, eq(payers.id, expenses.payerId))
    // 학생회를 떠난 사람이면 소속이 없다.
    .leftJoin(payerMemberships, and(eq(payerMemberships.organizationId, expenses.organizationId), eq(payerMemberships.userId, expenses.payerId)))
    .innerJoin(recorders, eq(recorders.id, expenses.recordedBy))
    .leftJoin(voiders, eq(voiders.id, expenses.voidedBy))
    .where(and(eq(expenses.organizationId, organizationId), where))
    .orderBy(desc(expenses.paidOn), desc(expenses.createdAt), desc(expenses.id)).limit(limit)
  const ids = rows.map(row => row.expense.id)
  const linked = ids.length ? await expenseItemRows(db, organizationId, inArray(expenseItems.expenseId, ids)) : []
  return rows.map(({ expense, ...row }): ExpenseSummary => {
    const list = linked.filter(link => link.expenseId === expense.id).map(link => link.item)
    return {
      id: expense.id, event: expense.eventId && row.eventName ? { id: expense.eventId, name: row.eventName } : null,
      budgetLine: expense.budgetLineId && row.lineName ? { id: expense.budgetLineId, name: row.lineName } : null,
      vendor: expense.vendor, description: expense.description, amount: expense.amount, paidOn: expense.paidOn, method: expense.method,
      payer: { id: expense.payerId, name: row.payerName }, payerMembershipId: row.payerMembershipId, note: expense.note, recordedBy: { id: expense.recordedBy, name: row.recorderName },
      items: list, approvedTotal: approvedTotalOf(list), receiptCount: row.receiptCount, evidence: row.receiptCount > 0 ? 'complete' : 'missing',
      voided: expense.voidedAt && expense.voidedBy && expense.voidReason
        ? { by: { id: expense.voidedBy, name: row.voiderName ?? '' }, at: expense.voidedAt.toISOString(), reason: expense.voidReason } : null,
      settled: row.settledAt !== null,
      version: expense.version, createdAt: expense.createdAt.toISOString(), updatedAt: expense.updatedAt.toISOString(),
    }
  })
}

// 상세는 확인된 증빙과 처리 기록을 더한다.
export async function expenseDetail(db: Reader, organizationId: string, summary: ExpenseSummary): Promise<ExpenseDetail> {
  const receipts = await db.select({ receipt: expenseReceipts, uploaderName: uploaders.name }).from(expenseReceipts)
    .innerJoin(uploaders, eq(uploaders.id, expenseReceipts.uploadedBy))
    .where(and(eq(expenseReceipts.organizationId, organizationId), eq(expenseReceipts.expenseId, summary.id), eq(expenseReceipts.status, 'ready')))
    .orderBy(asc(expenseReceipts.createdAt), asc(expenseReceipts.id))
  const history = await db.select({ entry: expenseEvents, actorName: actors.name }).from(expenseEvents)
    .innerJoin(actors, eq(actors.id, expenseEvents.actorId))
    .where(and(eq(expenseEvents.organizationId, organizationId), eq(expenseEvents.expenseId, summary.id)))
    .orderBy(asc(expenseEvents.createdAt), asc(expenseEvents.id))
  return {
    ...summary,
    receipts: receipts.map(({ receipt, uploaderName }) => ({ id: receipt.id, fileName: receipt.fileName,
      contentType: receipt.contentType as ReceiptContentType, size: receipt.sizeBytes, kind: receipt.kind,
      uploadedBy: { id: receipt.uploadedBy, name: uploaderName }, createdAt: receipt.createdAt.toISOString() })),
    history: history.map(({ entry, actorName }) => ({ id: entry.id, action: entry.action, actor: { id: entry.actorId, name: actorName },
      changes: entry.changes, createdAt: entry.createdAt.toISOString() })),
  }
}
