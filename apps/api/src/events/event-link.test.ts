import assert from 'node:assert/strict'
import { test } from 'node:test'
import type {
  BudgetResponse,
  ExpenseResponse,
  ExpensesResponse,
  PurchaseRequestResponse,
  PurchaseRequestsResponse,
} from '@vada/contracts'
import { withSettlement, type SettlementKit } from '../test-support/settlement.js'

// 요청, 예산 항목, 지출을 행사에 잇는 쓰기(조각 5). 다른 학생회 행사는 409 EVENT_INVALID, 완료한 행사는 409 EVENT_COMPLETED다.

const FINANCE = 's-financeMember'
const PRESIDENT = 's-president'
const PLANNER = 's-planningMember'
const DAY = (value: string) => new Date(`${value}:00Z`)
const EXPENSE = {
  method: 'card',
  vendor: '문구점',
  description: '마커',
  amount: 10000,
  paidOn: '2026-10-25',
}
const NO_SUCH = '01a164e0-8f14-7fff-b9d9-fc48438f6ee9'

const root = (t: SettlementKit) => `/api/organizations/${t.council.councilId}`
const post = (t: SettlementKit, path: string, body: unknown, user = FINANCE) =>
  t.api.post(`${root(t)}${path}`, body, user)
const get = (t: SettlementKit, path: string, user = FINANCE) => t.api.get(`${root(t)}${path}`, user)
const errorOf = async (response: Response) => ((await response.json()) as { error?: string }).error
const records = async (t: SettlementKit) =>
  JSON.stringify((await t.pg.query('SELECT count(*)::int AS n FROM record')).rows)

const REQUEST = { title: '마커', items: [{ name: '마커', quantity: 1 }] }

async function complete(t: SettlementKit, eventId: string) {
  await t.completion(eventId, 'completed', DAY('2026-10-24T03:00'))
}

test(
  '요청 내기: 행사를 이으면 요약과 상세에 행사 이름이 있고, 행사 없이도 낸다',
  withSettlement(async t => {
    const event = await t.event({ name: '봄 축제' })
    const withEvent = await post(t, '/purchase-requests', { ...REQUEST, eventId: event }, PLANNER)
    assert.equal(withEvent.status, 201)
    const made = ((await withEvent.json()) as PurchaseRequestResponse).request
    assert.deepEqual(made.event, { id: event, name: '봄 축제' })
    const loose = await post(t, '/purchase-requests', REQUEST, PLANNER)
    assert.equal(loose.status, 201)
    assert.equal(((await loose.json()) as PurchaseRequestResponse).request.event, null)
    const row = await t.pg.query('SELECT event_id FROM request WHERE id = $1', [made.id])
    assert.equal((row.rows[0] as { event_id: string }).event_id, event)
    const detail = await get(t, `/purchase-requests/${made.id}`)
    assert.deepEqual(((await detail.json()) as PurchaseRequestResponse).request.event, {
      id: event,
      name: '봄 축제',
    })
  }),
)

test(
  '요청 내기: 다른 학생회와 없는 행사는 409 EVENT_INVALID, 완료한 행사는 409 EVENT_COMPLETED이고 아무것도 쓰지 않는다',
  withSettlement(async t => {
    const theirs = await t.event({}, t.other)
    await t.completionOfOther(theirs)
    const done = await t.event()
    await complete(t, done)
    const before = await records(t)
    for (const [eventId, code] of [
      [theirs, 'EVENT_INVALID'],
      [NO_SUCH, 'EVENT_INVALID'],
      [done, 'EVENT_COMPLETED'],
    ] as const) {
      const response = await post(t, '/purchase-requests', { ...REQUEST, eventId }, PLANNER)
      assert.equal(response.status, 409, code)
      assert.equal(await errorOf(response), code)
    }
    assert.equal(await records(t), before)
    // 다른 학생회 행사는 그 행사가 완료여도 같은 응답이라 완료 여부가 드러나지 않는다.
    await t.make(t.other, 'approval', {
      targetId: theirs,
      targetKind: 'event',
      outcome: 'completed',
      actorId: t.other.people.president.memberId,
      actorKind: 'member',
      actedAt: DAY('2026-10-24T03:00'),
    })
    const hidden = await post(t, '/purchase-requests', { ...REQUEST, eventId: theirs }, PLANNER)
    assert.equal(await errorOf(hidden), 'EVENT_INVALID')
    const bad = await post(t, '/purchase-requests', { ...REQUEST, eventId: 'x' }, PLANNER)
    assert.equal(bad.status, 400)
  }),
)

test(
  '예산 항목 더하기: 종류와 행사를 고르고 목록에 종류와 행사 이름이 있다',
  withSettlement(async t => {
    await t.budgetOf()
    const event = await t.event({ name: '봄 축제' })
    const made = await post(t, '/budget-items', {
      purpose: '참가비',
      amount: 50000,
      type: 'income',
      eventId: event,
    })
    assert.equal(made.status, 201)
    const plain = await post(t, '/budget-items', { purpose: '비품', amount: 1000 })
    assert.equal(plain.status, 201)
    const view = (await (await get(t, '/budget')).json()) as BudgetResponse
    assert.deepEqual(
      view.items.map(item => [item.purpose, item.type, item.event?.name ?? null]),
      [
        ['비품', 'expense', null],
        ['참가비', 'income', '봄 축제'],
      ],
    )
    assert.equal(
      (await post(t, '/budget-items', { purpose: 'x', amount: 1 }, PRESIDENT)).status,
      403,
    )
  }),
)

test(
  '예산 항목 더하기: 다른 학생회 행사는 EVENT_INVALID, 완료한 행사는 EVENT_COMPLETED(403이 먼저)',
  withSettlement(async t => {
    await t.budgetOf()
    const theirs = await t.event({}, t.other)
    // 다른 학생회의 완료한 행사여도 EVENT_COMPLETED가 아니라 EVENT_INVALID다(잠금 확인이 뒤).
    await t.completionOfOther(theirs)
    const done = await t.event()
    await complete(t, done)
    const before = await records(t)
    const input = (eventId: string) => ({ purpose: '비품', amount: 1, eventId })
    assert.equal(await errorOf(await post(t, '/budget-items', input(theirs))), 'EVENT_INVALID')
    assert.equal(await errorOf(await post(t, '/budget-items', input(NO_SUCH))), 'EVENT_INVALID')
    assert.equal(await errorOf(await post(t, '/budget-items', input(done))), 'EVENT_COMPLETED')
    assert.equal(await records(t), before)
    // 권한이 없으면 행사가 어떻든 403이다.
    assert.equal((await post(t, '/budget-items', input(done), PRESIDENT)).status, 403)
    assert.equal((await post(t, '/budget-items', input(theirs), PRESIDENT)).status, 403)
  }),
)

test(
  '수입 예산 항목은 결재와 지출에서 고를 수 없다: 409 BUDGET_ITEM_INVALID',
  withSettlement(async t => {
    const { budget } = await t.budgetOf()
    const income = await t.budgetItem(budget, { type: 'income', purpose: '참가비' })
    const spend = await t.budgetItem(budget, {})
    const request = await t.requestWithItem(null)
    const before = await records(t)
    const decide = (item: string) =>
      post(t, `/purchase-requests/${request.request}/decisions`, {
        decisions: [
          { lineItemId: request.line, outcome: 'approved', amount: 1000, budgetItemId: item },
        ],
      })
    const denied = await decide(income)
    assert.equal(denied.status, 409)
    assert.equal(await errorOf(denied), 'BUDGET_ITEM_INVALID')
    const paid = await post(t, '/expenses', { ...EXPENSE, budgetItemId: income })
    assert.equal(paid.status, 409)
    assert.equal(await errorOf(paid), 'BUDGET_ITEM_INVALID')
    assert.equal(await records(t), before)
    assert.equal((await decide(spend)).status, 200)
    assert.equal((await post(t, '/expenses', { ...EXPENSE, budgetItemId: spend })).status, 201)
  }),
)

test(
  '지출 적기: 행사를 이으면 상세와 목록에 행사 이름이 있다',
  withSettlement(async t => {
    const event = await t.event({ name: '봄 축제' })
    const response = await post(t, '/expenses', { ...EXPENSE, eventId: event })
    assert.equal(response.status, 201)
    const made = ((await response.json()) as ExpenseResponse).expense
    assert.deepEqual(made.event, { id: event, name: '봄 축제' })
    const loose = await post(t, '/expenses', EXPENSE)
    assert.equal(((await loose.json()) as ExpenseResponse).expense.event, null)
  }),
)

test(
  '지출 적기: 다른 학생회 행사는 EVENT_INVALID, 완료한 행사는 EVENT_COMPLETED',
  withSettlement(async t => {
    const theirs = await t.event({}, t.other)
    await t.completionOfOther(theirs)
    const done = await t.event()
    await complete(t, done)
    const before = await records(t)
    for (const [eventId, code] of [
      [theirs, 'EVENT_INVALID'],
      [NO_SUCH, 'EVENT_INVALID'],
      [done, 'EVENT_COMPLETED'],
    ] as const) {
      const response = await post(t, '/expenses', { ...EXPENSE, eventId })
      assert.equal(response.status, 409, code)
      assert.equal(await errorOf(response), code)
    }
    assert.equal(await records(t), before)
    assert.equal((await post(t, '/expenses', { ...EXPENSE, eventId: done }, PRESIDENT)).status, 403)
  }),
)

async function approvedLine(t: SettlementKit, eventId: string | null) {
  const item = await t.requestWithItem(eventId)
  await t.approve(item.line)
  return item.line
}

test(
  '지출 적기: 결제 내역의 요청에 행사가 있으면 행사를 빼도 그 행사로 채우고, 다르게 주면 EVENT_MISMATCH',
  withSettlement(async t => {
    const first = await t.event({ name: '봄 축제' })
    const second = await t.event({ name: '가을 축제' })
    const line = await approvedLine(t, first)
    const lines = [{ lineItemId: line, amount: 10000 }]
    const filled = await post(t, '/expenses', { ...EXPENSE, lines })
    assert.equal(filled.status, 201)
    assert.equal(((await filled.json()) as ExpenseResponse).expense.event?.name, '봄 축제')
    const same = await post(t, '/expenses', {
      ...EXPENSE,
      eventId: first,
      lines: [{ lineItemId: await approvedLine(t, first), amount: 10000 }],
    })
    assert.equal(same.status, 201)
    const before = await records(t)
    const other = await post(t, '/expenses', {
      ...EXPENSE,
      eventId: second,
      lines: [{ lineItemId: await approvedLine(t, first), amount: 10000 }],
    })
    assert.equal(other.status, 409)
    assert.equal(await errorOf(other), 'EVENT_MISMATCH')
    const none = await post(t, '/expenses', {
      ...EXPENSE,
      eventId: null,
      lines: [{ lineItemId: await approvedLine(t, first), amount: 10000 }],
    })
    assert.equal(none.status, 201)
    assert.notEqual(await records(t), before)
  }),
)

test(
  '지출 적기: 요청들의 행사가 서로 다르면 EVENT_MISMATCH이고 쓰지 않는다, 행사 없는 요청은 행사를 고를 수 있다',
  withSettlement(async t => {
    const first = await t.event()
    const second = await t.event()
    const a = await approvedLine(t, first)
    const b = await approvedLine(t, second)
    const before = await records(t)
    const mixed = await post(t, '/expenses', {
      ...EXPENSE,
      amount: 20000,
      lines: [
        { lineItemId: a, amount: 10000 },
        { lineItemId: b, amount: 10000 },
      ],
    })
    assert.equal(mixed.status, 409)
    assert.equal(await errorOf(mixed), 'EVENT_MISMATCH')
    assert.equal(await records(t), before)
    const free = await approvedLine(t, null)
    const chosen = await post(t, '/expenses', {
      ...EXPENSE,
      eventId: first,
      lines: [{ lineItemId: free, amount: 10000 }],
    })
    assert.equal(chosen.status, 201)
    assert.equal(((await chosen.json()) as ExpenseResponse).expense.event?.id, first)
  }),
)

test(
  '읽기 거르기: expenses?event=와 purchase-requests?view=all&event=는 그 행사의 것만, 다른 학생회 행사는 404',
  withSettlement(async t => {
    const mine = await t.event()
    const other = await t.event()
    const theirs = await t.event({}, t.other)
    const inMine = await t.expense({ eventId: mine })
    await t.expense({ eventId: other })
    await t.expense({})
    const requestMine = await t.requestWithItem(mine)
    await t.requestWithItem(other)
    await t.requestWithItem(null)
    const expenses = (await (await get(t, `/expenses?event=${mine}`)).json()) as ExpensesResponse
    assert.deepEqual(
      expenses.expenses.map(item => item.id),
      [inMine],
    )
    const requests = (await (
      await get(t, `/purchase-requests?view=all&event=${mine}`)
    ).json()) as PurchaseRequestsResponse
    assert.deepEqual(
      requests.requests.map(item => item.id),
      [requestMine.request],
    )
    assert.equal((await get(t, `/expenses?event=${theirs}`)).status, 404)
    assert.equal((await get(t, `/purchase-requests?view=all&event=${theirs}`)).status, 404)
    assert.equal((await get(t, `/expenses?event=${NO_SUCH}`)).status, 404)
    assert.equal((await get(t, `/expenses?event=x`)).status, 400)
    assert.equal((await get(t, `/expenses?event=${mine}&event=${other}`)).status, 400)
    assert.equal((await get(t, '/expenses')).status, 200)
    assert.equal((await get(t, '/purchase-requests?view=all')).status, 200)
  }),
)

test(
  '지출 적기: 고른 예산 항목의 행사와 지출의 행사가 다르면 EVENT_MISMATCH, 같거나 한쪽이 없으면 된다',
  withSettlement(async t => {
    const { budget } = await t.budgetOf()
    const first = await t.event({ name: '봄 축제' })
    const second = await t.event({ name: '가을 축제' })
    const tied = await t.budgetItem(budget, { eventId: first })
    const loose = await t.budgetItem(budget, {})
    const before = await records(t)
    const denied = await post(t, '/expenses', { ...EXPENSE, budgetItemId: tied, eventId: second })
    assert.equal(denied.status, 409)
    assert.equal(await errorOf(denied), 'EVENT_MISMATCH')
    assert.equal(await records(t), before)
    for (const body of [
      { budgetItemId: tied, eventId: first },
      { budgetItemId: tied },
      { budgetItemId: loose, eventId: second },
    ])
      assert.equal((await post(t, '/expenses', { ...EXPENSE, ...body })).status, 201)
  }),
)

test(
  '지출 적기: 행사를 빼도 고른 예산 항목에 행사가 있으면 그 행사로 채운다',
  withSettlement(async t => {
    const { budget } = await t.budgetOf()
    const first = await t.event({ name: '봄 축제' })
    const tied = await t.budgetItem(budget, { eventId: first })
    const loose = await t.budgetItem(budget, {})
    const filled = await post(t, '/expenses', { ...EXPENSE, budgetItemId: tied })
    assert.equal(((await filled.json()) as ExpenseResponse).expense.event?.name, '봄 축제')
    const bare = await post(t, '/expenses', { ...EXPENSE, budgetItemId: loose })
    assert.equal(((await bare.json()) as ExpenseResponse).expense.event, null)
  }),
)
