import { and, asc, desc, eq, gte, inArray, lt, lte, type SQL } from 'drizzle-orm'
import { koreanDateOf, type BudgetResponse } from '@vada/contracts'
import type { Actor } from '../access/actor.js'
import { budget, budgetItem, cohort, fiscalPeriod, record } from '../db/schema.js'
import type { Db } from '../db/types.js'
import { ApiError } from '../http/errors.js'
import { completedEventIdsAmong } from '../policy/locks.js'
import { budgetItemSelectable } from './policy.js'
import { budgetItemsWithUsage } from './usage.js'

type Reader = Pick<Db, 'select'>

// 기간 한 줄과 그 예산 번호. 조건은 부르는 쪽이 준다.
async function periodWhere(db: Reader, where: SQL | undefined) {
  const [found] = await db
    .select({
      id: fiscalPeriod.id,
      name: fiscalPeriod.name,
      startsOn: fiscalPeriod.startsOn,
      endsOn: fiscalPeriod.endsOn,
      councilId: fiscalPeriod.councilId,
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

// 새 기간의 이전 기간: 끝일이 새 시작일보다 이른 기간 가운데 가장 늦은 것. 그 뒤에 이미 이어진 기간이 있으면(사이에 끼우는 것) 비운다.
// 이전 기간은 만든 뒤 바꾸지 않는다(기능 009 '정한 것'). 학생회 행 잠금 안에서 부른다.
export async function previousPeriodIdFor(db: Reader, councilId: string, startsOn: string) {
  const [latest] = await db
    .select({ id: fiscalPeriod.id })
    .from(fiscalPeriod)
    .where(and(eq(fiscalPeriod.councilId, councilId), lt(fiscalPeriod.endsOn, startsOn)))
    .orderBy(desc(fiscalPeriod.endsOn))
    .limit(1)
  if (!latest) return null
  const [next] = await db
    .select({ id: fiscalPeriod.id })
    .from(fiscalPeriod)
    .where(eq(fiscalPeriod.previousPeriodId, latest.id))
    .limit(1)
  return next ? null : latest.id
}

// 기간 하나와 그 예산 항목(목적순). 수입 항목도 종류와 함께 주고, 항목마다 쓴 돈과 남은 돈(usage.ts)을 붙인다.
export async function budgetViewOf(
  db: Reader,
  period: NonNullable<Awaited<ReturnType<typeof currentPeriodOf>>>,
): Promise<BudgetResponse> {
  const items = await budgetItemsWithUsage(
    db,
    period.councilId,
    eq(budgetItem.budgetId, period.budgetId),
    [asc(budgetItem.purpose), asc(budgetItem.id)],
  )
  const { id, name, startsOn, endsOn } = period
  const completed = await completedEventIdsAmong(db, [
    ...new Set(items.flatMap(item => (item.eventId ? [item.eventId] : []))),
  ])
  return {
    period: { id, name, startsOn, endsOn },
    items: items.map(({ id: itemId, purpose, amount, eventId, eventName, usage }) => ({
      id: itemId,
      purpose,
      amount,
      ...usage,
      event: eventId && eventName ? { id: eventId, name: eventName } : null,
      selectable: budgetItemSelectable(eventId, completed),
    })),
    suggested: null,
  }
}

// 고른 기간(이 학생회 것만, 아니면 404)이나 오늘의 예산. 오늘 기간이 없으면 지금 기수의 이름과 날짜를 채워 둘 값으로 준다.
export async function budgetOf(
  db: Reader,
  actor: Actor,
  now: Date,
  periodId?: string,
): Promise<BudgetResponse> {
  if (periodId) {
    const picked = await periodWhere(
      db,
      and(eq(fiscalPeriod.id, periodId), eq(fiscalPeriod.councilId, actor.councilId)),
    )
    if (!picked) throw new ApiError('NOT_FOUND')
    return budgetViewOf(db, picked)
  }
  const period = await currentPeriodOf(db, actor, now)
  if (period) return budgetViewOf(db, period)
  const [current] = await db
    .select({ name: cohort.name, startsOn: cohort.startsOn, endsOn: cohort.endsOn })
    .from(cohort)
    .where(eq(cohort.id, actor.cohortId))
  return { period: null, items: [], suggested: current ?? null }
}

// 이 학생회의 예산 항목 번호 → 매인 행사 번호(행사가 없으면 null, 이 학생회 항목이 아니면 빠진다). 승인의 행사 귀속 검사가 쓴다.
export async function budgetItemEventMap(
  db: Reader,
  actor: Actor,
  ids: readonly string[],
): Promise<Map<string, string | null>> {
  if (!ids.length) return new Map()
  const rows = await db
    .select({ id: budgetItem.id, eventId: budgetItem.eventId })
    .from(budgetItem)
    .innerJoin(record, eq(record.id, budgetItem.id))
    .where(and(inArray(budgetItem.id, [...new Set(ids)]), eq(record.councilId, actor.councilId)))
  return new Map(rows.map(row => [row.id, row.eventId]))
}

// 이 학생회의 예산 항목들이 매인 행사 번호(없는 항목은 빠진다). 완료한 행사의 항목을 고르지 못하게 하는 확인이 쓴다.
export async function budgetItemEventsOf(
  db: Reader,
  actor: Actor,
  ids: readonly string[],
): Promise<string[]> {
  const events = await budgetItemEventMap(db, actor, ids)
  return [...events.values()].flatMap(eventId => (eventId ? [eventId] : []))
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

// 이 학생회의 회계 기간 하나(이름표). 다른 학생회의 기간은 없는 것과 같아 404다.
export async function periodInCouncil(db: Reader, actor: Actor, periodId: string) {
  const [row] = await db
    .select({ id: fiscalPeriod.id, name: fiscalPeriod.name })
    .from(fiscalPeriod)
    .where(and(eq(fiscalPeriod.id, periodId), eq(fiscalPeriod.councilId, actor.councilId)))
  if (!row) throw new ApiError('NOT_FOUND')
  return row
}

// 그 날(한국)이 든 이 학생회의 회계 기간 번호. 기간은 겹치지 않는다. 없으면 null이다.
export async function findPeriodIdOn(db: Reader, actor: Actor, day: string) {
  const [row] = await db
    .select({ id: fiscalPeriod.id })
    .from(fiscalPeriod)
    .where(
      and(
        eq(fiscalPeriod.councilId, actor.councilId),
        lte(fiscalPeriod.startsOn, day),
        gte(fiscalPeriod.endsOn, day),
      ),
    )
  return row?.id ?? null
}

// 쓰는 쪽은 기간이 없으면 409다.
export async function periodIdOn(db: Reader, actor: Actor, day: string) {
  const id = await findPeriodIdOn(db, actor, day)
  if (!id) throw new ApiError('NO_FISCAL_PERIOD')
  return id
}

// 수입에 고른 예산 항목은 그 기간의 이 학생회 수입 항목이어야 한다(지출 항목, 다른 기간, 다른 학생회는 409). 지출 쪽 assertCurrentExpenseItems와 나란하다.
export async function assertPeriodIncomeItem(
  db: Reader,
  actor: Actor,
  itemId: string,
  periodId: string,
) {
  const [row] = await db
    .select({ id: budgetItem.id })
    .from(budgetItem)
    .innerJoin(budget, eq(budget.id, budgetItem.budgetId))
    .innerJoin(record, eq(record.id, budgetItem.id))
    .where(
      and(
        eq(budgetItem.id, itemId),
        eq(budgetItem.type, 'income'),
        eq(budget.fiscalPeriodId, periodId),
        eq(record.councilId, actor.councilId),
      ),
    )
  if (!row) throw new ApiError('BUDGET_ITEM_INVALID')
}
