import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { ExpenseResponse, IncomeResponse, PhotoUploadResponse } from '@vada/contracts'
import { errorOf, FINANCE, writesOf } from '../test-support/closing.js'
import { withSettlement, type SettlementKit } from '../test-support/settlement.js'

// 결산 공개 잠금(DEC-70)을 합계를 바꾸는 모든 쓰기 경로에 건다. 새 경로를 더하면 이 표에 한 줄을 더한다.
// 확인을 지우면 그 경로의 줄이 실패해야 한다(경로마다 잠금 확인이 있는지 이 표가 본다).

const PRESIDENT = 's-president'
const DAY = (value: string) => new Date(`${value}:00Z`)
const EXPENSE = {
  method: 'card',
  vendor: '문구점',
  description: '마커',
  amount: 10000,
  paidOn: '2026-10-24',
}

// 공개한 기간(2026-09-01~2027-02-28)과 공개하지 않은 앞 기간(2026-03-01~2026-08-31)
async function periodsOf(t: SettlementKit) {
  const { period, budget } = await t.budgetOf()
  const closing = await t.make(t.council, 'account_closing', { fiscalPeriodId: period })
  const earlier = await t.make(t.council, 'fiscal_period', {
    name: '2026-1',
    startsOn: '2026-03-01',
    endsOn: '2026-08-31',
  })
  await t.make(t.council, 'budget', { fiscalPeriodId: earlier })
  return { period, budget, closing }
}
type Kit = Awaited<ReturnType<typeof periodsOf>>

const setPublished = (t: SettlementKit, closing: string, on: boolean) =>
  t.pg.query('UPDATE account_closing SET published_at = $1 WHERE id = $2', [
    on ? new Date('2026-10-24T03:00:00Z') : null,
    closing,
  ])

// 줄마다 새로 만드는 기록들. 지출, 수입, 입금을 받은 행사
async function sceneOf(t: SettlementKit, kit: Kit) {
  const expense = await t.expense({
    paidAt: DAY('2026-10-21T03:00'),
    paidBy: t.council.people.planningMember.memberId,
  })
  const income = await t.make(t.council, 'income', {
    fiscalPeriodId: kit.period,
    source: 'fee',
    amount: '1000',
    receivedOn: '2026-10-21',
  })
  const event = await t.event()
  const registration = await t.registration(await t.form(event))
  await t.deposit(registration, { confirmedAt: DAY('2026-10-22T03:00') })
  return { expense, income, event }
}
type Scene = Awaited<ReturnType<typeof sceneOf>>

const post = (t: SettlementKit, path: string, body: unknown, user = FINANCE) =>
  t.api.post(`/api/organizations/${t.council.councilId}${path}`, body, user)

type Row = {
  name: string
  // 공개하기 전에 해 두는 일(완료 취소 줄은 먼저 완료해야 한다)
  prepare?: (t: SettlementKit, s: Scene) => unknown
  run: (t: SettlementKit, s: Scene) => Promise<Response> | Response
}

const closedRows: Row[] = [
  { name: '지출 적기(결제일이 그 기간)', run: t => post(t, '/expenses', EXPENSE) },
  {
    name: '지출 취소',
    run: (t, s) => post(t, `/expenses/${s.expense}/cancel`, { reason: '잘못' }),
  },
  {
    name: '수입 적기(받은 날이 그 기간)',
    run: t => post(t, '/incomes', { source: 'grant', amount: 1000, receivedOn: '2026-10-24' }),
  },
  {
    name: '수입 취소',
    run: (t, s) => post(t, `/incomes/${s.income}/cancel`, { reason: '잘못' }),
  },
  {
    name: '행사 완료(참가비 수입이 그 기간에 생긴다)',
    run: (t, s) => post(t, `/events/${s.event}/complete`, {}, PRESIDENT),
  },
  {
    name: '완료 취소(그 기간에 참가비 수입이 있다)',
    prepare: (t, s) => post(t, `/events/${s.event}/complete`, {}, PRESIDENT),
    run: (t, s) => post(t, `/events/${s.event}/cancel-completion`, { reason: '되돌림' }, PRESIDENT),
  },
]

// 합계를 바꾸지 않는 쓰기와 다른 기간의 쓰기는 공개한 기간에서도 된다.
const openRows: Row[] = [
  {
    name: '증빙 붙이기',
    run: async (t, s) => {
      const issued = await post(t, `/expenses/${s.expense}/uploads`, {})
      const { key } = (await issued.json()) as PhotoUploadResponse
      t.store.put(key)
      return post(t, `/expenses/${s.expense}/evidence`, { key })
    },
  },
  {
    name: '지출 사유 고치기',
    run: (t, s) => post(t, `/expenses/${s.expense}`, { reason: '고침' }),
  },
  { name: '환급 표시', run: (t, s) => post(t, `/expenses/${s.expense}/reimburse`, {}) },
  {
    name: '공개하지 않은 앞 기간에 지출 적기',
    run: t => post(t, '/expenses', { ...EXPENSE, paidOn: '2026-05-01' }),
  },
  {
    name: '공개하지 않은 앞 기간에 수입 적기',
    run: t => post(t, '/incomes', { source: 'grant', amount: 1000, receivedOn: '2026-05-01' }),
  },
]

test(
  '공개한 기간에서 합계를 바꾸는 모든 쓰기 경로는 409 PERIOD_CLOSED이고 아무것도 쓰지 않으며, 다시 열면 된다',
  withSettlement(async t => {
    const kit = await periodsOf(t)
    for (const row of closedRows) {
      const s = await sceneOf(t, kit)
      await row.prepare?.(t, s)
      await setPublished(t, kit.closing, true)
      const before = await writesOf(t)
      const locked = await row.run(t, s)
      assert.equal(locked.status, 409, row.name)
      assert.equal(await errorOf(locked), 'PERIOD_CLOSED', row.name)
      assert.equal(await writesOf(t), before, `${row.name}: 기록이 남았다`)
      await setPublished(t, kit.closing, false)
      const reopened = await row.run(t, s)
      assert.ok(reopened.status < 400, `${row.name}: 다시 연 뒤 ${reopened.status}`)
    }
  }),
)

test(
  '공개한 기간에서도 증빙 붙이기, 사유 고치기, 환급 표시와 공개하지 않은 기간의 쓰기는 된다',
  withSettlement(async t => {
    const kit = await periodsOf(t)
    for (const row of openRows) {
      const s = await sceneOf(t, kit)
      await setPublished(t, kit.closing, true)
      const response = await row.run(t, s)
      assert.ok(response.status < 400, `${row.name}: ${response.status}`)
    }
  }),
)

test(
  '행사 완료 잠금과 겹치면 EVENT_COMPLETED가 먼저이고, 403이 409보다 먼저다',
  withSettlement(async t => {
    const kit = await periodsOf(t)
    const s = await sceneOf(t, kit)
    const eventExpense = await t.expense({ eventId: s.event, paidAt: DAY('2026-10-21T03:00') })
    await t.completion(s.event, 'completed', DAY('2026-10-24T03:00'))
    const item = await t.budgetItem(kit.budget, {
      type: 'income',
      purpose: '행사 수입',
      eventId: s.event,
    })
    const itemIncome = await t.make(t.council, 'income', {
      fiscalPeriodId: kit.period,
      source: 'fee',
      amount: '1000',
      receivedOn: '2026-10-21',
      budgetItemId: item,
    })
    await setPublished(t, kit.closing, true)
    const cancel = await post(t, `/expenses/${eventExpense}/cancel`, { reason: '잘못' })
    assert.equal(await errorOf(cancel), 'EVENT_COMPLETED')
    const spend = await post(t, '/expenses', { ...EXPENSE, eventId: s.event })
    assert.equal(await errorOf(spend), 'EVENT_COMPLETED')
    const earn = await post(t, '/incomes', {
      source: 'grant',
      amount: 1000,
      receivedOn: '2026-10-24',
      budgetItemId: item,
    })
    assert.equal(await errorOf(earn), 'EVENT_COMPLETED')
    const undo = await post(t, `/incomes/${itemIncome}/cancel`, { reason: '잘못' })
    assert.equal(await errorOf(undo), 'EVENT_COMPLETED')
    // 재정부가 아니면 잠금을 보기 전에 403이다
    assert.equal((await post(t, '/expenses', EXPENSE, PRESIDENT)).status, 403)
    assert.equal(
      (await post(t, `/incomes/${s.income}/cancel`, { reason: 'x' }, PRESIDENT)).status,
      403,
    )
  }),
)

test(
  '지출·수입 상세의 actions는 공개한 기간에서 취소를 빼고(환급은 남는다), 다시 열면 돌아온다',
  withSettlement(async t => {
    const kit = await periodsOf(t)
    const s = await sceneOf(t, kit)
    const base = `/api/organizations/${t.council.councilId}`
    const actions = async () => {
      const expense = (await (
        await t.api.get(`${base}/expenses/${s.expense}`, FINANCE)
      ).json()) as ExpenseResponse
      const income = (await (
        await t.api.get(`${base}/incomes/${s.income}`, FINANCE)
      ).json()) as IncomeResponse
      return [expense.expense.actions as string[], income.income.actions as string[]]
    }
    const [openExpense, openIncome] = await actions()
    assert.ok(openExpense?.includes('expense.cancel'))
    assert.deepEqual(openIncome, ['income.cancel'])
    await setPublished(t, kit.closing, true)
    const [lockedExpense, lockedIncome] = await actions()
    assert.ok(!lockedExpense?.includes('expense.cancel'))
    assert.ok(lockedExpense?.includes('expense.reimburse'))
    assert.deepEqual(lockedIncome, [])
    await setPublished(t, kit.closing, false)
    assert.deepEqual(await actions(), [openExpense, openIncome])
  }),
)

test(
  '다른 학생회가 같은 날짜의 기간을 공개해도 우리 지출·수입은 적고 취소할 수 있고 actions에 취소가 남는다',
  withSettlement(async t => {
    const mine = await periodsOf(t)
    const s = await sceneOf(t, mine)
    const theirs = await t.budgetOf(t.other)
    await t.make(t.other, 'account_closing', {
      fiscalPeriodId: theirs.period,
      publishedAt: new Date('2026-10-24T03:00:00Z'),
    })
    assert.equal((await post(t, '/expenses', EXPENSE)).status, 201)
    assert.equal((await post(t, `/expenses/${s.expense}/cancel`, { reason: '잘못' })).status, 200)
    const income = { source: 'grant', amount: 1000, receivedOn: '2026-10-24' }
    assert.equal((await post(t, '/incomes', income)).status, 201)
    assert.equal((await post(t, `/incomes/${s.income}/cancel`, { reason: '잘못' })).status, 200)
    const another = await sceneOf(t, mine)
    const base = `/api/organizations/${t.council.councilId}`
    const detail = (await (
      await t.api.get(`${base}/expenses/${another.expense}`, FINANCE)
    ).json()) as ExpenseResponse
    assert.ok(detail.expense.actions.includes('expense.cancel'))
    const owned = (await (
      await t.api.get(`${base}/incomes/${another.income}`, FINANCE)
    ).json()) as IncomeResponse
    assert.deepEqual(owned.income.actions, ['income.cancel'])
  }),
)
