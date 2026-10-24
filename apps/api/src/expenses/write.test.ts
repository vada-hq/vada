import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { BudgetResponse, ExpenseDetail } from '@vada/contracts'
import { clockNow, createRecord } from '../records/records.js'
import { errorOf, MISSING, runPurchases, type PurchaseKit } from '../test-support/purchases.js'

const FINANCE = 's-financeMember'

const expenseOf = async (response: Response) =>
  ((await response.json()) as { expense: ExpenseDetail }).expense
const expensesUrl = (s: PurchaseKit) => `/api/organizations/${s.council.councilId}/expenses`
const counts = (s: PurchaseKit) =>
  Promise.all(
    ['expense', 'payment_line', 'evidence'].map(table =>
      s.count(`SELECT count(*) AS n FROM ${table}`),
    ),
  )

// 기간과 지출 항목 하나, 요청 하나(품목 셋: 승인, 승인, 반려)를 둔다.
async function prepare(s: PurchaseKit) {
  const root = `/api/organizations/${s.council.councilId}`
  await s.api.post(
    `${root}/fiscal-periods`,
    { name: '2026 2학기', startsOn: '2026-09-01', endsOn: '2026-12-31' },
    FINANCE,
  )
  const view = (await (
    await s.api.post(`${root}/budget-items`, { purpose: '소모품', amount: 100000 }, FINANCE)
  ).json()) as BudgetResponse
  const request = await s.made({
    title: '마커와 자석',
    items: [
      { name: '마커', quantity: 3 },
      { name: '자석', quantity: 2 },
      { name: '테이프', quantity: 1 },
    ],
  })
  const [first, second, third] = request.items.map(item => item.id) as [string, string, string]
  await s.decide(first, 'approved')
  await s.decide(second, 'approved')
  await s.decide(third, 'rejected')
  return { request, first, second, third, budgetItemId: view.items[0]!.id }
}
type Prepared = Awaited<ReturnType<typeof prepare>>

const lineBody = (p: Prepared, extra: object = {}) => ({
  vendor: '다이소',
  description: '마커 구입',
  amount: 15000,
  paidOn: '2026-10-25',
  lines: [{ lineItemId: p.first, amount: 15000 }],
  ...extra,
})
const post = (s: PurchaseKit, body: unknown, user = FINANCE) =>
  s.api.post(expensesUrl(s), body, user)

test(
  '재정부가 요청을 거친 지출을 적는다: 201, 결제 내역, 적은 사람의 승인 결재 기록, 판 1',
  runPurchases(async s => {
    const p = await prepare(s)
    const response = await post(
      s,
      lineBody(p, { vendor: ' 다이소 ', paidBy: s.council.people.planningMember.memberId }),
    )
    assert.equal(response.status, 201)
    const detail = await expenseOf(response)
    assert.deepEqual(
      [detail.vendor, detail.amount, detail.paidOn, detail.method, detail.cancelled],
      ['다이소', 15000, '2026-10-25', 'card', false],
    )
    assert.equal(detail.paidBy?.name, 's planningMember')
    assert.equal(detail.reimbursed, false)
    assert.deepEqual(
      detail.lines.map(line => [line.name, line.amount, line.requestId, line.requestTitle]),
      [['마커', 15000, p.request.id, '마커와 자석']],
    )
    assert.equal(detail.approvals.length, 1)
    assert.deepEqual(
      [detail.approvals[0]!.outcome, detail.approvals[0]!.by?.name],
      ['approved', 's financeMember'],
    )
    assert.equal(await s.versions(detail.id), 1)
    assert.deepEqual(
      detail.history.map(version => version.changes),
      [[{ field: 'created' }]],
    )
    assert.deepEqual(detail.actions, ['expense.cancel', 'expense.reimburse', 'expense.update'])
    const read = (await (
      await s.api.get(
        `/api/organizations/${s.council.councilId}/purchase-requests/${p.request.id}`,
        FINANCE,
      )
    ).json()) as {
      request: { items: { paid: boolean }[]; expenses: { id: string; cancelled: boolean }[] }
    }
    assert.deepEqual(
      read.request.items.map(item => item.paid),
      [true, false, false],
    )
    assert.deepEqual(read.request.expenses, [
      {
        id: detail.id,
        vendor: '다이소',
        amount: 15000,
        paidAt: '2026-10-24T15:00:00.000Z',
        cancelled: false,
      },
    ])
  }),
)

test(
  '한 품목을 두 지출에 나눠 결제할 수 있고 두 품목을 한 지출에 묶을 수 있다',
  runPurchases(async s => {
    const p = await prepare(s)
    for (const amount of [6000, 9000])
      assert.equal(
        (await post(s, lineBody(p, { amount, lines: [{ lineItemId: p.first, amount }] }))).status,
        201,
      )
    const both = await post(
      s,
      lineBody(p, {
        amount: 3000,
        lines: [
          { lineItemId: p.first, amount: 1000 },
          { lineItemId: p.second, amount: 2000 },
        ],
      }),
    )
    assert.equal(both.status, 201)
    assert.equal((await counts(s))[1], 4)
  }),
)

test(
  '요청 없는 지출은 예산 항목과 부탁한 사람을 고를 수 있고 기본 결제 수단은 카드다',
  runPurchases(async s => {
    const p = await prepare(s)
    const response = await post(s, {
      vendor: '문구점',
      description: '볼펜',
      amount: 3000,
      paidOn: '2026-10-01',
      method: 'cash',
      reason: '급히 필요',
      budgetItemId: p.budgetItemId,
      requestedBy: s.council.people.planningHead.memberId,
    })
    assert.equal(response.status, 201)
    const detail = await expenseOf(response)
    assert.deepEqual(
      [detail.method, detail.reason, detail.budgetItem?.purpose, detail.requestedBy?.name],
      ['cash', '급히 필요', '소모품', 's planningHead'],
    )
    assert.equal(detail.paidBy, null)
    assert.deepEqual(detail.actions, ['expense.cancel', 'expense.update'])
    assert.deepEqual(detail.lines, [])
    const bare = await expenseOf(
      await post(s, { vendor: 'a', description: 'b', amount: 1, paidOn: '2026-10-25' }),
    )
    assert.equal(bare.method, 'card')
    assert.equal(bare.budgetItem, null)
  }),
)

test(
  '재정부가 아니면 적지 못한다: 회장단과 부원은 403, 다른 학생회 403, 로그인 안 하면 401, 아무것도 생기지 않는다',
  runPurchases(async s => {
    const p = await prepare(s)
    const before = await counts(s)
    for (const user of [
      's-president',
      's-vicePresident',
      's-planningMember',
      's-ended',
      'o-financeMember',
    ])
      assert.equal((await post(s, lineBody(p), user)).status, 403, user)
    assert.equal((await post(s, lineBody(p), '')).status, 401)
    assert.deepEqual(await counts(s), before)
    assert.equal((await s.api.get(expensesUrl(s), 'o-financeMember')).status, 403)
  }),
)

test(
  '결제일은 오늘(한국)까지다: 오늘 23:59:59는 받고 내일은 400이다',
  runPurchases(async s => {
    const p = await prepare(s)
    const before = await counts(s)
    const tomorrow = await post(s, lineBody(p, { paidOn: '2026-10-26' }))
    assert.equal(tomorrow.status, 400)
    assert.equal(await errorOf(tomorrow), 'INVALID_INPUT')
    assert.deepEqual(await counts(s), before)
    // 한국 2026-10-25 23:59:59
    s.setNow(new Date('2026-10-25T14:59:59Z'))
    assert.equal((await post(s, lineBody(p, { paidOn: '2026-10-25' }))).status, 201)
    assert.equal((await post(s, lineBody(p, { paidOn: '2026-10-26' }))).status, 400)
    // 한국 2026-10-26 00:00:00
    s.setNow(new Date('2026-10-25T15:00:00Z'))
    assert.equal((await post(s, lineBody(p, { paidOn: '2026-10-26' }))).status, 201)
  }),
)

test(
  '승인되지 않았거나 반려됐거나 취소된 요청의 품목, 다른 학생회 품목은 409이고 아무것도 생기지 않는다',
  runPurchases(async s => {
    const p = await prepare(s)
    const pending = await s.made({ title: '대기', items: [{ name: 'a', quantity: 1 }] })
    const cancelled = await s.made({ title: '취소', items: [{ name: 'b', quantity: 1 }] })
    assert.equal(
      (
        await s.api.post(
          `/api/organizations/${s.council.councilId}/purchase-requests/${cancelled.id}/cancel`,
          {},
          's-planningMember',
        )
      ).status,
      204,
    )
    await s.decide(cancelled.items[0]!.id, 'approved')
    // 승인한 뒤 재정부가 취소한 품목은 마지막 결과가 취소라 결제할 수 없다(기능 014).
    const revoked = await s.made({ title: '취소됨', items: [{ name: 'd', quantity: 1 }] })
    await s.decide(revoked.items[0]!.id, 'approved')
    await s.decide(revoked.items[0]!.id, 'cancelled')
    const foreign = await s.api.post(
      `/api/organizations/${s.other.councilId}/purchase-requests`,
      { title: '남의 것', items: [{ name: 'c', quantity: 1 }] },
      'o-planningMember',
    )
    const foreignItem = ((await foreign.json()) as { request: { items: { id: string }[] } }).request
      .items[0]!.id
    await s.db.transaction(tx =>
      createRecord(tx, {
        kind: 'approval',
        councilId: s.other.councilId,
        actor: s.other.people.financeMember.memberId,
        values: {
          targetId: foreignItem,
          targetKind: 'line_item',
          outcome: 'approved',
          actorId: s.other.people.financeMember.memberId,
          actorKind: 'member',
          actedAt: clockNow,
          reason: null,
        },
      }),
    )
    const before = await counts(s)
    const unpayable = [
      p.third,
      pending.items[0]!.id,
      cancelled.items[0]!.id,
      revoked.items[0]!.id,
      foreignItem,
      MISSING,
    ]
    for (const id of unpayable) {
      const response = await post(s, lineBody(p, { lines: [{ lineItemId: id, amount: 15000 }] }))
      assert.equal(response.status, 409, id)
      assert.equal(await errorOf(response), 'LINE_ITEM_NOT_PAYABLE', id)
    }
    // 하나라도 안 되면 모두 안 된다.
    const mixed = await post(
      s,
      lineBody(p, {
        lines: [
          { lineItemId: p.first, amount: 5000 },
          { lineItemId: p.third, amount: 10000 },
        ],
      }),
    )
    assert.equal(mixed.status, 409)
    assert.deepEqual(await counts(s), before)
  }),
)

test(
  '먼저 낸 사람이나 부탁한 사람이 내보낸 사람이거나 다른 학생회 사람이면 409 MEMBER_INVALID다',
  runPurchases(async s => {
    const p = await prepare(s)
    const before = await counts(s)
    const people = [s.council.people.ended.memberId, s.other.people.president.memberId, MISSING]
    for (const memberId of people) {
      const paidBy = await post(s, lineBody(p, { paidBy: memberId }))
      assert.equal(paidBy.status, 409, memberId)
      assert.equal(await errorOf(paidBy), 'MEMBER_INVALID', memberId)
      const requestedBy = await post(s, {
        vendor: 'a',
        description: 'b',
        amount: 1,
        paidOn: '2026-10-25',
        requestedBy: memberId,
      })
      assert.equal(requestedBy.status, 409, memberId)
      assert.equal(await errorOf(requestedBy), 'MEMBER_INVALID', memberId)
    }
    assert.deepEqual(await counts(s), before)
  }),
)

test(
  '요청 없는 지출의 예산 항목이 다른 학생회, 수입, 지금 기간 밖이면 409 BUDGET_ITEM_INVALID다',
  runPurchases(async s => {
    const p = await prepare(s)
    const otherRoot = `/api/organizations/${s.other.councilId}`
    await s.api.post(
      `${otherRoot}/fiscal-periods`,
      { name: '남의 기간', startsOn: '2026-09-01', endsOn: '2026-12-31' },
      'o-financeMember',
    )
    const foreign = (await (
      await s.api.post(
        `${otherRoot}/budget-items`,
        { purpose: '남의 항목', amount: 1 },
        'o-financeMember',
      )
    ).json()) as BudgetResponse
    const root = `/api/organizations/${s.council.councilId}`
    await s.api.post(
      `${root}/fiscal-periods`,
      { name: '내년', startsOn: '2027-01-01', endsOn: '2027-06-30' },
      FINANCE,
    )
    const budgetOf = async (name: string) =>
      (
        (
          await s.pg.query(
            'SELECT b.id FROM budget b JOIN fiscal_period f ON f.id = b.fiscal_period_id WHERE f.name = $1',
            [name],
          )
        ).rows[0] as { id: string }
      ).id
    const extra = (budgetId: string, type: 'income' | 'expense') =>
      s.db.transaction(tx =>
        createRecord(tx, {
          kind: 'budget_item',
          councilId: s.council.councilId,
          actor: s.council.people.financeMember.memberId,
          values: { budgetId, type, purpose: '다른 항목', amount: '1' },
        }),
      )
    const income = await extra(await budgetOf('2026 2학기'), 'income')
    const later = await extra(await budgetOf('내년'), 'expense')
    const before = await counts(s)
    for (const id of [foreign.items[0]!.id, income, later, MISSING]) {
      const response = await post(s, {
        vendor: 'a',
        description: 'b',
        amount: 1,
        paidOn: '2026-10-25',
        budgetItemId: id,
      })
      assert.equal(response.status, 409, id)
      assert.equal(await errorOf(response), 'BUDGET_ITEM_INVALID', id)
    }
    assert.ok(p.budgetItemId)
    assert.deepEqual(await counts(s), before)
  }),
)
