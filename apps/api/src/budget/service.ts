import { randomUUID } from 'node:crypto'
import { and, asc, desc, eq, gte, inArray, isNotNull, isNull, lte, ne, notExists, sql } from 'drizzle-orm'
import { alias, type PgDatabase, type PgQueryResultHKT } from 'drizzle-orm/pg-core'
import { BUDGET_CANDIDATES_MAX, BUDGET_HISTORY_MAX, BUDGET_PERIODS_MAX, type BudgetPeriodAction, type BudgetPeriodsResponse,
  type BudgetPlanResponse, type CreateBudgetPeriodRequest } from '@vada/contracts'
import { budgetLines, budgetPeriodEvents, budgetPeriods, eventFinances, events, expenses, users } from '../db/schema.js'
import { ApiError } from '../http/errors.js'
import { requireFinance } from '../purchases/review.js'
import { financeNumbersByEvent } from '../settlement/service.js'

type Db = PgDatabase<PgQueryResultHKT>
export type BudgetDatabase = Pick<Db, 'select' | 'insert' | 'update' | 'delete' | 'transaction'>
type Reader = Pick<Db, 'select'>
type Transaction = Parameters<Parameters<BudgetDatabase['transaction']>[0]>[0]
export interface BudgetScope { organizationId: string; userId: string }
const actors = alias(users, 'budget_actors')
const sum = (values: number[]) => values.reduce((total, value) => total + value, 0)

// 학생회 하나의 기간·편성 변경을 한 줄로 세운다. 그래서 겹침·이름·행사 중복을 미리 조회해도 다른 요청이 끼어들지 못한다.
export async function lockBudget(tx: Transaction, organizationId: string) {
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${JSON.stringify(['budget', organizationId])}, 0))`)
}
// 이 학생회의 기간. 편성을 바꿀 때는 FOR UPDATE로 잠근다. 운영 항목을 고르는 지출은 같은 행을 FOR SHARE로 잠근다.
export async function periodOf(db: Reader, scope: BudgetScope, periodId: string, lock = false) {
  const query = db.select().from(budgetPeriods).where(and(eq(budgetPeriods.organizationId, scope.organizationId), eq(budgetPeriods.id, periodId)))
  const [period] = await (lock ? query.for('update') : query)
  if (!period) throw new ApiError('NOT_FOUND', 404)
  return period
}
// 날짜가 겹치는 기간과 이름이 같은 기간을 막는다. 고치는 기간 자신은 뺀다.
export async function assertPeriodFree(db: Reader, scope: BudgetScope, input: { name: string; startsOn: string; endsOn: string }, exceptId?: string) {
  const others = and(eq(budgetPeriods.organizationId, scope.organizationId), exceptId === undefined ? undefined : ne(budgetPeriods.id, exceptId))
  const [overlap] = await db.select({ id: budgetPeriods.id }).from(budgetPeriods)
    .where(and(others, lte(budgetPeriods.startsOn, input.endsOn), gte(budgetPeriods.endsOn, input.startsOn))).limit(1)
  if (overlap) throw new ApiError('PERIOD_OVERLAP', 409)
  const [named] = await db.select({ id: budgetPeriods.id }).from(budgetPeriods).where(and(others, eq(budgetPeriods.name, input.name))).limit(1)
  if (named) throw new ApiError('PERIOD_NAME_TAKEN', 409)
}
export async function recordPeriod(tx: Transaction, scope: BudgetScope, periodId: string, action: BudgetPeriodAction, changes: Record<string, unknown>) {
  await tx.insert(budgetPeriodEvents).values({ id: randomUUID(), organizationId: scope.organizationId, periodId, actorId: scope.userId, action, changes })
}
// 행사의 예산·버전·정산 여부. 행이 없으면 Map에 없다(예산 미정, 버전 0, 정산 전).
export async function financeRows(db: Reader, scope: BudgetScope, eventIds: string[]) {
  const rows = eventIds.length ? await db.select({ eventId: eventFinances.eventId, budget: eventFinances.budget, version: eventFinances.version,
    settledAt: eventFinances.settledAt }).from(eventFinances)
    .where(and(eq(eventFinances.organizationId, scope.organizationId), inArray(eventFinances.eventId, eventIds))) : []
  return new Map(rows.map(row => [row.eventId, row]))
}

// 어느 기간에도 넣지 않은 행사. 최근에 만든 순으로 자르고, 지출 합은 행사 재정과 같은 함수로 센다.
async function candidatesOf(db: Reader, scope: BudgetScope) {
  const rows = await db.select({ id: events.id, name: events.name, budget: eventFinances.budget, version: eventFinances.version,
    settledAt: eventFinances.settledAt }).from(events)
    .leftJoin(eventFinances, and(eq(eventFinances.eventId, events.id), eq(eventFinances.organizationId, events.organizationId)))
    .leftJoin(budgetLines, eq(budgetLines.eventId, events.id))
    .where(and(eq(events.organizationId, scope.organizationId), isNull(budgetLines.id)))
    .orderBy(desc(events.createdAt), desc(events.id)).limit(BUDGET_CANDIDATES_MAX)
  const numbers = await financeNumbersByEvent(db, scope, rows.map(row => row.id))
  return rows.map(row => ({ eventId: row.id, name: row.name, budget: row.budget ?? null, version: row.version ?? 0,
    settled: row.settledAt !== null, spent: numbers.get(row.id)!.spent }))
}
// 학생회 전체 알림: 지출이 있는데 기간에 넣지 않은 행사 수, 결제일이 어느 기간에도 들지 않는 상시 운영 지출 수.
async function noticesOf(db: Reader, scope: BudgetScope) {
  const [outsideEvents] = await db.select({ count: sql<number>`count(distinct ${expenses.eventId})::int` }).from(expenses)
    .leftJoin(budgetLines, eq(budgetLines.eventId, expenses.eventId))
    .where(and(eq(expenses.organizationId, scope.organizationId), isNotNull(expenses.eventId), isNull(expenses.voidedAt), isNull(budgetLines.id)))
  // 바깥 지출을 가리키는 하위 질의는 질의 빌더로 만든다.
  const [outsideOperating] = await db.select({ count: sql<number>`count(*)::int` }).from(expenses)
    .where(and(eq(expenses.organizationId, scope.organizationId), isNull(expenses.eventId), isNull(expenses.voidedAt),
      notExists(db.select({ one: sql`1` }).from(budgetPeriods).where(and(eq(budgetPeriods.organizationId, expenses.organizationId),
        lte(budgetPeriods.startsOn, expenses.paidOn), gte(budgetPeriods.endsOn, expenses.paidOn))))))
  return { eventsWithSpending: outsideEvents!.count, operatingOutside: outsideOperating!.count }
}
async function historyOf(db: Reader, scope: BudgetScope, periodId: string) {
  const rows = await db.select({ entry: budgetPeriodEvents, actorName: actors.name }).from(budgetPeriodEvents)
    .innerJoin(actors, eq(actors.id, budgetPeriodEvents.actorId))
    .where(and(eq(budgetPeriodEvents.organizationId, scope.organizationId), eq(budgetPeriodEvents.periodId, periodId)))
    .orderBy(desc(budgetPeriodEvents.createdAt), desc(budgetPeriodEvents.id)).limit(BUDGET_HISTORY_MAX)
  // 최근 것부터 잘라 온 뒤 오래된 순으로 돌린다.
  return rows.reverse().map(({ entry, actorName }) => ({ id: entry.id, action: entry.action, actor: { id: entry.actorId, name: actorName },
    changes: entry.changes, createdAt: entry.createdAt.toISOString() }))
}

// 편성 응답. 바꾸는 요청도 같은 모양으로 돌려준다.
export async function planOf(db: Reader, scope: BudgetScope, periodId: string): Promise<BudgetPlanResponse> {
  const period = await periodOf(db, scope, periodId)
  const lines = await db.select({ line: budgetLines, eventName: events.name }).from(budgetLines)
    .leftJoin(events, and(eq(events.id, budgetLines.eventId), eq(events.organizationId, budgetLines.organizationId)))
    .where(and(eq(budgetLines.organizationId, scope.organizationId), eq(budgetLines.periodId, periodId)))
    .orderBy(asc(budgetLines.position), asc(budgetLines.id))
  const ofKind = (kind: 'income' | 'event' | 'operating') => lines.filter(({ line }) => line.kind === kind)
  // 행사 줄: 금액·버전·정산은 행사 재정에서, 숫자는 행사 재정 탭과 같은 함수로 센다.
  const eventIds = ofKind('event').map(({ line }) => line.eventId!)
  const numbers = await financeNumbersByEvent(db, scope, eventIds)
  const finances = await financeRows(db, scope, eventIds)
  const eventLines = ofKind('event').map(({ line, eventName }) => {
    const finance = finances.get(line.eventId!)
    const counted = numbers.get(line.eventId!)!
    const budget = finance?.budget ?? null
    return { eventId: line.eventId!, name: eventName ?? '', budget, spent: counted.spent, planned: counted.planned,
      plannedUnknown: counted.plannedUnknown, remaining: budget === null ? null : budget - counted.spent - counted.planned,
      settled: Boolean(finance?.settledAt), version: finance?.version ?? 0 }
  })
  // 운영 줄: 그 항목을 고른 지출 가운데 취소하지 않은 것. 고를 때 결제일이 기간 안인지 확인하므로 날짜로 다시 거르지 않는다.
  const operatingIds = ofKind('operating').map(({ line }) => line.id)
  const usage = operatingIds.length ? await db.select({ lineId: expenses.budgetLineId, spent: sql<string>`coalesce(sum(${expenses.amount}), 0)`,
    count: sql<number>`count(*)::int` }).from(expenses)
    .where(and(eq(expenses.organizationId, scope.organizationId), inArray(expenses.budgetLineId, operatingIds), isNull(expenses.voidedAt)))
    .groupBy(expenses.budgetLineId) : []
  const operating = ofKind('operating').map(({ line }) => {
    const used = usage.find(row => row.lineId === line.id)
    const spent = Number(used?.spent ?? 0)
    return { id: line.id, name: line.name!, amount: line.amount!, spent, remaining: line.amount! - spent, expenseCount: used?.count ?? 0 }
  })
  const [unassigned] = await db.select({ spent: sql<string>`coalesce(sum(${expenses.amount}), 0)`, count: sql<number>`count(*)::int` }).from(expenses)
    .where(and(eq(expenses.organizationId, scope.organizationId), isNull(expenses.eventId), isNull(expenses.budgetLineId), isNull(expenses.voidedAt),
      gte(expenses.paidOn, period.startsOn), lte(expenses.paidOn, period.endsOn)))
  const incomes = ofKind('income').map(({ line }) => ({ id: line.id, name: line.name!, amount: line.amount! }))
  const budget = sum(eventLines.map(line => line.budget ?? 0)) + sum(operating.map(line => line.amount))
  const spent = sum(eventLines.map(line => line.spent)) + sum(operating.map(line => line.spent)) + Number(unassigned!.spent)
  const planned = sum(eventLines.map(line => line.planned))
  return {
    period: { id: period.id, name: period.name, startsOn: period.startsOn, endsOn: period.endsOn, version: period.version },
    incomes, events: eventLines, operating, unassigned: { spent: Number(unassigned!.spent), count: unassigned!.count },
    totals: { income: sum(incomes.map(line => line.amount)), budget, undecided: eventLines.filter(line => line.budget === null).length, spent, planned,
      plannedUnknown: sum(eventLines.map(line => line.plannedUnknown)), remaining: budget - spent - planned },
    candidates: await candidatesOf(db, scope),
    notices: await noticesOf(db, scope),
    history: await historyOf(db, scope, periodId),
  }
}

export function createBudgetService(db: BudgetDatabase) {
  return {
    // 시작일이 늦은 순. 기간마다 운영 줄 이름을 붙인다(지출 대화상자의 운영 항목 고르기).
    async periods(scope: BudgetScope): Promise<BudgetPeriodsResponse> {
      const rows = await db.select().from(budgetPeriods).where(eq(budgetPeriods.organizationId, scope.organizationId))
        .orderBy(desc(budgetPeriods.startsOn), desc(budgetPeriods.id)).limit(BUDGET_PERIODS_MAX)
      const ids = rows.map(row => row.id)
      const lines = ids.length ? await db.select({ id: budgetLines.id, name: budgetLines.name, periodId: budgetLines.periodId }).from(budgetLines)
        .where(and(eq(budgetLines.organizationId, scope.organizationId), inArray(budgetLines.periodId, ids), eq(budgetLines.kind, 'operating')))
        .orderBy(asc(budgetLines.position), asc(budgetLines.id)) : []
      return { periods: rows.map(row => ({ id: row.id, name: row.name, startsOn: row.startsOn, endsOn: row.endsOn,
        operating: lines.filter(line => line.periodId === row.id).map(line => ({ id: line.id, name: line.name! })) })) }
    },
    plan: (scope: BudgetScope, periodId: string) => planOf(db, scope, periodId),
    async createPeriod(scope: BudgetScope, input: CreateBudgetPeriodRequest): Promise<BudgetPlanResponse> {
      return db.transaction(async tx => {
        await requireFinance(tx, scope, true)
        await lockBudget(tx, scope.organizationId)
        await assertPeriodFree(tx, scope, input)
        const id = randomUUID()
        await tx.insert(budgetPeriods).values({ id, organizationId: scope.organizationId, name: input.name, startsOn: input.startsOn,
          endsOn: input.endsOn, createdBy: scope.userId })
        await recordPeriod(tx, scope, id, 'created', { name: input.name, startsOn: input.startsOn, endsOn: input.endsOn })
        return planOf(tx, scope, id)
      })
    },
  }
}
