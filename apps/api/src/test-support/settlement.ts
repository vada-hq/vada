import type { SettlementRemainingKind, SettlementResponse } from '@vada/contracts'
import { createApp } from '../app.js'
import { createTestDb } from '../db/test-db.js'
import { createEventRoutes } from '../events/routes.js'
import { clockNow, createRecord } from '../records/records.js'
import { createSettlementRoutes } from '../settlement/routes.js'
import { seedCouncil } from './council.js'
import { caller, ORIGIN, testSession } from './http.js'

export { MISSING } from './events.js'

type Values = Record<string, unknown>
type SettlementCouncil = Awaited<ReturnType<typeof seedCouncil>>

let codes = 0
const nextCode = () =>
  `BBBBB${'ABCDEFGH'[Math.floor(codes / 64) % 8]}${'ABCDEFGH'[Math.floor(codes / 8) % 8]}${'23456789'[codes++ % 8]}`

// 학생회 둘(우리, 다른)과 정산 읽기를 띄운다. 기록은 기록 모듈로 바로 만들고, 남은 것이 빠지는 변화는 SQL로 바꾼다.
async function startSettlement() {
  const { pg, db, close } = await createTestDb()
  const council = await seedCouncil(db, pg)
  const other = await seedCouncil(db, pg, 'o')
  const now = new Date('2026-10-25T03:00:00Z')
  const api = caller(
    createApp({
      auth: { handler: async () => new Response() },
      trustedOrigin: ORIGIN,
      events: createEventRoutes(db, testSession, { clock: () => now }),
      settlement: createSettlementRoutes(db, testSession, { clock: () => now }),
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
  const approve = (line: string, outcome: 'approved' | 'rejected' = 'approved', owner = council) =>
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
  const form = (eventId: string, owner = council) =>
    make(owner, 'registration_form', {
      eventId,
      name: '신청',
      closesAt: new Date('2026-11-01T09:00:00Z'),
      publicCode: nextCode(),
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
    council,
    other,
    api,
    base,
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
    form,
    registration,
    deposit,
    read,
    settlement,
    remainingOf,
    close,
  }
}

export type SettlementKit = Awaited<ReturnType<typeof startSettlement>>

export const withSettlement = (body: (t: SettlementKit) => Promise<void>) => async () => {
  const t = await startSettlement()
  try {
    await body(t)
  } finally {
    await t.close()
  }
}
