import { randomUUID } from 'node:crypto'
import { and, asc, desc, eq, inArray, isNotNull, isNull, notExists, sql, type SQL } from 'drizzle-orm'
import { alias, type PgDatabase, type PgQueryResultHKT } from 'drizzle-orm/pg-core'
import { EVENT_FINANCE_HISTORY_MAX, EXPENSE_ITEMS_MAX, type EventFinance, type EventFinanceAction, type EventFinanceResponse,
  type ReopenSettlementRequest, type SetEventBudgetRequest, type SettleEventRequest } from '@vada/contracts'
import { requireOpenEventPeriod, shareBudget } from '../budget/lock.js'
import { budgetLines, budgetPeriods, eventFinanceEvents, eventFinances, events, expenseItems, expenseReceipts, expenses, organizations,
  purchaseItems as items, users } from '../db/schema.js'
import { expenseItemRows, expenseSummaries } from '../expenses/summaries.js'
import { lockActiveEvent } from '../events/lock.js'
import { ApiError } from '../http/errors.js'
import { feeIncomeOf, incomeLinesOf, insertFeeIncome, voidFeeIncome } from '../incomes/service.js'
import { requireFinance } from '../purchases/review.js'
import { eventFeesOf } from '../registrations/fee.js'
import type { SettlementSheetData, SheetExpense } from './workbook.js'

type Db = PgDatabase<PgQueryResultHKT>
export type SettlementDatabase = Pick<Db, 'select' | 'insert' | 'update' | 'transaction'>
type Reader = Pick<Db, 'select'>
export type SettlementTransaction = Parameters<Parameters<SettlementDatabase['transaction']>[0]>[0]
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

// 이 학생회의 행사다. 바꿀 때는 lockFinance가 행사 행을 FOR NO KEY UPDATE로 잠근다(완료한 행사는 막는다, M5a).
// 지출 변경·증빙 삭제·구매 제출은 같은 행을 FOR SHARE로 잠그므로 정산 확인과 겹치지 않는다. 행사를 참조하는 행 추가(FK 검사)는 막지 않는다.
export async function eventOf(db: Reader, scope: SettlementScope, eventId: string) {
  const [event] = await db.select({ name: events.name }).from(events).where(and(eq(events.organizationId, scope.organizationId), eq(events.id, eventId)))
  if (!event) throw new ApiError('NOT_FOUND', 404)
  return event
}

export interface FinanceNumbers {
  spent: number
  expenseCount: number
  missingEvidence: number
  pendingRequests: number
  unrecordedItems: number
  planned: number
  plannedUnknown: number
}
const noNumbers: FinanceNumbers = { spent: 0, expenseCount: 0, missingEvidence: 0, pendingRequests: 0, unrecordedItems: 0, planned: 0, plannedUnknown: 0 }

// 행사 여럿의 숫자와 정산 조건을 한 번에 센다. 행사 재정 탭과 예산 화면이 같은 정의를 쓰고, 결과보고서(M5b)도 집행을 이 정의로 센다.
// 지출 예정은 지출에 연결되지 않은 승인 품목이고, 수량·단가를 모르는 품목은 합에서 빼고 따로 센다.
export async function financeNumbersByEvent(db: Reader, scope: Pick<SettlementScope, 'organizationId'>, eventIds: string[]) {
  const numbers = new Map(eventIds.map(id => [id, { ...noNumbers }]))
  if (!eventIds.length) return numbers
  const spending = await db.select({
    eventId: expenses.eventId,
    spent: sql<string>`coalesce(sum(${expenses.amount}), 0)`,
    expenseCount: sql<number>`count(*)::int`,
    // 표 하나만 고르는 select는 sql 안의 열에서 표 이름을 떼므로, 바깥 지출을 가리키는 하위 질의는 질의 빌더로 만든다.
    missingEvidence: sql<number>`(count(*) filter (where ${notExists(db.select({ one: sql`1` }).from(expenseReceipts)
      .where(and(eq(expenseReceipts.expenseId, expenses.id), eq(expenseReceipts.status, 'ready'))))}))::int`,
  }).from(expenses)
    .where(and(eq(expenses.organizationId, scope.organizationId), inArray(expenses.eventId, eventIds), isNull(expenses.voidedAt)))
    .groupBy(expenses.eventId)
  const unrecorded = sql`${items.status} = 'approved' and ${expenseItems.purchaseItemId} is null`
  const requests = await db.select({
    eventId: items.eventId,
    pendingRequests: sql<number>`(count(*) filter (where ${items.status} = 'pending'))::int`,
    unrecordedItems: sql<number>`(count(*) filter (where ${unrecorded}))::int`,
    planned: sql<string>`coalesce(sum(${items.quantity}::bigint * ${items.estimatedUnitPrice}) filter (where ${unrecorded}), 0)`,
    plannedUnknown: sql<number>`(count(*) filter (where ${unrecorded} and (${items.quantity} is null or ${items.estimatedUnitPrice} is null)))::int`,
  }).from(items)
    .leftJoin(expenseItems, and(eq(expenseItems.purchaseItemId, items.id), eq(expenseItems.organizationId, items.organizationId)))
    .where(and(eq(items.organizationId, scope.organizationId), inArray(items.eventId, eventIds)))
    .groupBy(items.eventId)
  for (const row of spending) {
    Object.assign(numbers.get(row.eventId!)!, { spent: Number(row.spent), expenseCount: row.expenseCount, missingEvidence: row.missingEvidence })
  }
  for (const row of requests) {
    Object.assign(numbers.get(row.eventId)!, { pendingRequests: row.pendingRequests, unrecordedItems: row.unrecordedItems,
      planned: Number(row.planned), plannedUnknown: row.plannedUnknown })
  }
  return numbers
}

export async function financeNumbers(db: Reader, scope: SettlementScope, eventId: string) {
  return (await financeNumbersByEvent(db, scope, [eventId])).get(eventId)!
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
  // 행사가 든 회계 기간. 마감됐으면 화면이 정산 다시 열기를 감추고, 정산은 이 기간에 참가비 수입을 넣는다.
  const [period] = await db.select({ id: budgetPeriods.id, name: budgetPeriods.name, closedAt: budgetPeriods.closedAt }).from(budgetLines)
    .innerJoin(budgetPeriods, and(eq(budgetPeriods.id, budgetLines.periodId), eq(budgetPeriods.organizationId, budgetLines.organizationId)))
    .where(and(eq(budgetLines.organizationId, scope.organizationId), eq(budgetLines.eventId, eventId)))
  const fees = await eventFeesOf(db, scope.organizationId, eventId)
  const finance: EventFinance = {
    eventId, budget, ...numbers,
    remaining: budget === null ? null : budget - numbers.spent - numbers.planned,
    settled: settledAt && settledBy ? { by: { id: settledBy, name: row?.settlerName ?? '' }, at: settledAt.toISOString() } : null,
    periodClosed: Boolean(period?.closedAt),
    fees: fees && { received: fees.received, count: fees.count, unpaid: fees.unpaid },
    period: period ? { id: period.id, name: period.name, incomes: await incomeLinesOf(db, scope.organizationId, period.id) } : null,
    feeIncome: await feeIncomeOf(db, scope.organizationId, eventId),
    version: row?.finance.version ?? 0,
    // 최근 것부터 잘라 온 뒤 오래된 순으로 돌린다.
    history: history.reverse().map(({ entry, actorName }) => ({ id: entry.id, action: entry.action, actor: { id: entry.actorId, name: actorName },
      changes: entry.changes, reason: entry.reason, createdAt: entry.createdAt.toISOString() })),
  }
  const list = await expenseSummaries(db, scope.organizationId, eq(expenses.eventId, eventId), LIST_LIMIT + 1)
  return { finance, expenses: list.slice(0, LIST_LIMIT), truncated: list.length > LIST_LIMIT }
}

// 행사 행을 FOR NO KEY UPDATE로 잠그고 재정 행의 버전을 본다. 행이 없으면 버전 0이다.
// 완료한 행사(M5a)는 예산·정산·다시 열기를 막는다. 정산을 다시 열려면 먼저 완료를 취소한다.
async function lockFinance(tx: SettlementTransaction, scope: SettlementScope, eventId: string, version: number) {
  await lockActiveEvent(tx, scope.organizationId, eventId)
  const [row] = await tx.select().from(eventFinances)
    .where(and(eq(eventFinances.organizationId, scope.organizationId), eq(eventFinances.eventId, eventId)))
  if ((row?.version ?? 0) !== version) throw new ApiError('VERSION_CONFLICT', 409)
  return row ?? null
}
// 행이 없으면 버전 1로 만들고, 있으면 버전을 올려 바꾼다.
async function saveFinance(tx: SettlementTransaction, scope: SettlementScope, eventId: string, exists: boolean,
  values: { budget?: number | null; settledAt?: SQL | null; settledBy?: string | null }) {
  if (exists) await tx.update(eventFinances).set({ ...values, version: sql`${eventFinances.version} + 1` }).where(eq(eventFinances.eventId, eventId))
  else await tx.insert(eventFinances).values({ eventId, organizationId: scope.organizationId, ...values })
}
async function recordFinance(tx: SettlementTransaction, scope: SettlementScope, eventId: string, action: EventFinanceAction,
  changes: Record<string, unknown>, reason: string | null = null) {
  await tx.insert(eventFinanceEvents).values({ id: randomUUID(), organizationId: scope.organizationId, eventId, actorId: scope.userId,
    action, changes, reason })
}
// 행사 예산을 바꾼다. 정산된 행사는 막고, 같은 값이면 버전과 기록을 그대로 둔다.
// 재정 권한은 부르는 쪽이 먼저 확인한다. 예산 편성(budget/service.ts)도 이 함수로 행사 예산을 바꾼다.
export async function changeEventBudget(tx: SettlementTransaction, scope: SettlementScope, eventId: string, version: number, budget: number | null) {
  const row = await lockFinance(tx, scope, eventId, version)
  if (row?.settledAt) throw new ApiError('EVENT_SETTLED', 409)
  const from = row?.budget ?? null
  if (from === budget) return
  await saveFinance(tx, scope, eventId, row !== null, { budget })
  await recordFinance(tx, scope, eventId, 'budget_set', { from, to: budget })
}

export function createSettlementService(db: SettlementDatabase) {
  return {
    async get(scope: SettlementScope, eventId: string) {
      await eventOf(db, scope, eventId)
      return responseOf(db, scope, eventId)
    },
    async setBudget(scope: SettlementScope, eventId: string, input: SetEventBudgetRequest) {
      return db.transaction(async tx => {
        await requireFinance(tx, scope, true)
        await changeEventBudget(tx, scope, eventId, input.version, input.budget)
        return responseOf(tx, scope, eventId)
      })
    },
    // 증빙 누락·검토 대기 요청·지출로 기록하지 않은 승인 품목이 모두 0이고, 받은 참가비가 있으면 행사가 기간에 들어 있을 때만 닫는다.
    // 받은 참가비는 행사가 든 기간의 수입 한 건으로 넣는다. 그때의 예산·실제 지출·지출 건수·참가비 수입을 남긴다.
    async settle(scope: SettlementScope, eventId: string, input: SettleEventRequest) {
      return db.transaction(async tx => {
        await requireFinance(tx, scope, true)
        // 참가비 수입을 넣을 기간이 편성 수정·마감과 엇갈리지 않게 예산 잠금을 같이 잡는다. 잠금 순서는 다시 열기와 같다(학생회 예산 → 기간 행 → 행사 행).
        await shareBudget(tx, scope.organizationId)
        const period = await requireOpenEventPeriod(tx, scope.organizationId, eventId)
        const row = await lockFinance(tx, scope, eventId, input.version)
        if (row?.settledAt) throw new ApiError('INVALID_STATE', 409)
        const numbers = await financeNumbers(tx, scope, eventId)
        // 행사 행을 잠근 뒤 센다. 입금 확인·확인 취소·금액 변경과 겹치지 않아, 정산이 끝날 때까지 그대로다.
        const fees = await eventFeesOf(tx, scope.organizationId, eventId)
        const received = fees?.received ?? 0
        if (numbers.missingEvidence || numbers.pendingRequests || numbers.unrecordedItems || (received > 0 && !period)) {
          throw new ApiError('NOT_READY_TO_SETTLE', 409)
        }
        let fee: { amount: number; count: number; period: string; line: string | null } | null = null
        // 받은 참가비가 0원이면 넣지 않고, 보낸 수입 항목도 보지 않는다.
        if (fees && period && received > 0) {
          const line = input.feeIncomeLineId === null ? null
            : (await incomeLinesOf(tx, scope.organizationId, period.id)).find(entry => entry.id === input.feeIncomeLineId)
          if (line === undefined) throw new ApiError('BUDGET_LINE_INVALID', 409)
          const event = await eventOf(tx, scope, eventId)
          await insertFeeIncome(tx, scope, { event: { id: eventId, name: event.name }, period, amount: received, count: fees.count,
            lastPaidAt: fees.lastPaidAt!, budgetLineId: line?.id ?? null })
          fee = { amount: received, count: fees.count, period: period.name, line: line?.name ?? null }
        }
        await saveFinance(tx, scope, eventId, row !== null, { settledAt: sql`now()`, settledBy: scope.userId })
        await recordFinance(tx, scope, eventId, 'settled', { budget: row?.budget ?? null, spent: numbers.spent, expenseCount: numbers.expenseCount, fee })
        return responseOf(tx, scope, eventId)
      })
    },
    // 사유를 남기고 잠금을 푼다. 마감한 회계 기간의 행사는 다시 열지 않는다.
    // 학생회 예산 잠금을 같이 잡아, 기간에 없는 행사를 다시 여는 사이에 그 행사를 기간에 넣고 마감하는 요청이 끼어들지 못하게 한다.
    // 잠금 순서는 학생회 예산 → 기간 행 → 행사 행이다.
    async reopen(scope: SettlementScope, eventId: string, input: ReopenSettlementRequest) {
      return db.transaction(async tx => {
        await requireFinance(tx, scope, true)
        await shareBudget(tx, scope.organizationId)
        await requireOpenEventPeriod(tx, scope.organizationId, eventId)
        const row = await lockFinance(tx, scope, eventId, input.version)
        if (!row?.settledAt) throw new ApiError('INVALID_STATE', 409)
        // 정산에서 넣은 참가비 수입을 취소한다. 다시 정산하면 그때의 받은 참가비로 새로 넣는다.
        await voidFeeIncome(tx, scope, { id: eventId, name: (await eventOf(tx, scope, eventId)).name })
        await saveFinance(tx, scope, eventId, true, { settledAt: null, settledBy: null })
        await recordFinance(tx, scope, eventId, 'reopened', {}, input.reason)
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
      const fees = await eventFeesOf(db, scope.organizationId, eventId)
      const feeIncome = await feeIncomeOf(db, scope.organizationId, eventId)
      const settledAt = row?.finance.settledAt ?? null
      // 영수증 보기 주소. 로그인한 구성원이면 짧게 사는 서명 주소로 이동해 파일이 열린다.
      const fileUrl = (expenseId: string, receiptId: string) => new URL(`/api/organizations/${encodeURIComponent(scope.organizationId)}/expenses/${
        encodeURIComponent(expenseId)}/receipts/${encodeURIComponent(receiptId)}/file`, publicOrigin).href
      return {
        organizationName: organization?.name ?? '', eventName: event.name, exportedAt: new Date(),
        settled: settledAt ? { by: row?.settlerName ?? '', at: settledAt } : null,
        budget: row?.finance.budget ?? null, planned: numbers.planned, plannedUnknown: numbers.plannedUnknown, voidedCount: voided!.count,
        fees: fees && { received: fees.received, count: fees.count },
        feeIncome: feeIncome && { period: feeIncome.period.name, line: feeIncome.line?.name ?? null },
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
