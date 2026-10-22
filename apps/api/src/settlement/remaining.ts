import { and, asc, eq, isNotNull, isNull, notExists, or, sql, type SQL } from 'drizzle-orm'
import {
  SETTLEMENT_TARGET_LIMIT,
  type SettlementRemaining,
  type SettlementTarget,
} from '@vada/contracts'
import { refundPendingSql } from '../deposits/refund-pending.js'
import {
  approval,
  deposit,
  evidence,
  expense,
  lineItem,
  paymentLine,
  record,
  registration,
  registrationForm,
  request,
} from '../db/schema.js'
import type { Db } from '../db/types.js'

type Reader = Pick<Db, 'select'>
type Scope = { councilId: string; eventId: string }

const total = sql<number>`count(*) over ()`.mapWith(Number)

// 정산에 남은 것(DEC-39, DEC-40, DEC-55). 저장하지 않고 센다. 취소한 요청·지출·입금은 보지 않고,
// 학생회와 행사로 거른다(품목은 요청의 행사로 센다. 다른 행사와 상시 지출이 섞이지 않게).

// 요청의 행사로 센 품목. 결재가 없으면 대기, 승인했는데 취소하지 않은 결제 내역이 없으면 결제 전이다.
async function itemsOf(db: Reader, scope: Scope, unpaid: boolean): Promise<SettlementRemaining> {
  const paid = db
    .select({ one: sql`1` })
    .from(paymentLine)
    .innerJoin(expense, eq(expense.id, paymentLine.expenseId))
    .where(and(eq(paymentLine.lineItemId, lineItem.id), isNull(expense.cancelledAt)))
  const rows = await db
    .select({ id: request.id, title: request.title, count: sql<number>`count(*)`.mapWith(Number) })
    .from(lineItem)
    .innerJoin(request, eq(request.id, lineItem.requestId))
    .innerJoin(record, eq(record.id, request.id))
    .leftJoin(
      approval,
      and(eq(approval.targetId, lineItem.id), eq(approval.targetKind, 'line_item')),
    )
    .where(
      and(
        eq(record.councilId, scope.councilId),
        eq(request.eventId, scope.eventId),
        isNull(request.cancelledAt),
        unpaid ? and(eq(approval.outcome, 'approved'), notExists(paid)) : isNull(approval.id),
      ),
    )
    .groupBy(request.id, record.createdAt)
    .orderBy(asc(record.createdAt), asc(request.id))
  return {
    kind: unpaid ? 'unpaid_items' : 'pending_items',
    count: rows.reduce((sum, row) => sum + row.count, 0),
    targets: rows
      .slice(0, SETTLEMENT_TARGET_LIMIT)
      .map(row => ({ type: 'request', id: row.id, title: row.title })),
  }
}

// 이 행사의 취소하지 않은 지출 가운데 조건에 맞는 것. 수는 전체, 목록은 상한까지다.
async function expensesOf(
  db: Reader,
  scope: Scope,
  kind: SettlementRemaining['kind'],
  condition: SQL,
): Promise<SettlementRemaining> {
  const rows = await db
    .select({ id: expense.id, vendor: expense.vendor, amount: expense.amount, total })
    .from(expense)
    .innerJoin(record, eq(record.id, expense.id))
    .where(
      and(
        eq(record.councilId, scope.councilId),
        eq(expense.eventId, scope.eventId),
        isNull(expense.cancelledAt),
        condition,
      ),
    )
    .orderBy(asc(record.createdAt), asc(expense.id))
    .limit(SETTLEMENT_TARGET_LIMIT)
  const targets: SettlementTarget[] = rows.map(row => ({
    type: 'expense',
    id: row.id,
    vendor: row.vendor,
    amount: Number(row.amount),
  }))
  return { kind, count: rows[0]?.total ?? 0, targets }
}

// 환불 대기: 취소한 신청에 취소하지 않은 환불 전 입금이 있는 것. 신청자 이름·휴대폰은 읽지 않는다.
async function refundPendingOf(db: Reader, scope: Scope): Promise<SettlementRemaining> {
  const [row] = await db
    .select({ count: sql<number>`count(distinct ${registration.id})`.mapWith(Number) })
    .from(registration)
    .innerJoin(record, eq(record.id, registration.id))
    .innerJoin(registrationForm, eq(registrationForm.id, registration.formId))
    .innerJoin(deposit, eq(deposit.registrationId, registration.id))
    .where(
      and(
        eq(record.councilId, scope.councilId),
        eq(registrationForm.eventId, scope.eventId),
        refundPendingSql,
      ),
    )
  return { kind: 'refund_pending', count: row?.count ?? 0, targets: [] }
}

export async function remainingOf(db: Reader, scope: Scope): Promise<SettlementRemaining[]> {
  const noEvidence = notExists(
    db
      .select({ one: sql`1` })
      .from(evidence)
      .where(eq(evidence.expenseId, expense.id)),
  )
  const noReason = or(isNull(expense.reason), sql`btrim(${expense.reason}) = ''`)
  const unreimbursed = and(isNotNull(expense.paidBy), isNull(expense.reimbursedAt))
  return [
    await itemsOf(db, scope, false),
    await itemsOf(db, scope, true),
    await expensesOf(db, scope, 'no_evidence', noEvidence),
    await expensesOf(db, scope, 'no_reason', noReason!),
    await expensesOf(db, scope, 'unreimbursed', unreimbursed!),
    await refundPendingOf(db, scope),
  ]
}
