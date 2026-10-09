import { randomUUID } from 'node:crypto'
import { and, asc, desc, eq, gt, gte, inArray, isNotNull, isNull, lt, lte, ne, notExists, or, sql } from 'drizzle-orm'
import { alias, type PgDatabase, type PgQueryResultHKT } from 'drizzle-orm/pg-core'
import { BUDGET_CANDIDATES_MAX, BUDGET_HISTORY_MAX, BUDGET_PERIODS_MAX, INCOME_RECORDS_MAX, type BudgetChange, type BudgetPeriodAction,
  type BudgetPeriodsResponse, type BudgetPlanResponse, type CreateBudgetPeriodRequest, type SaveBudgetPlanRequest } from '@vada/contracts'
import { budgetLines, budgetPeriodEvents, budgetPeriods, eventFinances, events, expenseReceipts, expenses, incomes, organizations,
  users } from '../db/schema.js'
import { ApiError } from '../http/errors.js'
import { incomeSummaries } from '../incomes/service.js'
import { requireFinance } from '../purchases/review.js'
import { changeEventBudget, financeNumbersByEvent } from '../settlement/service.js'
import type { PeriodSheetData } from './workbook.js'

type Db = PgDatabase<PgQueryResultHKT>
export type BudgetDatabase = Pick<Db, 'select' | 'insert' | 'update' | 'delete' | 'transaction'>
type Reader = Pick<Db, 'select'>
type Transaction = Parameters<Parameters<BudgetDatabase['transaction']>[0]>[0]
export interface BudgetScope { organizationId: string; userId: string }
const actors = alias(users, 'budget_actors')
const sum = (values: number[]) => values.reduce((total, value) => total + value, 0)
// 결산서 상한. 수입·지출이 각각 이보다 많으면 만들지 않는다(행사 정산서와 같다).
const EXPORT_LIMIT = 1000
const exportLines = alias(budgetLines, 'export_lines')
const exportPayers = alias(users, 'export_payers')
const exportRecorders = alias(users, 'export_recorders')
const exportUploaders = alias(users, 'export_uploaders')

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

type Period = typeof budgetPeriods.$inferSelect
export type PeriodNumbers = Pick<BudgetPlanResponse, 'incomes' | 'events' | 'operating' | 'unassigned' | 'unassignedIncome' | 'totals'>

// 기간 하나의 줄과 숫자. 예산 화면과 결산서가 같은 정의를 쓴다.
export async function periodNumbers(db: Reader, scope: BudgetScope, period: Period): Promise<PeriodNumbers> {
  const periodId = period.id
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
  // 수입 줄: 그 줄을 고른 수입 가운데 취소하지 않은 것. 줄이 없는 묶음이 항목 없는 수입이다.
  // 고를 때 같은 기간의 줄인지 확인하므로, 이 기간의 수입을 줄별로 묶으면 모든 수입이 한 번씩 들어간다.
  const received = await db.select({ lineId: incomes.budgetLineId, received: sql<string>`coalesce(sum(${incomes.amount}), 0)`,
    count: sql<number>`count(*)::int` }).from(incomes)
    .where(and(eq(incomes.organizationId, scope.organizationId), eq(incomes.periodId, periodId), isNull(incomes.voidedAt)))
    .groupBy(incomes.budgetLineId)
  const incomeLines = ofKind('income').map(({ line }) => {
    const got = received.find(row => row.lineId === line.id)
    return { id: line.id, name: line.name!, amount: line.amount!, received: Number(got?.received ?? 0), incomeCount: got?.count ?? 0 }
  })
  const loose = received.find(row => row.lineId === null)
  const totalReceived = sum(received.map(row => Number(row.received)))
  const budget = sum(eventLines.map(line => line.budget ?? 0)) + sum(operating.map(line => line.amount))
  const spent = sum(eventLines.map(line => line.spent)) + sum(operating.map(line => line.spent)) + Number(unassigned!.spent)
  const planned = sum(eventLines.map(line => line.planned))
  return {
    incomes: incomeLines, events: eventLines, operating, unassigned: { spent: Number(unassigned!.spent), count: unassigned!.count },
    unassignedIncome: { received: Number(loose?.received ?? 0), count: loose?.count ?? 0 },
    totals: { income: sum(incomeLines.map(line => line.amount)), received: totalReceived, budget,
      undecided: eventLines.filter(line => line.budget === null).length, spent, planned, plannedUnknown: sum(eventLines.map(line => line.plannedUnknown)),
      remaining: budget - spent - planned, balance: totalReceived - spent },
  }
}

// 편성 응답. 바꾸는 요청도 같은 모양으로 돌려준다.
export async function planOf(db: Reader, scope: BudgetScope, periodId: string): Promise<BudgetPlanResponse> {
  const period = await periodOf(db, scope, periodId)
  const records = await incomeSummaries(db, scope.organizationId, eq(incomes.periodId, periodId), INCOME_RECORDS_MAX + 1)
  return {
    period: { id: period.id, name: period.name, startsOn: period.startsOn, endsOn: period.endsOn, version: period.version },
    ...await periodNumbers(db, scope, period),
    candidates: await candidatesOf(db, scope),
    notices: await noticesOf(db, scope),
    history: await historyOf(db, scope, periodId),
    incomeRecords: records.slice(0, INCOME_RECORDS_MAX),
    incomeRecordsTruncated: records.length > INCOME_RECORDS_MAX,
  }
}

type Line = typeof budgetLines.$inferSelect
type LineInput = SaveBudgetPlanRequest['incomes'][number]

// 수입·운영 줄을 보낸 목록대로 맞춘다. 보내지 않은 기존 줄은 지운다.
// 취소하지 않은 지출(운영 줄)이나 수입(수입 줄)이 고른 줄은 지우지 않고, 취소한 기록에 남은 항목 표시는 함께 지운다(기록 시각은 그대로 둔다).
async function applyLines(tx: Transaction, scope: BudgetScope, periodId: string, kind: 'income' | 'operating', existing: Line[], input: LineInput[]) {
  const current = existing.filter(line => line.kind === kind)
  const kept = new Set(input.flatMap(entry => entry.id === null ? [] : [entry.id]))
  if ([...kept].some(id => !current.some(line => line.id === id))) throw new ApiError('NOT_FOUND', 404)
  const removed = current.filter(line => !kept.has(line.id))
  const changes: BudgetChange[] = []
  if (removed.length) {
    const ids = removed.map(line => line.id)
    if (kind === 'operating') {
      const [used] = await tx.select({ count: sql<number>`count(*)::int` }).from(expenses)
        .where(and(eq(expenses.organizationId, scope.organizationId), inArray(expenses.budgetLineId, ids), isNull(expenses.voidedAt)))
      if (used!.count) throw new ApiError('LINE_IN_USE', 409)
      await tx.update(expenses).set({ budgetLineId: null, updatedAt: sql`${expenses.updatedAt}` })
        .where(and(eq(expenses.organizationId, scope.organizationId), inArray(expenses.budgetLineId, ids)))
    } else {
      const [used] = await tx.select({ count: sql<number>`count(*)::int` }).from(incomes)
        .where(and(eq(incomes.organizationId, scope.organizationId), inArray(incomes.budgetLineId, ids), isNull(incomes.voidedAt)))
      if (used!.count) throw new ApiError('LINE_IN_USE', 409)
      await tx.update(incomes).set({ budgetLineId: null, updatedAt: sql`${incomes.updatedAt}` })
        .where(and(eq(incomes.organizationId, scope.organizationId), inArray(incomes.budgetLineId, ids)))
    }
    await tx.delete(budgetLines).where(inArray(budgetLines.id, ids))
  }
  for (const [position, entry] of input.entries()) {
    const before = current.find(line => line.id === entry.id)
    if (!before) {
      await tx.insert(budgetLines).values({ id: randomUUID(), organizationId: scope.organizationId, periodId, kind, name: entry.name, amount: entry.amount,
        position })
      changes.push({ group: kind, action: 'added', name: entry.name, to: entry.amount })
      continue
    }
    const edited = before.name !== entry.name || before.amount !== entry.amount
    if (edited || before.position !== position) {
      await tx.update(budgetLines).set({ name: entry.name, amount: entry.amount, position }).where(eq(budgetLines.id, before.id))
    }
    if (edited) changes.push({ group: kind, action: 'changed', name: entry.name, ...(before.name === entry.name ? {} : { previousName: before.name! }),
      from: before.amount, to: entry.amount })
  }
  for (const line of removed) changes.push({ group: kind, action: 'removed', name: line.name!, from: line.amount })
  return changes
}

// 행사 줄을 보낸 목록대로 맞춘다. 다른 기간에 넣은 행사는 받지 않는다.
// 금액을 보낸 행사 가운데 예산이 바뀐 것만 행사 재정의 버전을 보고 바꾼다(M2-2와 같은 잠금·기록). 교착을 피하려고 행사 ID 순으로 잠근다.
// 금액을 보내지 않은 행사는 예산·버전을 보지 않는다. 행사 재정 탭에서 바뀐 줄 때문에 편성 저장이 막히지 않게 하려는 것이다.
async function applyEvents(tx: Transaction, scope: BudgetScope, periodId: string, existing: Line[], input: SaveBudgetPlanRequest['events']) {
  const current = existing.filter(line => line.kind === 'event')
  const wanted = new Set(input.map(entry => entry.eventId))
  const involved = [...new Set([...wanted, ...current.map(line => line.eventId!)])]
  const named = involved.length ? await tx.select({ id: events.id, name: events.name }).from(events)
    .where(and(eq(events.organizationId, scope.organizationId), inArray(events.id, involved))) : []
  if (named.length !== involved.length) throw new ApiError('NOT_FOUND', 404)
  const nameOf = (eventId: string) => named.find(row => row.id === eventId)!.name
  const added = input.filter(entry => !current.some(line => line.eventId === entry.eventId))
  if (added.length) {
    const [taken] = await tx.select({ id: budgetLines.id }).from(budgetLines)
      .where(and(eq(budgetLines.organizationId, scope.organizationId), inArray(budgetLines.eventId, added.map(entry => entry.eventId)))).limit(1)
    if (taken) throw new ApiError('EVENT_IN_OTHER_PERIOD', 409)
  }
  const before = await financeRows(tx, scope, involved)
  const budgetOf = (eventId: string) => before.get(eventId)?.budget ?? null
  const changing = (entry: SaveBudgetPlanRequest['events'][number]) => entry.budget !== undefined && entry.budget !== budgetOf(entry.eventId)
  const removed = current.filter(line => !wanted.has(line.eventId!))
  if (removed.length) await tx.delete(budgetLines).where(inArray(budgetLines.id, removed.map(line => line.id)))
  for (const entry of [...input].sort((a, b) => (a.eventId < b.eventId ? -1 : 1))) {
    if (changing(entry)) await changeEventBudget(tx, scope, entry.eventId, entry.version, entry.budget!)
  }
  const changes: BudgetChange[] = []
  for (const [position, entry] of input.entries()) {
    const line = current.find(item => item.eventId === entry.eventId)
    if (!line) {
      await tx.insert(budgetLines).values({ id: randomUUID(), organizationId: scope.organizationId, periodId, kind: 'event', eventId: entry.eventId, position })
      changes.push({ group: 'event', action: 'added', name: nameOf(entry.eventId), to: entry.budget === undefined ? budgetOf(entry.eventId) : entry.budget })
      continue
    }
    if (line.position !== position) await tx.update(budgetLines).set({ position }).where(eq(budgetLines.id, line.id))
    if (changing(entry)) {
      changes.push({ group: 'event', action: 'changed', name: nameOf(entry.eventId), from: budgetOf(entry.eventId), to: entry.budget! })
    }
  }
  for (const line of removed) changes.push({ group: 'event', action: 'removed', name: nameOf(line.eventId!), from: budgetOf(line.eventId!) })
  return changes
}

// 날짜를 바꿀 때: 이 기간의 운영 항목을 고른 지출(취소하지 않은 것)은 결제일이 새 기간 안이어야 한다.
async function assertExpensesInside(tx: Transaction, scope: BudgetScope, periodId: string, input: { startsOn: string; endsOn: string }) {
  const [outside] = await tx.select({ id: expenses.id }).from(expenses)
    .innerJoin(budgetLines, and(eq(budgetLines.id, expenses.budgetLineId), eq(budgetLines.organizationId, expenses.organizationId)))
    .where(and(eq(expenses.organizationId, scope.organizationId), eq(budgetLines.periodId, periodId), isNull(expenses.voidedAt),
      or(lt(expenses.paidOn, input.startsOn), gt(expenses.paidOn, input.endsOn)))).limit(1)
  if (outside) throw new ApiError('EXPENSES_OUTSIDE_PERIOD', 409)
}
// 날짜를 바꿀 때: 이 기간의 취소하지 않은 수입은 받은 날이 새 기간 안이어야 한다. 그래서 어느 기간에도 들지 않는 수입은 생기지 않는다.
async function assertIncomesInside(tx: Transaction, scope: BudgetScope, periodId: string, input: { startsOn: string; endsOn: string }) {
  const [outside] = await tx.select({ id: incomes.id }).from(incomes)
    .where(and(eq(incomes.organizationId, scope.organizationId), eq(incomes.periodId, periodId), isNull(incomes.voidedAt),
      or(lt(incomes.receivedOn, input.startsOn), gt(incomes.receivedOn, input.endsOn)))).limit(1)
  if (outside) throw new ApiError('INCOMES_OUTSIDE_PERIOD', 409)
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
    // 편성 전체를 보낸 대로 맞춘다. 바뀐 것이 없으면 버전과 기록을 그대로 둔다.
    async savePlan(scope: BudgetScope, periodId: string, input: SaveBudgetPlanRequest): Promise<BudgetPlanResponse> {
      return db.transaction(async tx => {
        await requireFinance(tx, scope, true)
        await lockBudget(tx, scope.organizationId)
        const period = await periodOf(tx, scope, periodId, true)
        if (period.version !== input.version) throw new ApiError('VERSION_CONFLICT', 409)
        const changes: Record<string, unknown> = {}
        for (const key of ['name', 'startsOn', 'endsOn'] as const) {
          if (period[key] !== input[key]) changes[key] = { from: period[key], to: input[key] }
        }
        if (Object.keys(changes).length) await assertPeriodFree(tx, scope, input, periodId)
        const existing = await tx.select().from(budgetLines)
          .where(and(eq(budgetLines.organizationId, scope.organizationId), eq(budgetLines.periodId, periodId)))
        const lines = [
          ...await applyLines(tx, scope, periodId, 'income', existing, input.incomes),
          ...await applyLines(tx, scope, periodId, 'operating', existing, input.operating),
          ...await applyEvents(tx, scope, periodId, existing, input.events),
        ]
        if (changes.startsOn || changes.endsOn) {
          await assertExpensesInside(tx, scope, periodId, input)
          await assertIncomesInside(tx, scope, periodId, input)
        }
        if (lines.length) changes.lines = lines
        if (Object.keys(changes).length) {
          await tx.update(budgetPeriods).set({ name: input.name, startsOn: input.startsOn, endsOn: input.endsOn,
            version: sql`${budgetPeriods.version} + 1` }).where(eq(budgetPeriods.id, periodId))
          await recordPeriod(tx, scope, periodId, 'updated', changes)
        }
        return planOf(tx, scope, periodId)
      })
    },
    // 결산서 자료. 한 시점의 값이 되도록 읽기 전용 REPEATABLE READ 거래 하나에서 읽는다.
    // 지출은 3a 기준이다: 이 기간에 넣은 행사의 지출 전부(결제일과 상관없이)와, 결제일이 기간 안인 상시 운영 지출.
    async exportData(scope: BudgetScope, periodId: string, publicOrigin: string): Promise<PeriodSheetData> {
      return db.transaction(async tx => {
        const period = await periodOf(tx, scope, periodId)
        const numbers = await periodNumbers(tx, scope, period)
        const incomeRows = await tx.select({ income: incomes, lineName: exportLines.name, recorderName: exportRecorders.name }).from(incomes)
          .leftJoin(exportLines, and(eq(exportLines.id, incomes.budgetLineId), eq(exportLines.organizationId, incomes.organizationId)))
          .innerJoin(exportRecorders, eq(exportRecorders.id, incomes.recordedBy))
          .where(and(eq(incomes.organizationId, scope.organizationId), eq(incomes.periodId, periodId), isNull(incomes.voidedAt)))
          .orderBy(asc(incomes.receivedOn), asc(incomes.createdAt), asc(incomes.id)).limit(EXPORT_LIMIT + 1)
        if (incomeRows.length > EXPORT_LIMIT) throw new ApiError('EXPORT_TOO_LARGE', 409)
        const eventIds = numbers.events.map(line => line.eventId)
        const counted = or(eventIds.length ? inArray(expenses.eventId, eventIds) : undefined,
          and(isNull(expenses.eventId), gte(expenses.paidOn, period.startsOn), lte(expenses.paidOn, period.endsOn)))
        const expenseRows = await tx.select({ expense: expenses, eventName: events.name, lineName: exportLines.name, payerName: exportPayers.name,
          recorderName: exportRecorders.name }).from(expenses)
          .leftJoin(events, and(eq(events.id, expenses.eventId), eq(events.organizationId, expenses.organizationId)))
          .leftJoin(exportLines, and(eq(exportLines.id, expenses.budgetLineId), eq(exportLines.organizationId, expenses.organizationId)))
          .innerJoin(exportPayers, eq(exportPayers.id, expenses.payerId))
          .innerJoin(exportRecorders, eq(exportRecorders.id, expenses.recordedBy))
          .where(and(eq(expenses.organizationId, scope.organizationId), isNull(expenses.voidedAt), counted))
          .orderBy(asc(expenses.paidOn), asc(expenses.createdAt), asc(expenses.id)).limit(EXPORT_LIMIT + 1)
        if (expenseRows.length > EXPORT_LIMIT) throw new ApiError('EXPORT_TOO_LARGE', 409)
        const ids = expenseRows.map(row => row.expense.id)
        const receipts = ids.length ? await tx.select({ receipt: expenseReceipts, uploaderName: exportUploaders.name }).from(expenseReceipts)
          .innerJoin(exportUploaders, eq(exportUploaders.id, expenseReceipts.uploadedBy))
          .where(and(eq(expenseReceipts.organizationId, scope.organizationId), inArray(expenseReceipts.expenseId, ids), eq(expenseReceipts.status, 'ready')))
          .orderBy(asc(expenseReceipts.createdAt), asc(expenseReceipts.id)) : []
        const receiptsOf = new Map<string, typeof receipts>()
        for (const entry of receipts) receiptsOf.set(entry.receipt.expenseId, [...receiptsOf.get(entry.receipt.expenseId) ?? [], entry])
        const [voidedIncomes] = await tx.select({ count: sql<number>`count(*)::int` }).from(incomes)
          .where(and(eq(incomes.organizationId, scope.organizationId), eq(incomes.periodId, periodId), isNotNull(incomes.voidedAt)))
        const [voidedExpenses] = await tx.select({ count: sql<number>`count(*)::int` }).from(expenses)
          .where(and(eq(expenses.organizationId, scope.organizationId), isNotNull(expenses.voidedAt), counted))
        const [organization] = await tx.select({ name: organizations.name }).from(organizations).where(eq(organizations.id, scope.organizationId))
        // 영수증 보기 주소. 로그인한 구성원이면 짧게 사는 서명 주소로 이동해 파일이 열린다(행사 정산서와 같다).
        const fileUrl = (expenseId: string, receiptId: string) => new URL(`/api/organizations/${encodeURIComponent(scope.organizationId)}/expenses/${
          encodeURIComponent(expenseId)}/receipts/${encodeURIComponent(receiptId)}/file`, publicOrigin).href
        const lineOf = (row: typeof expenseRows[number]) => row.expense.eventId ? row.eventName ?? ''
          : row.lineName ? `상시 운영 · ${row.lineName}` : '상시 운영'
        return {
          organizationName: organization?.name ?? '', period: { name: period.name, startsOn: period.startsOn, endsOn: period.endsOn }, exportedAt: new Date(),
          incomeLines: numbers.incomes.map(({ name, amount, received }) => ({ name, amount, received })),
          unassignedIncome: numbers.unassignedIncome,
          eventLines: numbers.events.map(({ name, budget, spent, planned, plannedUnknown, remaining, settled }) =>
            ({ name, budget, spent, planned, plannedUnknown, remaining, settled })),
          operatingLines: numbers.operating.map(({ name, amount, spent, remaining }) => ({ name, amount, spent, remaining })),
          unassigned: numbers.unassigned, totals: numbers.totals,
          incomes: incomeRows.map(({ income, lineName, recorderName }) => ({ receivedOn: income.receivedOn, line: income.budgetLineId ? lineName : null,
            description: income.description, amount: income.amount, note: income.note, recordedBy: recorderName })),
          expenses: expenseRows.map(row => ({ paidOn: row.expense.paidOn, line: lineOf(row), vendor: row.expense.vendor, description: row.expense.description,
            amount: row.expense.amount, method: row.expense.method, payer: row.payerName, note: row.expense.note, recordedBy: row.recorderName,
            receipts: (receiptsOf.get(row.expense.id) ?? []).map(({ receipt, uploaderName }) => ({ kind: receipt.kind, fileName: receipt.fileName,
              uploadedBy: uploaderName, uploadedAt: receipt.confirmedAt ?? receipt.createdAt, url: fileUrl(row.expense.id, receipt.id) })) })),
          voided: { incomes: voidedIncomes!.count, expenses: voidedExpenses!.count },
        }
      }, { isolationLevel: 'repeatable read', accessMode: 'read only' })
    },
  }
}
