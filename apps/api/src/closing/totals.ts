import { and, asc, eq, isNull, notExists, sql } from 'drizzle-orm'
import type { Actor } from '../access/actor.js'
import {
  account,
  budgetItem,
  evidence,
  expense,
  file,
  income,
  lineItem,
  paymentLine,
  record,
} from '../db/schema.js'
import { countAll, sumOf } from '../db/sums.js'
import type { Db } from '../db/types.js'
import type { AccountRow, BudgetItemRow, ExpenseRow, IncomeRow } from './numbers.js'
import { paidWithin, type ClosingPeriod } from './period.js'

type Reader = Pick<Db, 'select'>

// 결산서에 드는 줄을 DB가 묶어 준다. 모두 이 학생회의 기록이고 취소한 것은 뺀다.

export async function budgetItemsOf(db: Reader, period: ClosingPeriod): Promise<BudgetItemRow[]> {
  if (!period.budgetId) return []
  const rows = await db
    .select({
      id: budgetItem.id,
      type: budgetItem.type,
      purpose: budgetItem.purpose,
      amount: budgetItem.amount,
    })
    .from(budgetItem)
    .where(eq(budgetItem.budgetId, period.budgetId))
    .orderBy(asc(budgetItem.purpose), asc(budgetItem.id))
  return rows.map(row => ({ ...row, amount: Number(row.amount) }))
}

// 수입은 기간 번호로 센다. 기간은 받은 날로 서버가 골랐다.
export function incomeRowsOf(
  db: Reader,
  actor: Actor,
  period: ClosingPeriod,
): Promise<IncomeRow[]> {
  return db
    .select({
      source: income.source,
      itemId: income.budgetItemId,
      accountId: income.accountId,
      amount: sumOf(income.amount),
      count: countAll,
    })
    .from(income)
    .innerJoin(record, eq(record.id, income.id))
    .where(
      and(
        eq(record.councilId, actor.councilId),
        eq(income.fiscalPeriodId, period.id),
        isNull(income.cancelledAt),
      ),
    )
    .groupBy(income.source, income.budgetItemId, income.accountId)
}

// 지출은 결제 시각의 한국 날짜가 기간 안인 것이다. 결제 내역이 있는 지출은 내역마다 그 품목의 예산 항목으로,
// 없는 지출은 지출에 고른 예산 항목으로 센다(내역의 합이 지출 금액과 같다).
export async function expenseRowsOf(
  db: Reader,
  actor: Actor,
  period: ClosingPeriod,
): Promise<ExpenseRow[]> {
  const base = and(
    eq(record.councilId, actor.councilId),
    isNull(expense.cancelledAt),
    paidWithin(period),
  )
  const direct = await db
    .select({
      itemId: expense.budgetItemId,
      accountId: expense.accountId,
      amount: sumOf(expense.amount),
    })
    .from(expense)
    .innerJoin(record, eq(record.id, expense.id))
    .where(
      and(
        base,
        notExists(
          db
            .select({ one: sql`1` })
            .from(paymentLine)
            .where(eq(paymentLine.expenseId, expense.id)),
        ),
      ),
    )
    .groupBy(expense.budgetItemId, expense.accountId)
  const lines = await db
    .select({
      itemId: lineItem.budgetItemId,
      accountId: expense.accountId,
      amount: sumOf(paymentLine.amount),
    })
    .from(paymentLine)
    .innerJoin(expense, eq(expense.id, paymentLine.expenseId))
    .innerJoin(lineItem, eq(lineItem.id, paymentLine.lineItemId))
    .innerJoin(record, eq(record.id, expense.id))
    .where(base)
    .groupBy(lineItem.budgetItemId, expense.accountId)
  return [...direct, ...lines]
}

// 닫은 계좌도 센다. 계좌 줄에는 이 학생회의 계좌만 든다.
export async function accountRowsOf(db: Reader, actor: Actor): Promise<AccountRow[]> {
  const rows = await db
    .select({ id: account.id, name: account.name, closedOn: account.closedOn })
    .from(account)
    .innerJoin(record, eq(record.id, account.id))
    .where(eq(account.councilId, actor.councilId))
    .orderBy(asc(record.createdAt), asc(account.id))
  return rows.map(row => ({ id: row.id, name: row.name, closed: row.closedOn !== null }))
}

// 내보내기 상한을 가늠할 사진 수와 크기: 이 기간 취소하지 않은 지출의 증빙 사진.
export async function photoTotalsOf(db: Reader, actor: Actor, period: ClosingPeriod) {
  const [row] = await db
    .select({ count: countAll, bytes: sumOf(file.sizeBytes) })
    .from(file)
    .innerJoin(evidence, eq(evidence.id, file.attachedToId))
    .innerJoin(expense, eq(expense.id, evidence.expenseId))
    .innerJoin(record, eq(record.id, expense.id))
    .where(
      and(eq(record.councilId, actor.councilId), isNull(expense.cancelledAt), paidWithin(period)),
    )
  return { count: row?.count ?? 0, bytes: row?.bytes ?? 0 }
}

export async function expenseCountOf(db: Reader, actor: Actor, period: ClosingPeriod) {
  const [row] = await db
    .select({ count: countAll })
    .from(expense)
    .innerJoin(record, eq(record.id, expense.id))
    .where(
      and(eq(record.councilId, actor.councilId), isNull(expense.cancelledAt), paidWithin(period)),
    )
  return row?.count ?? 0
}
