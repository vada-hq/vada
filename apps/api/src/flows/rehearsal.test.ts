import assert from 'node:assert/strict'
import { test } from 'node:test'
import type {
  ApplicantsResponse,
  EventResponse,
  EventSettlement,
  ExpensesResponse,
  IncomesResponse,
  PurchaseRequestsResponse,
  RegistrationFormResponse,
  SettlementResponse,
  TaskResponse,
} from '@vada/contracts'
import { createTestDb } from '../db/test-db.js'
import { fakeStorage } from '../test-support/storage.js'
import { createPerson, type Person } from './people.js'
import { EVENT_B, EVENT_C, rehearsalStart, runRehearsal, type RehearsalState } from './rehearsal.js'
import { BANNER_WON, DIRECT_WON } from './rehearsal-money.js'
import { FEE } from './rehearsal-event.js'
import { startFlow } from './server.js'

// 흐름 시험은 SQL이나 기록 만들기로 상태를 만들지 않는다. 모든 상태는 시나리오가 부르는 실제 경로의 요청으로 생기고, 여기서는 화면이 읽는 응답만 본다.
const FINAL = new Date('2026-11-03T03:00:00Z')
const NOT_FOUND = 404
const CONFLICT = 409
const EXPENSE_TOTAL = BANNER_WON + DIRECT_WON

async function setup() {
  const { db, close } = await createTestDb()
  const fake = fakeStorage()
  const flow = await startFlow(db, {
    start: rehearsalStart(FINAL),
    scope: 'connection',
    storage: fake.storage,
  })
  const chief = await createPerson(flow, 'chief', '회장', { googleLinked: true })
  const options = { chief, finalAt: FINAL, uploadEvidence: (key: string) => fake.put(key) }
  return { db, close, flow, chief, options }
}

const get = async <T>(person: Person, path: string) => {
  const response = await person.api.get(path)
  assert.equal(response.status, 200, path)
  return (await response.json()) as T
}

async function errorOf(response: Response) {
  return ((await response.json()) as { error: string }).error
}

const remainingOf = (settlement: EventSettlement) =>
  Object.fromEntries(settlement.remaining.map(item => [item.kind, item.count]))

test('리허설 시나리오가 모든 모듈로 끝까지 돌아 행사 A가 완료된다', async () => {
  const { close, flow, chief, options } = await setup()
  try {
    const { state } = await runRehearsal(flow, options)
    const { cast, w } = state
    const org = `/api/organizations/${w.councilId}`
    // 정산이 끝나 완료했다: 남은 것 0, 완료 결재 하나(사유 포함)
    const { settlement } = await get<SettlementResponse>(
      chief,
      `${org}/events/${w.eventId}/settlement`,
    )
    assert.equal(settlement.completed, true)
    assert.equal(settlement.settled, true)
    assert.deepEqual(remainingOf(settlement), {
      pending_items: 0,
      unpaid_items: 0,
      no_evidence: 0,
      no_reason: 0,
      unreimbursed: 0,
      refund_pending: 0,
    })
    assert.equal(settlement.approvals.length, 1)
    assert.equal(settlement.approvals[0]!.outcome, 'completed')
    assert.equal(settlement.approvals[0]!.reason, '리허설 행사 정산을 마쳤어요')
    // 입금 둘에서 환불 하나를 뺀 참가비, 지출 합계(요청의 결제와 먼저 낸 직접 지출). 재전송 두 번은 기록을 늘리지 않았다.
    assert.equal(settlement.actual.fee, FEE)
    assert.equal(settlement.actual.depositCount, 2)
    assert.equal(settlement.actual.refundPendingCount, 0)
    assert.equal(settlement.actual.expense, EXPENSE_TOTAL)
    const expenses = await get<ExpensesResponse>(chief, `${org}/expenses?event=${w.eventId}`)
    assert.equal(expenses.expenses.length, 2)
    assert.ok(expenses.expenses.every(item => item.evidenceCount === 1))
    assert.equal(expenses.expenses.find(item => item.paidBy)?.reimbursed, true)
    assert.equal(expenses.expenses.find(item => item.paidBy)?.method, 'cash')
    assert.equal(expenses.expenses.find(item => item.paidBy === null)?.description, '행사 물품')
    const form = await get<RegistrationFormResponse>(chief, `${org}/registration-forms/${w.formId}`)
    assert.equal(form.form.applicantCount, 2)
    const applicants = await get<ApplicantsResponse>(
      cast.planHead,
      `${org}/registration-forms/${w.formId}/applicants`,
    )
    assert.deepEqual(applicants.applicants.map(item => item.name).sort(), [
      '신청자 가',
      '신청자 다',
    ])
    // 참가비 수입은 완료가 만든다
    const incomes = await get<IncomesResponse>(
      cast.financeStaff,
      `${org}/incomes?period=${w.periodId}`,
    )
    const fees = incomes.incomes.filter(item => item.source === 'participation_fee')
    assert.deepEqual(
      fees.map(item => item.amount),
      [FEE],
    )
    // 다시 보낸 신청: 앞 토큰은 닫히고 새 토큰으로 내 신청이 열린다
    const resent = w.applicants[0]!
    const visitor = flow.driver.as('visitor')
    const stale = await visitor.post('/api/public/registrations/lookup', {
      token: resent.staleToken,
    })
    assert.equal(stale.status, NOT_FOUND)
    const fresh = await visitor.post('/api/public/registrations/lookup', { token: resent.token })
    assert.equal(fresh.status, 200)
    // 업무는 요청과 결제를 따라 저절로 끝났다
    const task = await get<TaskResponse>(cast.planner, `${org}/tasks/${w.taskId}`)
    assert.equal(task.task.status, 'done')
    // 완료한 행사에 지출을 적으면 409 EVENT_COMPLETED
    const late = await cast.financeStaff.api.post(`${org}/expenses`, {
      method: 'card',
      commandId: crypto.randomUUID(),
      vendor: '늦은 지출',
      description: '완료 뒤 지출',
      amount: DIRECT_WON,
      paidOn: '2026-11-03',
      budgetItemId: w.budgetItemIds.event,
      eventId: w.eventId,
    })
    assert.equal(late.status, CONFLICT)
    assert.equal(await errorOf(late), 'EVENT_COMPLETED')
    const event = await get<EventResponse>(chief, `${org}/events/${w.eventId}`)
    assert.equal(event.event.status, 'completed')
    // 기획부장이 만들어 만든 사람이 책임자다(DEC-79, DEC-93)
    assert.equal(event.event.owner?.id, w.memberIds.planHead)
    assert.equal(event.event.history[0]?.by?.id, w.memberIds.planHead)
    assert.ok(event.event.actions.includes('event.cancel_completion'))
    assert.ok(!event.event.actions.includes('event.complete'))
    await runOthers(flow, options, state)
  } finally {
    await close()
  }
})

// 행사 B는 '구매 요청'까지(입금 확인은 건너뛰어 신청자가 입금을 기다린다), 행사 C는 날짜 없이 만들기만 한다.
async function runOthers(
  flow: Awaited<ReturnType<typeof setup>>['flow'],
  options: Awaited<ReturnType<typeof setup>>['options'],
  resume: RehearsalState,
) {
  const b = await runRehearsal(flow, {
    ...options,
    event: EVENT_B,
    stopAfter: 'request',
    omit: ['deposit'],
    resume,
  })
  const org = `/api/organizations/${b.state.w.councilId}`
  const pending = await get<PurchaseRequestsResponse>(
    b.state.cast.financeHead,
    `${org}/purchase-requests?view=pending&event=${b.state.w.eventId}`,
  )
  assert.equal(pending.requests.length, 1)
  const formB = await get<RegistrationFormResponse>(
    options.chief,
    `${org}/registration-forms/${b.state.w.formId}`,
  )
  assert.equal(formB.form.status, 'open')
  const c = await runRehearsal(flow, { ...options, event: EVENT_C, stopAfter: 'event', resume })
  const eventC = await get<EventResponse>(options.chief, `${org}/events/${c.state.w.eventId}`)
  assert.equal(eventC.event.status, 'tbd')
  assert.equal(eventC.event.startsAt, null)
}

test('환급 단계를 빼면 완료가 409로 막히고, 시나리오 전체를 돌리면 완료 단계에서 실패한다', async () => {
  const { close, flow, chief, options } = await setup()
  try {
    const { state } = await runRehearsal(flow, {
      ...options,
      omit: ['reimburse', 'complete'],
    })
    const org = `/api/organizations/${state.w.councilId}/events/${state.w.eventId}`
    const { settlement } = await get<SettlementResponse>(chief, `${org}/settlement`)
    assert.equal(settlement.settled, false)
    assert.equal(remainingOf(settlement).unreimbursed, 1)
    const event = await get<EventResponse>(chief, org)
    assert.ok(!event.event.actions.includes('event.complete'))
    assert.equal(event.event.blockers['event.complete'], 'SETTLEMENT_PENDING')
    const complete = await chief.api.post(`${org}/complete`, { reason: '환급 없이' })
    assert.equal(complete.status, CONFLICT)
    assert.equal(await errorOf(complete), 'SETTLEMENT_PENDING')
  } finally {
    await close()
  }
  const whole = await setup()
  try {
    await assert.rejects(
      runRehearsal(whole.flow, { ...whole.options, omit: ['reimburse'] }),
      /리허설 단계 'complete'.*event\.complete.*SETTLEMENT_PENDING/,
    )
  } finally {
    await whole.close()
  }
})

test('앞 단계의 쓰기가 다음 인물의 화면에 동작을 만들지 못하면 그 단계에서 실패한다', async () => {
  const { close, flow, options } = await setup()
  try {
    await assert.rejects(
      runRehearsal(flow, { ...options, omit: ['decide'] }),
      /리허설 단계 'spend'.*결제할 요청/,
    )
  } finally {
    await close()
  }
})
