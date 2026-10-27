import { and, desc, eq, inArray } from 'drizzle-orm'
import type { ExpenseAllocation } from '@vada/contracts'
import {
  budget,
  budgetItem,
  expense,
  fiscalPeriod,
  lineItem,
  paymentLine,
  record,
} from '../db/schema.js'
import type { Db } from '../db/types.js'

// 상세를 지출 수만큼 읽지 않도록 목록의 300개에 붙은 배분만 한꺼번에 읽는다.
// 결제 내역은 품목에 예산 항목이 없어도 준다(개요 countedExpense의 noLines와 같은 기준을 화면이 쓴다).
export async function expenseAllocations(
  db: Pick<Db, 'select'>,
  councilId: string,
  ids: string[],
): Promise<ExpenseAllocation[]> {
  if (ids.length === 0) return []
  const fields = {
    budgetItemId: budgetItem.id,
    purpose: budgetItem.purpose,
    periodId: budget.fiscalPeriodId,
  }
  const direct = await db
    .select({ ...fields, expenseId: expense.id, amount: expense.amount })
    .from(expense)
    .innerJoin(record, eq(record.id, expense.id))
    .innerJoin(budgetItem, eq(budgetItem.id, expense.budgetItemId))
    .innerJoin(budget, eq(budget.id, budgetItem.budgetId))
    .where(and(eq(record.councilId, councilId), inArray(expense.id, ids)))
  const lines = await db
    .select({ ...fields, expenseId: paymentLine.expenseId, amount: paymentLine.amount })
    .from(paymentLine)
    .innerJoin(lineItem, eq(lineItem.id, paymentLine.lineItemId))
    .innerJoin(record, eq(record.id, lineItem.id))
    .leftJoin(budgetItem, eq(budgetItem.id, lineItem.budgetItemId))
    .leftJoin(budget, eq(budget.id, budgetItem.budgetId))
    .where(and(eq(record.councilId, councilId), inArray(paymentLine.expenseId, ids)))
  return [...direct, ...lines].map(row => ({ ...row, amount: Number(row.amount) }))
}

export function expensePeriods(db: Pick<Db, 'select'>, councilId: string) {
  return db
    .select({
      id: fiscalPeriod.id,
      name: fiscalPeriod.name,
      startsOn: fiscalPeriod.startsOn,
      endsOn: fiscalPeriod.endsOn,
    })
    .from(fiscalPeriod)
    .innerJoin(record, eq(record.id, fiscalPeriod.id))
    .where(eq(record.councilId, councilId))
    .orderBy(desc(fiscalPeriod.startsOn), desc(fiscalPeriod.id))
}
