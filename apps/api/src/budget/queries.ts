import { and, asc, eq, gte, lte, type SQL } from 'drizzle-orm'
import { koreanDateOf, type BudgetResponse } from '@vada/contracts'
import type { Actor } from '../access/actor.js'
import { budget, budgetItem, cohort, fiscalPeriod } from '../db/schema.js'
import type { Db } from '../db/types.js'

type Reader = Pick<Db, 'select'>

// 기간 한 줄과 그 예산 번호. 조건은 부르는 쪽이 준다.
async function periodWhere(db: Reader, where: SQL | undefined) {
  const [found] = await db
    .select({
      id: fiscalPeriod.id,
      name: fiscalPeriod.name,
      startsOn: fiscalPeriod.startsOn,
      endsOn: fiscalPeriod.endsOn,
      budgetId: budget.id,
    })
    .from(fiscalPeriod)
    .innerJoin(budget, eq(budget.fiscalPeriodId, fiscalPeriod.id))
    .where(where)
  return found ?? null
}

// 오늘(한국)이 든 이 학생회의 회계 기간과 그 예산. 기간은 겹치지 않아 많아야 하나다.
export function currentPeriodOf(db: Reader, actor: Actor, now: Date) {
  const today = koreanDateOf(now)
  return periodWhere(
    db,
    and(
      eq(fiscalPeriod.councilId, actor.councilId),
      lte(fiscalPeriod.startsOn, today),
      gte(fiscalPeriod.endsOn, today),
    ),
  )
}

export const periodById = (db: Reader, id: string) => periodWhere(db, eq(fiscalPeriod.id, id))

// 기간 하나와 그 지출 항목(목적순). 수입 항목은 기능 007이라 보이지 않는다.
export async function budgetViewOf(
  db: Reader,
  period: NonNullable<Awaited<ReturnType<typeof currentPeriodOf>>>,
): Promise<BudgetResponse> {
  const items = await db
    .select({ id: budgetItem.id, purpose: budgetItem.purpose, amount: budgetItem.amount })
    .from(budgetItem)
    .where(and(eq(budgetItem.budgetId, period.budgetId), eq(budgetItem.type, 'expense')))
    .orderBy(asc(budgetItem.purpose), asc(budgetItem.id))
  const { id, name, startsOn, endsOn } = period
  return {
    period: { id, name, startsOn, endsOn },
    items: items.map(item => ({ ...item, amount: Number(item.amount) })),
    suggested: null,
  }
}

// 오늘의 예산. 기간이 없으면 지금 기수의 이름과 날짜를 채워 둘 값으로 준다.
export async function budgetOf(db: Reader, actor: Actor, now: Date): Promise<BudgetResponse> {
  const period = await currentPeriodOf(db, actor, now)
  if (period) return budgetViewOf(db, period)
  const [current] = await db
    .select({ name: cohort.name, startsOn: cohort.startsOn, endsOn: cohort.endsOn })
    .from(cohort)
    .where(eq(cohort.id, actor.cohortId))
  return { period: null, items: [], suggested: current ?? null }
}
