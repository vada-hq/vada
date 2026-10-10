import { randomUUID } from 'node:crypto'
import { and, asc, eq, inArray, isNull, ne, notExists, sql } from 'drizzle-orm'
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core'
import type { CreateExpenseRequest, ExpenseAction, ExpenseDetail, ExpensesResponse, LinkableItemsResponse, UpdateExpenseRequest,
  VoidExpenseRequest } from '@vada/contracts'
import { budgetLines, budgetPeriods, events, expenseEvents, expenseItems, expenseReceipts, expenses, memberships, purchaseItemEvents,
  purchaseItems as items, users } from '../db/schema.js'
import { operatingDays, requireOpenDays, shareBudget } from '../budget/lock.js'
import { ApiError } from '../http/errors.js'
import { requireFinance } from '../purchases/review.js'
import { requireOpenEvents } from '../settlement/lock.js'
import { expenseDetail, expenseItemRows, expenseSummaries } from './summaries.js'

type Db = PgDatabase<PgQueryResultHKT>
export type ExpenseDatabase = Pick<Db, 'select' | 'insert' | 'update' | 'delete' | 'transaction'>
type Reader = Pick<Db, 'select'>
export type ExpenseTransaction = Parameters<Parameters<ExpenseDatabase['transaction']>[0]>[0]
export interface ExpenseScope { organizationId: string; userId: string }
const LIST_LIMIT = 300
const LINKABLE_LIMIT = 300

export async function recordExpense(tx: ExpenseTransaction, scope: ExpenseScope, expenseId: string, action: ExpenseAction,
  changes: Record<string, unknown> = {}) {
  await tx.insert(expenseEvents).values({ id: randomUUID(), organizationId: scope.organizationId, expenseId, actorId: scope.userId, action, changes })
}
// 지출 행을 잠가 가져온다. 다른 학생회의 지출은 없는 것으로 본다.
export async function lockExpense(tx: ExpenseTransaction, scope: ExpenseScope, id: string) {
  const [row] = await tx.select().from(expenses).where(and(eq(expenses.organizationId, scope.organizationId), eq(expenses.id, id))).for('update')
  if (!row) throw new ApiError('NOT_FOUND', 404)
  return row
}
export async function detailOf(db: Reader, scope: ExpenseScope, id: string): Promise<ExpenseDetail> {
  const [summary] = await expenseSummaries(db, scope.organizationId, eq(expenses.id, id), 1)
  if (!summary) throw new ApiError('NOT_FOUND', 404)
  return expenseDetail(db, scope.organizationId, summary)
}
// 행사 이름. 상시 운영은 null이다. 다른 학생회의 행사는 없는 것으로 본다.
async function eventName(db: Reader, scope: ExpenseScope, eventId: string | null) {
  if (eventId === null) return null
  const [event] = await db.select({ name: events.name }).from(events)
    .where(and(eq(events.organizationId, scope.organizationId), eq(events.id, eventId)))
  if (!event) throw new ApiError('NOT_FOUND', 404)
  return event.name
}
// 결제한 사람은 같은 학생회 소속이어야 한다.
async function payerOf(db: Reader, scope: ExpenseScope, membershipId: string) {
  const [member] = await db.select({ userId: memberships.userId, name: users.name }).from(memberships)
    .innerJoin(users, eq(users.id, memberships.userId))
    .where(and(eq(memberships.organizationId, scope.organizationId), eq(memberships.id, membershipId)))
  if (!member) throw new ApiError('PAYER_NOT_MEMBER', 400)
  return member
}
async function userName(db: Reader, userId: string) {
  const [user] = await db.select({ name: users.name }).from(users).where(eq(users.id, userId))
  return user?.name ?? ''
}
// 운영 항목. 상시 운영 지출만 고르고(계약이 막는다), 결제일이 든 기간의 운영 줄이어야 한다.
// 그 기간 행을 FOR SHARE로 잠가 편성 수정(기간 FOR UPDATE)과 겹치지 않게 한다. 행사 행보다 먼저 잠가 잠금 순서(기간 → 행사)를 맞춘다.
async function budgetLineName(tx: ExpenseTransaction, scope: ExpenseScope, lineId: string | null, paidOn: string) {
  if (lineId === null) return null
  const find = () => tx.select({ name: budgetLines.name, kind: budgetLines.kind, periodId: budgetLines.periodId }).from(budgetLines)
    .where(and(eq(budgetLines.organizationId, scope.organizationId), eq(budgetLines.id, lineId)))
  const [line] = await find()
  if (!line || line.kind !== 'operating') throw new ApiError('BUDGET_LINE_INVALID', 409)
  const [period] = await tx.select({ startsOn: budgetPeriods.startsOn, endsOn: budgetPeriods.endsOn }).from(budgetPeriods)
    .where(eq(budgetPeriods.id, line.periodId)).for('share')
  // 잠그기 전에 편성 수정이 줄을 지웠거나 이름을 바꿨을 수 있어 다시 읽는다.
  const [locked] = await find()
  if (!period || !locked || paidOn < period.startsOn || paidOn > period.endsOn) throw new ApiError('BUDGET_LINE_INVALID', 409)
  return locked.name
}
async function lineName(db: Reader, lineId: string | null) {
  if (lineId === null) return null
  const [line] = await db.select({ name: budgetLines.name }).from(budgetLines).where(eq(budgetLines.id, lineId))
  return line?.name ?? null
}
async function linkedIds(db: Reader, scope: ExpenseScope, expenseId: string) {
  const rows = await db.select({ id: expenseItems.purchaseItemId }).from(expenseItems)
    .where(and(eq(expenseItems.organizationId, scope.organizationId), eq(expenseItems.expenseId, expenseId)))
  return rows.map(row => row.id)
}
// 품목을 지출에 연결한다. 같은 행사의 승인 품목만, 다른 지출에 연결되지 않은 것만 받는다.
// 품목 행을 ID 순서로 잠가 같은 품목을 두 지출이 동시에 연결하지 못하게 한다. 아직 사기 전이면 구매함으로 표시한다.
async function linkItems(tx: ExpenseTransaction, scope: ExpenseScope, expenseId: string, eventId: string | null, itemIds: string[]) {
  if (!itemIds.length) return
  if (eventId === null) throw new ApiError('ITEM_NOT_LINKABLE', 409)
  const rows = await tx.select().from(items).where(and(eq(items.organizationId, scope.organizationId), inArray(items.id, itemIds)))
    .orderBy(asc(items.id)).for('update')
  if (rows.length !== itemIds.length) throw new ApiError('NOT_FOUND', 404)
  if (rows.some(row => row.status !== 'approved' || row.eventId !== eventId)) throw new ApiError('ITEM_NOT_LINKABLE', 409)
  const taken = await tx.select({ id: expenseItems.purchaseItemId }).from(expenseItems).where(and(eq(expenseItems.organizationId, scope.organizationId),
    inArray(expenseItems.purchaseItemId, itemIds), ne(expenseItems.expenseId, expenseId)))
  if (taken.length) throw new ApiError('ITEM_NOT_LINKABLE', 409)
  await tx.insert(expenseItems).values(itemIds.map(purchaseItemId => ({ purchaseItemId, organizationId: scope.organizationId, expenseId })))
  const unbought = rows.filter(row => row.purchasedAt === null)
  if (!unbought.length) return
  await tx.update(items).set({ purchasedAt: sql`now()`, purchasedBy: scope.userId, version: sql`${items.version} + 1` })
    .where(inArray(items.id, unbought.map(row => row.id)))
  await tx.insert(purchaseItemEvents).values(unbought.map(row => ({ id: randomUUID(), organizationId: scope.organizationId, itemId: row.id,
    actorId: scope.userId, action: 'purchased' as const, changes: { expenseId } })))
}
const fieldsOf = (input: CreateExpenseRequest, payerId: string) => ({ eventId: input.eventId, vendor: input.vendor, description: input.description,
  amount: input.amount, paidOn: input.paidOn, method: input.method, payerId, note: input.note, budgetLineId: input.budgetLineId })

export function createExpenseService(db: ExpenseDatabase) {
  return {
    // 학생회 누구나 본다. 합계는 취소한 지출을 빼고, 이번 달은 한국 시간 기준이다.
    async list(scope: ExpenseScope): Promise<ExpensesResponse> {
      const rows = await expenseSummaries(db, scope.organizationId, undefined, LIST_LIMIT + 1)
      const month = sql`date_trunc('month', now() AT TIME ZONE 'Asia/Seoul')`
      const [totals] = await db.select({
        thisMonth: sql<string>`coalesce(sum(${expenses.amount}) filter (where ${expenses.paidOn} >= (${month})::date and ${expenses.paidOn} < (${month} + interval '1 month')::date), 0)`,
        total: sql<string>`coalesce(sum(${expenses.amount}), 0)`,
        // 표 하나만 고르는 select는 sql 안의 열에서 표 이름을 떼므로, 바깥 지출을 가리키는 하위 질의는 질의 빌더로 만든다.
        missingEvidence: sql<number>`(count(*) filter (where ${notExists(db.select({ one: sql`1` }).from(expenseReceipts)
          .where(and(eq(expenseReceipts.expenseId, expenses.id), eq(expenseReceipts.status, 'ready'))))}))::int`,
      }).from(expenses).where(and(eq(expenses.organizationId, scope.organizationId), isNull(expenses.voidedAt)))
      return { expenses: rows.slice(0, LIST_LIMIT), truncated: rows.length > LIST_LIMIT,
        totals: { thisMonth: Number(totals!.thisMonth), total: Number(totals!.total), missingEvidence: totals!.missingEvidence } }
    },
    get: (scope: ExpenseScope, id: string) => detailOf(db, scope, id),
    // 지출 기록 대화상자의 품목 고르기. 연결 안 된 승인 품목만 행사 이름 순으로 준다.
    async linkableItems(scope: ExpenseScope): Promise<LinkableItemsResponse> {
      await requireFinance(db, scope)
      const rows = await expenseItemRows(db, scope.organizationId, and(eq(items.status, 'approved'), isNull(expenseItems.expenseId)), LINKABLE_LIMIT + 1)
      return { items: rows.slice(0, LINKABLE_LIMIT).map(row => row.item), truncated: rows.length > LINKABLE_LIMIT }
    },
    async create(scope: ExpenseScope, input: CreateExpenseRequest): Promise<ExpenseDetail> {
      return db.transaction(async tx => {
        await requireFinance(tx, scope, true)
        // 결제일이 마감한 회계 기간 안인 상시 운영 지출은 기록하지 않는다.
        await requireOpenDays(tx, scope.organizationId, operatingDays(input))
        await budgetLineName(tx, scope, input.budgetLineId, input.paidOn)
        await requireOpenEvents(tx, scope.organizationId, [input.eventId])
        await eventName(tx, scope, input.eventId)
        const payer = await payerOf(tx, scope, input.payerMembershipId)
        const id = randomUUID()
        await tx.insert(expenses).values({ id, organizationId: scope.organizationId, ...fieldsOf(input, payer.userId), recordedBy: scope.userId })
        await linkItems(tx, scope, id, input.eventId, input.itemIds)
        await recordExpense(tx, scope, id, 'created')
        return detailOf(tx, scope, id)
      })
    },
    // 모든 칸과 연결 품목 전체를 받는다. 바뀐 칸은 이전·이후 값으로, 품목은 더하고 뺀 수로 남긴다.
    async update(scope: ExpenseScope, id: string, input: UpdateExpenseRequest): Promise<ExpenseDetail> {
      return db.transaction(async tx => {
        await requireFinance(tx, scope, true)
        await shareBudget(tx, scope.organizationId)
        const row = await lockExpense(tx, scope, id)
        if (row.version !== input.version) throw new ApiError('VERSION_CONFLICT', 409)
        if (row.voidedAt) throw new ApiError('INVALID_STATE', 409)
        // 마감한 회계 기간에서 빼거나 그리로 옮기는 것도 막는다.
        await requireOpenDays(tx, scope.organizationId, operatingDays(row, input))
        const nextLine = await budgetLineName(tx, scope, input.budgetLineId, input.paidOn)
        // 정산된 행사에서 빼거나 정산된 행사로 옮기는 것도 막는다.
        await requireOpenEvents(tx, scope.organizationId, [row.eventId, input.eventId])
        const nextEvent = await eventName(tx, scope, input.eventId)
        const payer = await payerOf(tx, scope, input.payerMembershipId)
        const changes: Record<string, unknown> = {}
        if (row.eventId !== input.eventId) changes.event = { from: await eventName(tx, scope, row.eventId), to: nextEvent }
        const plain = { vendor: input.vendor, description: input.description, amount: input.amount, paidOn: input.paidOn, method: input.method, note: input.note }
        for (const key of Object.keys(plain) as (keyof typeof plain)[]) {
          if (row[key] !== plain[key]) changes[key] = { from: row[key], to: plain[key] }
        }
        if (row.payerId !== payer.userId) changes.payer = { from: await userName(tx, row.payerId), to: payer.name }
        if (row.budgetLineId !== input.budgetLineId) changes.budgetLine = { from: await lineName(tx, row.budgetLineId), to: nextLine }
        const before = await linkedIds(tx, scope, id)
        const added = input.itemIds.filter(itemId => !before.includes(itemId)).length
        const removed = before.filter(itemId => !input.itemIds.includes(itemId)).length
        if (added || removed) changes.items = { added, removed }
        if (!Object.keys(changes).length) return detailOf(tx, scope, id)
        await tx.update(expenses).set({ ...fieldsOf(input, payer.userId), version: sql`${expenses.version} + 1` }).where(eq(expenses.id, id))
        await tx.delete(expenseItems).where(and(eq(expenseItems.organizationId, scope.organizationId), eq(expenseItems.expenseId, id)))
        await linkItems(tx, scope, id, input.eventId, input.itemIds)
        await recordExpense(tx, scope, id, 'updated', changes)
        return detailOf(tx, scope, id)
      })
    },
    // 지우지 않고 취소로 남긴다. 연결 품목은 풀어 다른 지출에 연결할 수 있게 한다.
    async void(scope: ExpenseScope, id: string, input: VoidExpenseRequest): Promise<ExpenseDetail> {
      return db.transaction(async tx => {
        await requireFinance(tx, scope, true)
        await shareBudget(tx, scope.organizationId)
        const row = await lockExpense(tx, scope, id)
        if (row.version !== input.version) throw new ApiError('VERSION_CONFLICT', 409)
        if (row.voidedAt) throw new ApiError('INVALID_STATE', 409)
        await requireOpenDays(tx, scope.organizationId, operatingDays(row))
        await requireOpenEvents(tx, scope.organizationId, [row.eventId])
        const released = await linkedIds(tx, scope, id)
        await tx.update(expenses).set({ voidedAt: sql`now()`, voidedBy: scope.userId, voidReason: input.reason,
          version: sql`${expenses.version} + 1` }).where(eq(expenses.id, id))
        await tx.delete(expenseItems).where(and(eq(expenseItems.organizationId, scope.organizationId), eq(expenseItems.expenseId, id)))
        await recordExpense(tx, scope, id, 'voided', { reason: input.reason, releasedItems: released.length })
        return detailOf(tx, scope, id)
      })
    },
  }
}
