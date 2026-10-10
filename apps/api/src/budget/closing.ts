import { and, asc, eq, exists, gt, gte, isNotNull, isNull, lt, lte, ne, notExists, or, sql } from 'drizzle-orm'
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core'
import type { BudgetClosing } from '@vada/contracts'
import { budgetPeriods, expenseReceipts, expenses, incomes } from '../db/schema.js'
import { ApiError } from '../http/errors.js'
import { incomeLinesOf } from '../incomes/service.js'
import type { PeriodNumbers } from './service.js'

type Reader = Pick<PgDatabase<PgQueryResultHKT>, 'select'>
type Period = typeof budgetPeriods.$inferSelect

// 마감 조건과 마감 뒤 상태. 편성 응답과 마감·다시 열기가 같은 정의를 쓴다.
export async function closingOf(db: Reader, organizationId: string, period: Period): Promise<BudgetClosing> {
  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' })
  const ofCouncil = eq(budgetPeriods.organizationId, organizationId)
  const [earlierOpen] = await db.select({ id: budgetPeriods.id, name: budgetPeriods.name }).from(budgetPeriods)
    .where(and(ofCouncil, lt(budgetPeriods.startsOn, period.startsOn), isNull(budgetPeriods.closedAt)))
    .orderBy(asc(budgetPeriods.startsOn)).limit(1)
  // 표 하나만 고르는 select는 sql 안의 열에서 표 이름을 떼므로, 바깥 지출을 가리키는 하위 질의는 질의 빌더로 만든다.
  const [missing] = await db.select({ count: sql<number>`count(*)::int` }).from(expenses)
    .where(and(eq(expenses.organizationId, organizationId), isNull(expenses.eventId), isNull(expenses.voidedAt),
      gte(expenses.paidOn, period.startsOn), lte(expenses.paidOn, period.endsOn),
      notExists(db.select({ one: sql`1` }).from(expenseReceipts)
        .where(and(eq(expenseReceipts.expenseId, expenses.id), eq(expenseReceipts.status, 'ready'))))))
  // 다음 기간: 시작일이 이 기간 끝일보다 뒤인 기간 가운데 가장 이른 것. 이월금이 들어갈 곳이다.
  const [next] = await db.select({ id: budgetPeriods.id, name: budgetPeriods.name, startsOn: budgetPeriods.startsOn, closedAt: budgetPeriods.closedAt })
    .from(budgetPeriods).where(and(ofCouncil, gt(budgetPeriods.startsOn, period.endsOn))).orderBy(asc(budgetPeriods.startsOn)).limit(1)
  const nextIncomes = next ? await incomeLinesOf(db, organizationId, next.id) : []
  const [carried] = await db.select({ amount: incomes.amount, periodId: budgetPeriods.id, periodName: budgetPeriods.name }).from(incomes)
    .innerJoin(budgetPeriods, and(eq(budgetPeriods.id, incomes.periodId), eq(budgetPeriods.organizationId, incomes.organizationId)))
    .where(and(eq(incomes.organizationId, organizationId), eq(incomes.carriedFromPeriodId, period.id), isNull(incomes.voidedAt)))
  return {
    ended: today > period.endsOn,
    earlierOpen: earlierOpen ?? null,
    missingEvidence: missing!.count,
    next: next ? { id: next.id, name: next.name, startsOn: next.startsOn, closed: next.closedAt !== null,
      incomes: nextIncomes } : null,
    carriedOver: carried ? { period: { id: carried.periodId, name: carried.periodName }, amount: carried.amount } : null,
  }
}

// 마감 조건(spec 정책 1)이 모두 맞는가. 남은 돈이 있으면 넘길 다음 기간이 있어야 한다.
export function readyToClose(closing: BudgetClosing, numbers: PeriodNumbers) {
  const { balance } = numbers.totals
  return closing.ended && closing.earlierOpen === null && numbers.events.every(line => line.settled) && closing.missingEvidence === 0
    && balance >= 0 && (balance === 0 || closing.next !== null)
}

// 마감한 기간과 취소하지 않은 이월금을 받은 기간보다 앞서는 기간은 두지 않는다. 고치는 기간 자신은 뺀다.
// 그 앞이나 사이에 기간이 끼면 마감 순서와 이월 연결이 어긋난다. 겹침 검사 뒤에 부르므로 "뒤에 있다"는 시작일만 보면 된다.
export async function assertAfterClosed(db: Reader, organizationId: string, input: { endsOn: string }, exceptId?: string) {
  const carried = db.select({ one: sql`1` }).from(incomes).where(and(eq(incomes.organizationId, budgetPeriods.organizationId),
    eq(incomes.periodId, budgetPeriods.id), isNotNull(incomes.carriedFromPeriodId), isNull(incomes.voidedAt)))
  const [later] = await db.select({ id: budgetPeriods.id }).from(budgetPeriods)
    .where(and(eq(budgetPeriods.organizationId, organizationId), exceptId === undefined ? undefined : ne(budgetPeriods.id, exceptId),
      gt(budgetPeriods.startsOn, input.endsOn), or(isNotNull(budgetPeriods.closedAt), exists(carried)))).limit(1)
  if (later) throw new ApiError('PERIOD_BEFORE_CLOSED', 409)
}
