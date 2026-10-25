import { and, asc, desc, eq, sql, type SQL } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import {
  EXPENSE_LIST_LIMIT,
  koreanDateOf,
  type EvidenceType,
  type ExpenseApproval,
  type ExpenseDetail,
  type ExpenseListQuery,
  type ExpenseMethod,
  type ExpenseSummary,
  type ExpensesResponse,
} from '@vada/contracts'
import type { Actor } from '../access/actor.js'
import {
  account,
  approval,
  budgetItem,
  event,
  evidence,
  expense,
  file,
  lineItem,
  member,
  paymentLine,
  record,
  request,
} from '../db/schema.js'
import type { Db } from '../db/types.js'
import { eventRowOf } from '../events/queries.js'
import { ApiError } from '../http/errors.js'
import { expenseHistoryOf } from './history.js'
import { actionsOf, factsOf } from './policy.js'
import { displayNameOf, recordCouncilSql } from '../team/display-name.js'

type Reader = Pick<Db, 'select'>

const payer = alias(member, 'payer')
const requester = alias(member, 'requester')

const evidenceCount = sql<number>`(select count(*) from ${evidence} where ${evidence.expenseId} = ${expense.id})`

// 지출 줄. 학생회 경계는 기록의 학생회 번호로 건다.
function expenseRows(
  db: Reader,
  actor: Actor,
  options: { where?: SQL | undefined; limit: number },
) {
  return db
    .select({
      id: expense.id,
      vendor: expense.vendor,
      description: expense.description,
      amount: expense.amount,
      paidAt: expense.paidAt,
      method: expense.method,
      reason: expense.reason,
      eventId: expense.eventId,
      eventName: event.name,
      paidById: expense.paidBy,
      payerName: displayNameOf(payer, record.councilId),
      requestedById: expense.requestedBy,
      requesterName: displayNameOf(requester, record.councilId),
      reimbursedAt: expense.reimbursedAt,
      cancelledAt: expense.cancelledAt,
      budgetItemId: expense.budgetItemId,
      purpose: budgetItem.purpose,
      accountId: expense.accountId,
      accountName: account.name,
      evidenceCount: evidenceCount.mapWith(Number),
    })
    .from(expense)
    .innerJoin(record, eq(record.id, expense.id))
    .leftJoin(payer, eq(payer.id, expense.paidBy))
    .leftJoin(requester, eq(requester.id, expense.requestedBy))
    .leftJoin(budgetItem, eq(budgetItem.id, expense.budgetItemId))
    .leftJoin(account, eq(account.id, expense.accountId))
    .leftJoin(event, eq(event.id, expense.eventId))
    .where(and(eq(record.councilId, actor.councilId), options.where))
    .orderBy(desc(expense.paidAt), desc(expense.id))
    .limit(options.limit)
}
type Row = Awaited<ReturnType<typeof expenseRows>>[number]

const person = (id: string | null, name: string | null) => (id && name ? { id, name } : null)

function summaryOf(row: Row): ExpenseSummary {
  return {
    id: row.id,
    vendor: row.vendor,
    description: row.description,
    amount: Number(row.amount),
    paidOn: koreanDateOf(row.paidAt),
    method: row.method as ExpenseMethod,
    paidBy: person(row.paidById, row.payerName),
    reimbursed: row.reimbursedAt !== null,
    evidenceCount: row.evidenceCount,
    cancelled: row.cancelledAt !== null,
    event: row.eventId && row.eventName ? { id: row.eventId, name: row.eventName } : null,
  }
}

// 결제일 최근 순이다. 한 개 더 읽어 넘쳤는지 안다.
// 행사를 주면 그 행사의 지출만 준다. 다른 학생회 행사는 없는 것과 같아 404다.
export async function expenseListOf(
  db: Reader,
  actor: Actor,
  query: ExpenseListQuery,
): Promise<ExpensesResponse> {
  if (query.event) await eventRowOf(db, actor, query.event)
  const rows = await expenseRows(db, actor, {
    where: query.event ? eq(expense.eventId, query.event) : undefined,
    limit: EXPENSE_LIST_LIMIT + 1,
  })
  return {
    expenses: rows.slice(0, EXPENSE_LIST_LIMIT).map(summaryOf),
    truncated: rows.length > EXPENSE_LIST_LIMIT,
  }
}

// 이 학생회의 지출 하나. 다른 학생회의 지출은 없는 것과 같아 404다. 취소한 지출도 읽을 수 있다.
export async function expenseRowOf(db: Reader, actor: Actor, expenseId: string) {
  const [row] = await expenseRows(db, actor, { where: eq(expense.id, expenseId), limit: 1 })
  if (!row) throw new ApiError('NOT_FOUND')
  return row
}

async function linesOf(db: Reader, expenseId: string) {
  const rows = await db
    .select({
      lineItemId: lineItem.id,
      name: lineItem.name,
      amount: paymentLine.amount,
      requestId: request.id,
      requestTitle: request.title,
      budgetPurpose: budgetItem.purpose,
    })
    .from(paymentLine)
    .innerJoin(lineItem, eq(lineItem.id, paymentLine.lineItemId))
    .leftJoin(budgetItem, eq(budgetItem.id, lineItem.budgetItemId))
    .innerJoin(request, eq(request.id, lineItem.requestId))
    .innerJoin(record, eq(record.id, paymentLine.id))
    .where(eq(paymentLine.expenseId, expenseId))
    .orderBy(asc(record.createdAt), asc(paymentLine.id))
  return rows.map(row => ({ ...row, amount: Number(row.amount) }))
}

async function evidenceOf(db: Reader, expenseId: string) {
  const rows = await db
    .select({ id: evidence.id, type: evidence.type, fileId: file.id })
    .from(evidence)
    .innerJoin(record, eq(record.id, evidence.id))
    .innerJoin(file, eq(file.attachedToId, evidence.id))
    .where(eq(evidence.expenseId, expenseId))
    .orderBy(asc(record.createdAt), asc(evidence.id))
  return rows.map(row => ({ id: row.id, type: row.type as EvidenceType, fileId: row.fileId }))
}

// 증빙 사진 보기: 이 학생회의 이 지출에 붙은 증빙의 파일만 연다. 대화 사진, 다른 지출의 파일, 다른 학생회의 것은 없는 것과 같아 404다.
export async function evidenceFileToView(
  db: Reader,
  actor: Actor,
  expenseId: string,
  fileId: string,
) {
  const [found] = await db
    .select({ key: file.storageKey, name: file.name, mediaType: file.mediaType })
    .from(file)
    .innerJoin(evidence, eq(evidence.id, file.attachedToId))
    .innerJoin(record, eq(record.id, evidence.id))
    .where(
      and(
        eq(file.id, fileId),
        eq(evidence.expenseId, expenseId),
        eq(record.councilId, actor.councilId),
      ),
    )
  // 증빙 파일은 비우지 않지만 이름과 저장소 위치는 비울 수 있는 칸이라(지운 메시지의 사진, DEC-54) 없으면 없는 것과 같다.
  if (!found?.key || found.name === null) throw new ApiError('NOT_FOUND')
  return { key: found.key, name: found.name, mediaType: found.mediaType }
}

async function approvalsOf(db: Reader, expenseId: string): Promise<ExpenseApproval[]> {
  const rows = await db
    .select({
      id: approval.id,
      outcome: approval.outcome,
      actorId: approval.actorId,
      actorName: displayNameOf(member, recordCouncilSql(expenseId)),
      actedAt: approval.actedAt,
    })
    .from(approval)
    .leftJoin(member, eq(member.id, approval.actorId))
    .where(
      and(
        eq(approval.targetId, expenseId),
        eq(approval.targetKind, 'expense'),
        eq(approval.actorKind, 'member'),
      ),
    )
    .orderBy(asc(approval.actedAt), asc(approval.id))
  const found: ExpenseApproval[] = []
  for (const row of rows)
    if (row.outcome === 'approved' || row.outcome === 'rejected')
      found.push({
        id: row.id,
        by: person(row.actorId, row.actorName),
        at: row.actedAt.toISOString(),
        outcome: row.outcome,
      })
  return found
}

export async function expenseDetailOf(
  db: Reader,
  actor: Actor,
  expenseId: string,
): Promise<ExpenseDetail> {
  const row = await expenseRowOf(db, actor, expenseId)
  const summary = summaryOf(row)
  return {
    ...summary,
    reason: row.reason,
    requestedBy: person(row.requestedById, row.requesterName),
    budgetItem:
      row.budgetItemId && row.purpose ? { id: row.budgetItemId, purpose: row.purpose } : null,
    account: row.accountId && row.accountName ? { id: row.accountId, name: row.accountName } : null,
    lines: await linesOf(db, expenseId),
    evidence: await evidenceOf(db, expenseId),
    approvals: await approvalsOf(db, expenseId),
    history: await expenseHistoryOf(db, expenseId),
    actions: actionsOf(actor, await factsOf(db, actor, row)),
  }
}
