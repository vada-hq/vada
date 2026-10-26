import { and, eq, exists, isNotNull, isNull, notExists, or, sql, type SQL } from 'drizzle-orm'
import type { ClosingCheck, ClosingCheckKind } from '@vada/contracts'
import type { Actor } from '../access/actor.js'
import { budgetItem, expense, fiscalPeriod, lineItem, paymentLine, record } from '../db/schema.js'
import type { Db } from '../db/types.js'
import { expenseConditions, expenseTargetsOf } from '../settlement/remaining.js'
import { paidWithin, type ClosingPeriod } from './period.js'

type Reader = Pick<Db, 'select'>

// 지출에 고른 예산 항목(직접 또는 결제 내역의 품목)이 하나라도 이 조건이면 참이다.
function anyItem(db: Reader, where: SQL) {
  const direct = db
    .select({ one: sql`1` })
    .from(budgetItem)
    .where(and(eq(budgetItem.id, expense.budgetItemId), where))
  const viaLines = db
    .select({ one: sql`1` })
    .from(paymentLine)
    .innerJoin(lineItem, eq(lineItem.id, paymentLine.lineItemId))
    .innerJoin(budgetItem, eq(budgetItem.id, lineItem.budgetItemId))
    .where(and(eq(paymentLine.expenseId, expense.id), where))
  return or(exists(direct), exists(viaLines))!
}

// 예산 항목이 없는 지출: 지출에도, 결제 내역의 어느 품목에도 고른 항목이 없다.
function noItem(db: Reader) {
  const viaLines = db
    .select({ one: sql`1` })
    .from(paymentLine)
    .innerJoin(lineItem, eq(lineItem.id, paymentLine.lineItemId))
    .where(and(eq(paymentLine.expenseId, expense.id), isNotNull(lineItem.budgetItemId)))
  return and(isNull(expense.budgetItemId), notExists(viaLines))!
}

// 어느 결산에도 들지 않는 지출이므로 학생회 전체에서 찾는다. 공개는 막지 않는다(DEC-92).
function noPeriod(db: Reader, actor: Actor) {
  return notExists(
    db
      .select({ one: sql`1` })
      .from(fiscalPeriod)
      .where(
        and(
          eq(fiscalPeriod.councilId, actor.councilId),
          sql`(${expense.paidAt} at time zone 'Asia/Seoul')::date between ${fiscalPeriod.startsOn} and ${fiscalPeriod.endsOn}`,
        ),
      ),
  )
}

// 결산서 점검: 증빙·사유·환급·계좌·예산 항목이 빠진 지출과 다른 기간 항목을 고른 지출. 공개를 막지 않는다(감사가 판단한다).
// 수는 전체, 목록은 상한까지다. 취소한 지출은 보지 않는다.
export async function expenseChecksOf(
  db: Reader,
  actor: Actor,
  period: ClosingPeriod,
): Promise<ClosingCheck[]> {
  const { noEvidence, noReason, unreimbursed } = expenseConditions(db)
  const where = and(eq(record.councilId, actor.councilId), paidWithin(period))
  const conditions: [ClosingCheckKind, SQL][] = [
    ['no_evidence', noEvidence],
    ['no_reason', noReason],
    ['unreimbursed', unreimbursed],
    ['no_account', isNull(expense.accountId)],
    ['no_item', noItem(db)],
    [
      'other_period_item',
      anyItem(db, sql`${budgetItem.budgetId} is distinct from ${period.budgetId}::uuid`),
    ],
  ]
  const checks: ClosingCheck[] = []
  for (const [kind, condition] of conditions)
    checks.push({ kind, ...(await expenseTargetsOf(db, where, condition)) })
  checks.push({
    kind: 'no_period',
    ...(await expenseTargetsOf(db, eq(record.councilId, actor.councilId), noPeriod(db, actor))),
  })
  return checks
}
