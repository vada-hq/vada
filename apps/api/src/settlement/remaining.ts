import { and, asc, eq, isNotNull, isNull, notExists, or, sql, type SQL } from 'drizzle-orm'
import {
  SETTLEMENT_TARGET_LIMIT,
  type EventStatus,
  type SettlementRemaining,
  type SettlementTarget,
} from '@vada/contracts'
import { refundPendingSql } from '../deposits/refund-pending.js'
import {
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
import { lastOutcomeOf } from '../purchases/last-outcome.js'

type Reader = Pick<Db, 'select'>
type Scope = { councilId: string; eventId: string }

const total = sql<number>`count(*) over ()`.mapWith(Number)

// 정산에 남은 것(DEC-39, DEC-40, DEC-55). 저장하지 않고 센다. 취소한 요청·지출·입금은 보지 않고,
// 학생회와 행사로 거른다(품목은 요청의 행사로 센다. 다른 행사와 상시 지출이 섞이지 않게).

// 단건 정산과 행사 목록이 마지막 결재·유효한 결제를 같은 조건으로 판정한다.
export function itemConditions(db: Reader) {
  const paid = db
    .select({ one: sql`1` })
    .from(paymentLine)
    .innerJoin(expense, eq(expense.id, paymentLine.expenseId))
    .where(and(eq(paymentLine.lineItemId, lineItem.id), isNull(expense.cancelledAt)))
  const last = lastOutcomeOf(lineItem.id)
  return {
    pending: sql`${last} is null`,
    unpaid: and(sql`${last} = 'approved'`, notExists(paid))!,
  }
}

// 요청의 행사로 센 품목. 마지막 결과가 없으면 대기, 승인(취소하지 않은)이고 취소하지 않은 결제 내역이 없으면 결제 전이다.
async function itemsOf(db: Reader, scope: Scope, unpaid: boolean): Promise<SettlementRemaining> {
  const conditions = itemConditions(db)
  const rows = await db
    .select({ id: request.id, title: request.title, count: sql<number>`count(*)`.mapWith(Number) })
    .from(lineItem)
    .innerJoin(request, eq(request.id, lineItem.requestId))
    .innerJoin(record, eq(record.id, request.id))
    .where(
      and(
        eq(record.councilId, scope.councilId),
        eq(request.eventId, scope.eventId),
        isNull(request.cancelledAt),
        unpaid ? conditions.unpaid : conditions.pending,
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

// 취소하지 않은 지출 가운데 범위(where)와 조건에 맞는 것. 수는 전체, 목록은 상한까지다. 학생회 경계는 부르는 쪽이 where에 둔다.
export async function expenseTargetsOf(
  db: Reader,
  where: SQL | undefined,
  condition: SQL,
): Promise<{ count: number; targets: SettlementTarget[] }> {
  const rows = await db
    .select({ id: expense.id, vendor: expense.vendor, amount: expense.amount, total })
    .from(expense)
    .innerJoin(record, eq(record.id, expense.id))
    .where(and(where, isNull(expense.cancelledAt), condition))
    .orderBy(asc(record.createdAt), asc(expense.id))
    .limit(SETTLEMENT_TARGET_LIMIT)
  const targets: SettlementTarget[] = rows.map(row => ({
    type: 'expense',
    id: row.id,
    vendor: row.vendor,
    amount: Number(row.amount),
  }))
  return { count: rows[0]?.total ?? 0, targets }
}

async function expensesOf(
  db: Reader,
  scope: Scope,
  kind: SettlementRemaining['kind'],
  condition: SQL,
): Promise<SettlementRemaining> {
  const where = and(eq(record.councilId, scope.councilId), eq(expense.eventId, scope.eventId))
  return { kind, ...(await expenseTargetsOf(db, where, condition)) }
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

// 증빙, 사유, 환급: 정산 남은 것과 결산 점검이 같은 조건을 본다.
export function expenseConditions(db: Reader) {
  const noEvidence = notExists(
    db
      .select({ one: sql`1` })
      .from(evidence)
      .where(eq(evidence.expenseId, expense.id)),
  )
  const noReason = or(isNull(expense.reason), sql`btrim(${expense.reason}) = ''`)!
  const unreimbursed = and(isNotNull(expense.paidBy), isNull(expense.reimbursedAt))!
  return { noEvidence, noReason, unreimbursed }
}

export async function remainingOf(db: Reader, scope: Scope): Promise<SettlementRemaining[]> {
  const { noEvidence, noReason, unreimbursed } = expenseConditions(db)
  return [
    await itemsOf(db, scope, false),
    await itemsOf(db, scope, true),
    await expensesOf(db, scope, 'no_evidence', noEvidence),
    await expensesOf(db, scope, 'no_reason', noReason),
    await expensesOf(db, scope, 'unreimbursed', unreimbursed),
    await refundPendingOf(db, scope),
  ]
}

// 정산이 끝났는가(logical-model '행사의 정산이 끝났는가'): 끝났거나 완료한 행사이고 남은 것이 0일 때만 참이다.
// 끝나기 전의 행사는 남은 것이 0이어도 아직 진행 중인 일이라 거짓이다. 정산 응답과 홈이 같이 쓴다.
export const isSettled = (status: EventStatus, remaining: readonly SettlementRemaining[]) =>
  (status === 'ended' || status === 'completed') && remaining.every(item => item.count === 0)
