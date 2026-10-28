import type { SettlementRemainingKind, SettlementResponse } from '@vada/contracts'
import { createApp } from '../app.js'
import { createBudgetRoutes } from '../budget/routes.js'
import { createChatRoutes } from '../chat/routes.js'
import { createTestDb } from '../db/test-db.js'
import { createDepositRoutes } from '../deposits/routes.js'
import { createEventRoutes } from '../events/routes.js'
import { createExpenseRoutes } from '../expenses/routes.js'
import { createFeePaymentRoutes } from '../fee-payments/routes.js'
import { createClosingRoutes } from '../closing/routes.js'
import { createClosingExportRoutes } from '../closing/export-routes.js'
import { createIncomeRoutes } from '../incomes/routes.js'
import { createRateLimiter } from '../http/rate-limit.js'
import { createPurchaseRoutes } from '../purchases/routes.js'
import { clockNow, createRecord, updateRecord } from '../records/records.js'
import { createRegistrationRoutes } from '../registrations/routes.js'
import { createPublicRegistrationRoutes } from '../registrations/public-routes.js'
import { createSettlementRoutes } from '../settlement/routes.js'
import { createTaskRoutes } from '../tasks/routes.js'
import { seedCouncil } from './council.js'
import { caller, ORIGIN, testSession } from './http.js'
import { fakeStorage } from './storage.js'

export { MISSING } from './events.js'

type Values = Record<string, unknown>
type SettlementCouncil = Awaited<ReturnType<typeof seedCouncil>>

let codes = 0
const nextCode = () =>
  `BBBBB${'ABCDEFGH'[Math.floor(codes / 64) % 8]}${'ABCDEFGH'[Math.floor(codes / 8) % 8]}${'23456789'[codes++ % 8]}`

// 학생회 둘(우리, 다른)과 정산 읽기를 띄운다. 기록은 기록 모듈로 바로 만들고, 남은 것이 빠지는 변화는 SQL로 바꾼다.
async function startSettlement(options: { limit?: number; bundleLimit?: number } = {}) {
  const { pg, db, drizzle, close } = await createTestDb()
  const council = await seedCouncil(db, pg)
  const other = await seedCouncil(db, pg, 'o')
  // 시험이 시계를 옮길 수 있다(한국 날짜 경계).
  let now = new Date('2026-10-25T03:00:00Z')
  const clock = () => now
  // 시계가 멈춰 있어 한도 창이 열리지 않으므로 한도를 넉넉히 둔다. 완료 잠금 표 시험이 같은 사람으로 많이 쓴다.
  const writeLimiter = createRateLimiter({ limit: options.limit ?? 100_000, windowMs: 10_000 })
  const store = fakeStorage()
  // 묶음 한도 시험이 한도를 줄일 수 있게 하나를 밖에 둔다.
  const bundleLimiter = createRateLimiter({
    limit: options.bundleLimit ?? 100_000,
    windowMs: 600_000,
  })
  const api = caller(
    createApp({
      auth: { handler: async () => new Response() },
      trustedOrigin: ORIGIN,
      events: createEventRoutes(db, testSession, { clock, writeLimiter }),
      settlement: createSettlementRoutes(db, testSession, { clock }),
      purchases: createPurchaseRoutes(db, testSession, { clock, writeLimiter }),
      budget: createBudgetRoutes(db, testSession, { clock }),
      expenses: createExpenseRoutes(db, testSession, {
        receiptKey: 'test-receipt-key',
        clock,
        writeLimiter,
        storage: store.storage,
      }),
      incomes: createIncomeRoutes(db, testSession, { clock, writeLimiter }),
      closing: createClosingRoutes(db, testSession, { clock, bundleAvailable: true }),
      closingExport: createClosingExportRoutes(db, testSession, {
        clock,
        storage: store.storage,
        bundleLimiter,
      }),
      registrations: createRegistrationRoutes(db, testSession, { clock, writeLimiter }),
      deposits: createDepositRoutes(db, testSession, { clock, writeLimiter }),
      publicRegistrations: createPublicRegistrationRoutes(db, {
        clock,
        receiptKey: 'test-receipt-key',
      }),
      tasks: createTaskRoutes(db, testSession, { clock, writeLimiter }),
      chat: createChatRoutes(db, testSession, { clock }),
      feePayments: createFeePaymentRoutes(db, testSession, { clock, writeLimiter }),
    }),
  )
  const base = `/api/organizations/${council.councilId}/events`
  const make = (owner: SettlementCouncil, kind: string, values: Values, actor?: string) =>
    db.transaction(tx =>
      createRecord(tx, {
        kind,
        councilId: owner.councilId,
        actor: actor ?? owner.people.president.memberId,
        values,
      } as Parameters<typeof createRecord>[1]),
    )
  const event = (values: Values = {}, owner = council) =>
    make(owner, 'event', { name: '봄 축제', startsAt: new Date('2026-10-20T00:00:00Z'), ...values })
  // 회계 기간, 예산, 예산 항목 하나씩
  const budgetOf = async (owner = council) => {
    const period = await make(owner, 'fiscal_period', {
      name: '2026-2',
      startsOn: '2026-09-01',
      endsOn: '2027-02-28',
    })
    const budget = await make(owner, 'budget', { fiscalPeriodId: period })
    return { period, budget }
  }
  const budgetItem = (budget: string, values: Values, owner = council) =>
    make(owner, 'budget_item', {
      budgetId: budget,
      type: 'expense',
      purpose: '비품',
      amount: '100000',
      ...values,
    })
  const requestWithItem = async (eventId: string | null, values: Values = {}, owner = council) => {
    const request = await make(owner, 'request', {
      type: 'purchase',
      title: '마커',
      requestedBy: owner.people.planningMember.memberId,
      ...(eventId ? { eventId } : {}),
      ...values,
    })
    const line = await make(owner, 'line_item', { requestId: request, name: '마커', quantity: 1 })
    return { request, line }
  }
  const approve = (
    line: string,
    outcome: 'approved' | 'rejected' | 'cancelled' = 'approved',
    owner = council,
  ) =>
    make(owner, 'approval', {
      targetId: line,
      targetKind: 'line_item',
      outcome,
      actorId: owner.people.financeMember.memberId,
      actorKind: 'member',
      actedAt: clockNow,
    })
  const expense = (values: Values = {}, owner = council) =>
    make(owner, 'expense', {
      amount: '10000',
      paidAt: clockNow,
      description: '마커',
      vendor: '문구점',
      method: 'card',
      reason: '행사 준비',
      ...values,
    })
  const evidence = (expenseId: string) => make(council, 'evidence', { expenseId, type: 'receipt' })
  const pay = (expenseId: string, lineItemId: string, amount = '10000') =>
    make(council, 'payment_line', { expenseId, lineItemId, amount })
  const completion = (
    eventId: string,
    outcome: 'completed' | 'completion_cancelled',
    actedAt: Date,
    reason: string | null = null,
  ) =>
    make(council, 'approval', {
      targetId: eventId,
      targetKind: 'event',
      outcome,
      actorId: council.people.president.memberId,
      actorKind: 'member',
      actedAt,
      reason,
    })
  // 다른 학생회가 자기 행사를 완료한 기록이다. 그 행사를 이쪽에서 건드려도 완료 여부가 새지 않는지 볼 때 쓴다.
  const completionOfOther = (eventId: string) =>
    make(other, 'approval', {
      targetId: eventId,
      targetKind: 'event',
      outcome: 'completed',
      actorId: other.people.president.memberId,
      actorKind: 'member',
      actedAt: new Date('2026-10-24T03:00:00Z'),
      reason: null,
    })
  const form = (eventId: string, owner = council, values: Values = {}) =>
    make(owner, 'registration_form', {
      eventId,
      name: '신청',
      closesAt: new Date('2026-11-01T09:00:00Z'),
      publicCode: nextCode(),
      ...values,
    })
  const registration = (formId: string, values: Values = {}, owner = council) =>
    make(
      owner,
      'registration',
      { formId, name: '김학생', phone: '01012345678', appliedFee: '5000', ...values },
      undefined,
    )
  const deposit = (registrationId: string, values: Values = {}) =>
    make(council, 'deposit', { registrationId, amount: '5000', confirmedAt: clockNow, ...values })
  const change = (kind: 'registration' | 'event', id: string, changes: Values) =>
    db.transaction(tx =>
      updateRecord(tx, {
        kind,
        id,
        actor: council.people.president.memberId,
        reason: null,
        changes,
      }),
    )
  const read = (eventId: string, user = 's-president') =>
    api.get(`${base}/${eventId}/settlement`, user)
  const settlement = async (eventId: string, user = 's-president') => {
    const response = await read(eventId, user)
    if (response.status !== 200) throw new Error(`정산 읽기 ${response.status}`)
    return ((await response.json()) as SettlementResponse).settlement
  }
  const remainingOf = async (eventId: string) => {
    const result = await settlement(eventId)
    return Object.fromEntries(result.remaining.map(item => [item.kind, item.count])) as Record<
      SettlementRemainingKind,
      number
    >
  }
  return {
    pg,
    db,
    drizzle,
    council,
    other,
    api,
    base,
    store,
    change,
    make,
    event,
    budgetOf,
    budgetItem,
    requestWithItem,
    approve,
    expense,
    evidence,
    pay,
    completion,
    completionOfOther,
    form,
    registration,
    deposit,
    read,
    settlement,
    remainingOf,
    setNow: (value: Date) => {
      now = value
    },
    close,
  }
}

export type SettlementKit = Awaited<ReturnType<typeof startSettlement>>

export const withSettlement =
  (
    body: (t: SettlementKit) => Promise<void>,
    options: { limit?: number; bundleLimit?: number } = {},
  ) =>
  async () => {
    const t = await startSettlement(options)
    try {
      await body(t)
    } finally {
      await t.close()
    }
  }
