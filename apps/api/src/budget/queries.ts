import { and, asc, eq, gte, inArray, lte, type SQL } from 'drizzle-orm'
import { koreanDateOf, type BudgetResponse } from '@vada/contracts'
import type { Actor } from '../access/actor.js'
import { budget, budgetItem, cohort, fiscalPeriod, record } from '../db/schema.js'
import type { Db } from '../db/types.js'
import { ApiError } from '../http/errors.js'

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

// 이 학생회의 예산 항목들이 매인 행사 번호(없는 항목은 빠진다). 완료한 행사의 항목을 고르지 못하게 하는 확인이 쓴다.
export async function budgetItemEventsOf(
  db: Reader,
  actor: Actor,
  ids: readonly string[],
): Promise<string[]> {
  if (!ids.length) return []
  const rows = await db
    .select({ eventId: budgetItem.eventId })
    .from(budgetItem)
    .innerJoin(record, eq(record.id, budgetItem.id))
    .where(and(inArray(budgetItem.id, [...new Set(ids)]), eq(record.councilId, actor.councilId)))
  return rows.flatMap(row => (row.eventId ? [row.eventId] : []))
}

// 승인과 지출에 고른 예산 항목은 오늘(한국)이 든 이 학생회 회계 기간의 지출 항목이어야 한다. 다른 학생회, 수입 항목, 지금 기간 밖은 409다.
export async function assertCurrentExpenseItems(
  db: Reader,
  actor: Actor,
  ids: readonly string[],
  now: Date,
) {
  const unique = [...new Set(ids)]
  if (!unique.length) return
  const period = await currentPeriodOf(db, actor, now)
  if (!period) throw new ApiError('BUDGET_ITEM_INVALID')
  const rows = await db
    .select({ id: budgetItem.id })
    .from(budgetItem)
    .where(
      and(
        inArray(budgetItem.id, unique),
        eq(budgetItem.budgetId, period.budgetId),
        eq(budgetItem.type, 'expense'),
      ),
    )
  if (rows.length !== unique.length) throw new ApiError('BUDGET_ITEM_INVALID')
}
