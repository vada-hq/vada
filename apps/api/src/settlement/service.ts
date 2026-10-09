import { randomUUID } from 'node:crypto'
import { and, asc, desc, eq, inArray, isNotNull, isNull, notExists, sql, type SQL } from 'drizzle-orm'
import { alias, type PgDatabase, type PgQueryResultHKT } from 'drizzle-orm/pg-core'
import { EVENT_FINANCE_HISTORY_MAX, EXPENSE_ITEMS_MAX, type EventFinance, type EventFinanceAction, type EventFinanceResponse,
  type ReopenSettlementRequest, type SetEventBudgetRequest, type SettleEventRequest } from '@vada/contracts'
import { eventFinanceEvents, eventFinances, events, expenseItems, expenseReceipts, expenses, organizations, purchaseItems as items,
  users } from '../db/schema.js'
import { expenseItemRows, expenseSummaries } from '../expenses/summaries.js'
import { ApiError } from '../http/errors.js'
import { requireFinance } from '../purchases/review.js'
import type { SettlementSheetData, SheetExpense } from './workbook.js'

type Db = PgDatabase<PgQueryResultHKT>
export type SettlementDatabase = Pick<Db, 'select' | 'insert' | 'update' | 'transaction'>
type Reader = Pick<Db, 'select'>
type Transaction = Parameters<Parameters<SettlementDatabase['transaction']>[0]>[0]
export interface SettlementScope { organizationId: string; userId: string }
const LIST_LIMIT = 300
const settlers = alias(users, 'event_settlers')
const actors = alias(users, 'event_finance_actors')
const EXPORT_LIMIT = 1000
const payers = alias(users, 'export_payers')
const recorders = alias(users, 'export_recorders')
const uploaders = alias(users, 'export_uploaders')
// 지출별로 묶는다. 순서는 받은 순서 그대로다.
function groupBy<T>(list: T[], key: (entry: T) => string | null) {
  const groups = new Map<string, T[]>()
  for (const entry of list) {
    const id = key(entry)
    if (id === null) continue
    const group = groups.get(id)
    if (group) group.push(entry)
    else groups.set(id, [entry])
  }
  return groups
}

// 이 학생회의 행사다. 바꿀 때는 행사 행을 FOR NO KEY UPDATE로 잠근다.
// 지출 변경·증빙 삭제·구매 제출은 같은 행을 FOR SHARE로 잠그므로 정산 확인과 겹치지 않는다. 행사를 참조하는 행 추가(FK 검사)는 막지 않는다.
export async function eventOf(db: Reader, scope: SettlementScope, eventId: string, lock = false) {
  const query = db.select({ name: events.name }).from(events).where(and(eq(events.organizationId, scope.organizationId), eq(events.id, eventId)))
  const [event] = await (lock ? query.for('no key update') : query)
  if (!event) throw new ApiError('NOT_FOUND', 404)
  return event
}

// 숫자와 정산 조건을 센다. 지출 예정은 지출에 연결되지 않은 승인 품목이고, 수량·단가를 모르는 품목은 합에서 빼고 따로 센다.
export async function financeNumbers(db: Reader, scope: SettlementScope, eventId: string) {
  const [spending] = await db.select({
    spent: sql<string>`coalesce(sum(${expenses.amount}), 0)`,
    expenseCount: sql<number>`count(*)::int`,
    // 표 하나만 고르는 select는 sql 안의 열에서 표 이름을 떼므로, 바깥 지출을 가리키는 하위 질의는 질의 빌더로 만든다.
    missingEvidence: sql<number>`(count(*) filter (where ${notExists(db.select({ one: sql`1` }).from(expenseReceipts)
      .where(and(eq(expenseReceipts.expenseId, expenses.id), eq(expenseReceipts.status, 'ready'))))}))::int`,
  }).from(expenses).where(and(eq(expenses.organizationId, scope.organizationId), eq(expenses.eventId, eventId), isNull(expenses.voidedAt)))
  const unrecorded = sql`${items.status} = 'approved' and ${expenseItems.purchaseItemId} is null`
  const [requests] = await db.select({
    pendingRequests: sql<number>`(count(*) filter (where ${items.status} = 'pending'))::int`,
    unrecordedItems: sql<number>`(count(*) filter (where ${unrecorded}))::int`,
    planned: sql<string>`coalesce(sum(${items.quantity}::bigint * ${items.estimatedUnitPrice}) filter (where ${unrecorded}), 0)`,
    plannedUnknown: sql<number>`(count(*) filter (where ${unrecorded} and (${items.quantity} is null or ${items.estimatedUnitPrice} is null)))::int`,
  }).from(items)
    .leftJoin(expenseItems, and(eq(expenseItems.purchaseItemId, items.id), eq(expenseItems.organizationId, items.organizationId)))
    .where(and(eq(items.organizationId, scope.organizationId), eq(items.eventId, eventId)))
  return { spent: Number(spending!.spent), expenseCount: spending!.expenseCount, missingEvidence: spending!.missingEvidence,
    pendingRequests: requests!.pendingRequests, unrecordedItems: requests!.unrecordedItems, planned: Number(requests!.planned),
    plannedUnknown: requests!.plannedUnknown }
}

// 예산·정산 상태와 정산한 사람 이름. 행이 없으면 null(예산 미정·정산 전)이다.
export async function financeRow(db: Reader, scope: SettlementScope, eventId: string) {
  const [row] = await db.select({ finance: eventFinances, settlerName: settlers.name }).from(eventFinances)
    .leftJoin(settlers, eq(settlers.id, eventFinances.settledBy))
    .where(and(eq(eventFinances.organizationId, scope.organizationId), eq(eventFinances.eventId, eventId)))
  return row ?? null
}

// 응답 하나로 숫자·정산 상태·처리 기록·이 행사의 지출을 준다. 바꾸는 요청도 같은 모양으로 돌려준다.
async function responseOf(db: Reader, scope: SettlementScope, eventId: string): Promise<EventFinanceResponse> {
  const numbers = await financeNumbers(db, scope, eventId)
  const row = await financeRow(db, scope, eventId)
  const history = await db.select({ entry: eventFinanceEvents, actorName: actors.name }).from(eventFinanceEvents)
    .innerJoin(actors, eq(actors.id, eventFinanceEvents.actorId))
    .where(and(eq(eventFinanceEvents.organizationId, scope.organizationId), eq(eventFinanceEvents.eventId, eventId)))
    .orderBy(desc(eventFinanceEvents.createdAt), desc(eventFinanceEvents.id)).limit(EVENT_FINANCE_HISTORY_MAX)
  const budget = row?.finance.budget ?? null
  const settledAt = row?.finance.settledAt ?? null
  const settledBy = row?.finance.settledBy ?? null
  const finance: EventFinance = {
    eventId, budget, ...numbers,
    remaining: budget === null ? null : budget - numbers.spent - numbers.planned,
    settled: settledAt && settledBy ? { by: { id: settledBy, name: row?.settlerName ?? '' }, at: settledAt.toISOString() } : null,
    version: row?.finance.version ?? 0,
    // 최근 것부터 잘라 온 뒤 오래된 순으로 돌린다.
    history: history.reverse().map(({ entry, actorName }) => ({ id: entry.id, action: entry.action, actor: { id: entry.actorId, name: actorName },
      changes: entry.changes, reason: entry.reason, createdAt: entry.createdAt.toISOString() })),
  }
  const list = await expenseSummaries(db, scope.organizationId, eq(expenses.eventId, eventId), LIST_LIMIT + 1)
  return { finance, expenses: list.slice(0, LIST_LIMIT), truncated: list.length > LIST_LIMIT }
}

export function createSettlementService(db: SettlementDatabase) {
  // 바꾸기 전에: 재정 권한(부서 변경과 겹치지 않게 잠금), 행사 행 잠금, 버전. 행이 없으면 버전 0이다.
  async function begin(tx: Transaction, scope: SettlementScope, eventId: string, version: number) {
    await requireFinance(tx, scope, true)
    await eventOf(tx, scope, eventId, true)
    const [row] = await tx.select().from(eventFinances)
      .where(and(eq(eventFinances.organizationId, scope.organizationId), eq(eventFinances.eventId, eventId)))
    if ((row?.version ?? 0) !== version) throw new ApiError('VERSION_CONFLICT', 409)
    return row ?? null
  }
  // 행이 없으면 버전 1로 만들고, 있으면 버전을 올려 바꾼다.
  async function save(tx: Transaction, scope: SettlementScope, eventId: string, exists: boolean,
    values: { budget?: number | null; settledAt?: SQL | null; settledBy?: string | null }) {
    if (exists) await tx.update(eventFinances).set({ ...values, version: sql`${eventFinances.version} + 1` }).where(eq(eventFinances.eventId, eventId))
    else await tx.insert(eventFinances).values({ eventId, organizationId: scope.organizationId, ...values })
  }
  async function record(tx: Transaction, scope: SettlementScope, eventId: string, action: EventFinanceAction,
    changes: Record<string, unknown>, reason: string | null = null) {
    await tx.insert(eventFinanceEvents).values({ id: randomUUID(), organizationId: scope.organizationId, eventId, actorId: scope.userId,
      action, changes, reason })
  }
  return {
    async get(scope: SettlementScope, eventId: string) {
      await eventOf(db, scope, eventId)
      return responseOf(db, scope, eventId)
    },
    // 정산 뒤에는 바꾸지 않는다. 같은 값이면 버전과 기록을 그대로 둔다.
    async setBudget(scope: SettlementScope, eventId: string, input: SetEventBudgetRequest) {
      return db.transaction(async tx => {
        const row = await begin(tx, scope, eventId, input.version)
        if (row?.settledAt) throw new ApiError('EVENT_SETTLED', 409)
        const from = row?.budget ?? null
        if (from !== input.budget) {
          await save(tx, scope, eventId, row !== null, { budget: input.budget })
          await record(tx, scope, eventId, 'budget_set', { from, to: input.budget })
        }
        return responseOf(tx, scope, eventId)
      })
    },
    // 증빙 누락·검토 대기 요청·지출로 기록하지 않은 승인 품목이 모두 0일 때만 닫는다. 그때의 예산·실제 지출·지출 건수를 남긴다.
    async settle(scope: SettlementScope, eventId: string, input: SettleEventRequest) {
      return db.transaction(async tx => {
        const row = await begin(tx, scope, eventId, input.version)
        if (row?.settledAt) throw new ApiError('INVALID_STATE', 409)
        const numbers = await financeNumbers(tx, scope, eventId)
        if (numbers.missingEvidence || numbers.pendingRequests || numbers.unrecordedItems) throw new ApiError('NOT_READY_TO_SETTLE', 409)
        await save(tx, scope, eventId, row !== null, { settledAt: sql`now()`, settledBy: scope.userId })
        await record(tx, scope, eventId, 'settled', { budget: row?.budget ?? null, spent: numbers.spent, expenseCount: numbers.expenseCount })
        return responseOf(tx, scope, eventId)
      })
    },
    // 사유를 남기고 잠금을 푼다.
    async reopen(scope: SettlementScope, eventId: string, input: ReopenSettlementRequest) {
      return db.transaction(async tx => {
        const row = await begin(tx, scope, eventId, input.version)
        if (!row?.settledAt) throw new ApiError('INVALID_STATE', 409)
        await save(tx, scope, eventId, true, { settledAt: null, settledBy: null })
        await record(tx, scope, eventId, 'reopened', {}, input.reason)
        return responseOf(tx, scope, eventId)
      })
    },
    // 정산서 자료. 취소하지 않은 지출을 결제일·기록 순으로 모으고, 확인된 증빙과 연결 품목을 붙인다.
    async exportData(scope: SettlementScope, eventId: string, publicOrigin: string): Promise<SettlementSheetData> {
      const event = await eventOf(db, scope, eventId)
      const rows = await db.select({ expense: expenses, payerName: payers.name, recorderName: recorders.name }).from(expenses)
        .innerJoin(payers, eq(payers.id, expenses.payerId))
        .innerJoin(recorders, eq(recorders.id, expenses.recordedBy))
        .where(and(eq(expenses.organizationId, scope.organizationId), eq(expenses.eventId, eventId), isNull(expenses.voidedAt)))
        .orderBy(asc(expenses.paidOn), asc(expenses.createdAt), asc(expenses.id)).limit(EXPORT_LIMIT + 1)
      if (rows.length > EXPORT_LIMIT) throw new ApiError('EXPORT_TOO_LARGE', 409)
      const ids = rows.map(row => row.expense.id)
      const receipts = ids.length ? await db.select({ receipt: expenseReceipts, uploaderName: uploaders.name }).from(expenseReceipts)
        .innerJoin(uploaders, eq(uploaders.id, expenseReceipts.uploadedBy))
        .where(and(eq(expenseReceipts.organizationId, scope.organizationId), inArray(expenseReceipts.expenseId, ids), eq(expenseReceipts.status, 'ready')))
        .orderBy(asc(expenseReceipts.createdAt), asc(expenseReceipts.id)) : []
      const linked = ids.length ? await expenseItemRows(db, scope.organizationId, inArray(expenseItems.expenseId, ids), EXPORT_LIMIT * EXPENSE_ITEMS_MAX) : []
      const receiptsOf = groupBy(receipts, entry => entry.receipt.expenseId)
      const itemsOf = groupBy(linked, entry => entry.expenseId)
      const [organization] = await db.select({ name: organizations.name }).from(organizations).where(eq(organizations.id, scope.organizationId))
      const [voided] = await db.select({ count: sql<number>`count(*)::int` }).from(expenses)
        .where(and(eq(expenses.organizationId, scope.organizationId), eq(expenses.eventId, eventId), isNotNull(expenses.voidedAt)))
      const numbers = await financeNumbers(db, scope, eventId)
      const row = await financeRow(db, scope, eventId)
      const settledAt = row?.finance.settledAt ?? null
      // 영수증 보기 주소. 로그인한 구성원이면 짧게 사는 서명 주소로 이동해 파일이 열린다.
      const fileUrl = (expenseId: string, receiptId: string) => new URL(`/api/organizations/${encodeURIComponent(scope.organizationId)}/expenses/${
        encodeURIComponent(expenseId)}/receipts/${encodeURIComponent(receiptId)}/file`, publicOrigin).href
      return {
        organizationName: organization?.name ?? '', eventName: event.name, exportedAt: new Date(),
        settled: settledAt ? { by: row?.settlerName ?? '', at: settledAt } : null,
        budget: row?.finance.budget ?? null, planned: numbers.planned, plannedUnknown: numbers.plannedUnknown, voidedCount: voided!.count,
        expenses: rows.map(({ expense, payerName, recorderName }): SheetExpense => ({
          paidOn: expense.paidOn, vendor: expense.vendor, description: expense.description, amount: expense.amount, method: expense.method,
          payer: payerName, note: expense.note, recordedBy: recorderName,
          receipts: (receiptsOf.get(expense.id) ?? []).map(({ receipt, uploaderName }) => ({ kind: receipt.kind, fileName: receipt.fileName,
            uploadedBy: uploaderName, uploadedAt: receipt.confirmedAt ?? receipt.createdAt, url: fileUrl(expense.id, receipt.id) })),
          items: (itemsOf.get(expense.id) ?? []).map(({ item }) => ({ name: item.productName ?? '상품명 확인 필요', quantity: item.quantity,
            estimatedUnitPrice: item.estimatedUnitPrice, requester: item.requester.name })),
        })),
      }
    },
  }
}
