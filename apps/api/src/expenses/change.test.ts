import assert from 'node:assert/strict'
import { test } from 'node:test'
import { drizzle } from 'drizzle-orm/pglite'
import type { ExpenseDetail, ExpensesResponse, PurchaseRequestDetail } from '@vada/contracts'
import { createApp } from '../app.js'
import { createBudgetRoutes } from '../budget/routes.js'
import { createTestDb } from '../db/test-db.js'
import { createPurchaseRoutes } from '../purchases/routes.js'
import { seedCouncil } from '../test-support/council.js'
import { caller, ORIGIN, testSession } from '../test-support/http.js'
import { errorOf, MISSING, runPurchases, type PurchaseKit } from '../test-support/purchases.js'
import { createExpenseRoutes } from './routes.js'

const FINANCE = 's-financeMember'
const BASE = {
  method: 'card',
  vendor: '다이소',
  description: '마커',
  amount: 15000,
  paidOn: '2026-10-25',
}

const expenseOf = async (response: Response) =>
  ((await response.json()) as { expense: ExpenseDetail }).expense
const url = (s: PurchaseKit) => `/api/organizations/${s.council.councilId}/expenses`
const make = async (s: PurchaseKit, extra: object = {}) =>
  expenseOf(await s.api.post(url(s), { ...BASE, ...extra }, FINANCE))
const act = (
  s: PurchaseKit,
  id: string,
  action: string,
  ...rest: [body?: unknown, user?: string]
) => s.api.post(`${url(s)}/${id}/${action}`, rest[0] ?? {}, rest[1] ?? FINANCE)
const planning = (s: PurchaseKit) => s.council.people.planningMember.memberId

test(
  '모든 운영진이 지출 목록을 읽는다: 결제일 최근 순, 줄에 사용처·금액·환급·증빙 수·취소가 있다',
  runPurchases(async s => {
    const old = await make(s, { vendor: '옛날', paidOn: '2026-09-01' })
    const fresh = await make(s, { vendor: '새것', paidOn: '2026-10-20', paidBy: planning(s) })
    const gone = await make(s, { vendor: '취소', paidOn: '2026-10-25' })
    assert.equal((await act(s, gone.id, 'cancel', { reason: '잘못 적음' })).status, 200)
    for (const user of [FINANCE, 's-president', 's-planningMember', 's-plain']) {
      const response = await s.api.get(url(s), user)
      assert.equal(response.status, 200, user)
      assert.equal(response.headers.get('cache-control'), 'no-store')
      const list = (await response.json()) as ExpensesResponse
      assert.equal(list.truncated, false)
      assert.deepEqual(
        list.expenses.map(item => [item.id, item.cancelled, item.reimbursed, item.evidenceCount]),
        [
          [gone.id, true, false, 0],
          [fresh.id, false, false, 0],
          [old.id, false, false, 0],
        ],
        user,
      )
    }
    const first = ((await (await s.api.get(url(s), FINANCE)).json()) as ExpensesResponse)
      .expenses[1]
    assert.deepEqual(first, {
      id: fresh.id,
      vendor: '새것',
      description: '마커',
      amount: 15000,
      paidOn: '2026-10-20',
      method: 'card',
      paidBy: { id: planning(s), name: 's planningMember' },
      reimbursed: false,
      evidenceCount: 0,
      cancelled: false,
      event: null,
    })
    // 내보낸 사람과 다른 학생회 사람은 읽지 못하고, 로그인하지 않으면 401이다.
    assert.equal((await s.api.get(url(s), 's-ended')).status, 403)
    assert.equal((await s.api.get(url(s), 'o-president')).status, 403)
    assert.equal((await s.api.get(url(s))).status, 401)
  }),
)

test(
  '지출 하나는 다른 학생회와 형식이 틀린 번호가 404이고 상세에 이력과 권한별 동작이 있다',
  runPurchases(async s => {
    const made = await make(s, { paidBy: planning(s), reason: '급함' })
    const own = await s.api.get(`${url(s)}/${made.id}`, 's-planningMember')
    assert.equal(own.status, 200)
    const detail = await expenseOf(own)
    assert.equal(detail.reason, '급함')
    assert.deepEqual(detail.actions, [])
    assert.deepEqual(detail.evidence, [])
    assert.equal(detail.history.length, 1)
    assert.deepEqual((await expenseOf(await s.api.get(`${url(s)}/${made.id}`, FINANCE))).actions, [
      'expense.cancel',
      'expense.reimburse',
      'expense.update',
      'expense.attach_evidence',
    ])
    for (const id of [MISSING, 'not-a-uuid'])
      assert.equal((await s.api.get(`${url(s)}/${id}`, FINANCE)).status, 404, id)
    const foreign = `/api/organizations/${s.other.councilId}/expenses/${made.id}`
    assert.equal((await s.api.get(foreign, 'o-financeMember')).status, 404)
    assert.equal((await s.api.get(`${url(s)}/${made.id}`, 'o-financeMember')).status, 403)
  }),
)

test(
  '취소는 사유를 판에 남기고, 목록에 남으며, 다시 취소하면 409 EXPENSE_CANCELLED다',
  runPurchases(async s => {
    const made = await make(s)
    const response = await act(s, made.id, 'cancel', { reason: ' 중복 입력 ' })
    assert.equal(response.status, 200)
    const detail = await expenseOf(response)
    assert.equal(detail.cancelled, true)
    assert.deepEqual(detail.actions, [])
    assert.deepEqual(
      detail.history.map(version => [version.changes, version.reason]),
      [
        [[{ field: 'created' }], null],
        [[{ field: 'cancelled' }], '중복 입력'],
      ],
    )
    assert.equal(detail.history[1]!.by?.name, 's financeMember')
    assert.equal(await s.versions(made.id), 2)
    const again = await act(s, made.id, 'cancel', { reason: '또' })
    assert.equal(again.status, 409)
    assert.equal(await errorOf(again), 'EXPENSE_CANCELLED')
    assert.equal(await s.versions(made.id), 2)
  }),
)

test(
  '취소의 입력과 권한: 사유가 없거나 비거나 501자거나 모르는 키면 400, 재정부가 아니면 403, 다른 학생회와 없는 지출은 404',
  runPurchases(async s => {
    const made = await make(s)
    const bad: unknown[] = [
      {},
      { reason: '' },
      { reason: '  ' },
      { reason: '😀'.repeat(501) },
      { reason: 'a\u0000' },
      { reason: 'a\uD800' },
      { reason: 'a', extra: 1 },
    ]
    for (const body of bad) assert.equal((await act(s, made.id, 'cancel', body)).status, 400)
    assert.equal(
      (await act(s, made.id, 'cancel', { reason: '😀'.repeat(500) }, 's-president')).status,
      403,
    )
    for (const user of ['s-president', 's-planningMember', 's-ended', 'o-financeMember'])
      assert.equal((await act(s, made.id, 'cancel', { reason: 'a' }, user)).status, 403, user)
    assert.equal((await act(s, made.id, 'cancel', { reason: 'a' }, '')).status, 401)
    assert.equal((await act(s, MISSING, 'cancel', { reason: 'a' })).status, 404)
    assert.equal((await act(s, 'not-a-uuid', 'cancel', { reason: 'a' })).status, 404)
    const foreign = await s.api.post(
      `/api/organizations/${s.other.councilId}/expenses/${made.id}/cancel`,
      { reason: 'a' },
      'o-financeMember',
    )
    assert.equal(foreign.status, 404)
    assert.equal(await s.versions(made.id), 1)
    assert.equal((await act(s, made.id, 'cancel', { reason: '😀'.repeat(500) })).status, 200)
  }),
)

test(
  '취소한 지출의 품목은 요청 상세에서 결제함이 아니고 지출은 취소됨으로 남는다',
  runPurchases(async s => {
    const root = `/api/organizations/${s.council.councilId}`
    const request = await s.made({ title: 'a', items: [{ name: 'a', quantity: 1 }] })
    const itemId = request.items[0]!.id
    await s.decide(itemId, 'approved')
    const made = await make(s, { lines: [{ lineItemId: itemId, amount: 15000 }] })
    const read = async () =>
      (
        (await (await s.api.get(`${root}/purchase-requests/${request.id}`, FINANCE)).json()) as {
          request: PurchaseRequestDetail
        }
      ).request
    assert.deepEqual(
      (await read()).items.map(item => item.paid),
      [true],
    )
    await act(s, made.id, 'cancel', { reason: '취소' })
    const after = await read()
    assert.deepEqual(
      after.items.map(item => item.paid),
      [false],
    )
    assert.deepEqual(
      after.expenses.map(item => [item.id, item.cancelled]),
      [[made.id, true]],
    )
    // 취소된 지출 때문에 다시 결제하지 못하는 일은 없다.
    const again = await make(s, { lines: [{ lineItemId: itemId, amount: 15000 }] })
    assert.equal(again.lines.length, 1)
    assert.deepEqual(
      (await read()).items.map(item => item.paid),
      [true],
    )
  }),
)

test(
  '환급은 먼저 낸 사람이 있고 취소되지 않은 지출에 한 번만 되고 판에 남는다',
  runPurchases(async s => {
    const own = await make(s)
    const cancelled = await make(s, { paidBy: planning(s) })
    const advanced = await make(s, { paidBy: planning(s) })
    await act(s, cancelled.id, 'cancel', { reason: 'a' })
    for (const id of [own.id, cancelled.id]) {
      const response = await act(s, id, 'reimburse')
      assert.equal(response.status, 409, id)
      assert.equal(await errorOf(response), 'NOT_REIMBURSABLE', id)
    }
    const response = await act(s, advanced.id, 'reimburse')
    assert.equal(response.status, 200)
    const detail = await expenseOf(response)
    assert.equal(detail.reimbursed, true)
    assert.deepEqual(detail.actions, [
      'expense.cancel',
      'expense.update',
      'expense.attach_evidence',
    ])
    assert.deepEqual(
      detail.history.map(version => version.changes),
      [[{ field: 'created' }], [{ field: 'reimbursed' }]],
    )
    const again = await act(s, advanced.id, 'reimburse')
    assert.equal(again.status, 409)
    assert.equal(await errorOf(again), 'NOT_REIMBURSABLE')
    assert.equal(await s.versions(advanced.id), 2)
    assert.equal(await s.versions(own.id), 1)
    // 환급한 지출도 취소할 수 있다. 취소한 뒤에는 환급 표시가 남는다.
    assert.equal((await act(s, advanced.id, 'cancel', { reason: 'a' })).status, 200)
  }),
)

test(
  '환급의 권한과 입력: 재정부가 아니면 403, 본문에 키가 있으면 400, 없는 지출 404',
  runPurchases(async s => {
    const made = await make(s, { paidBy: planning(s) })
    for (const user of ['s-president', 's-planningMember', 's-ended', 'o-financeMember'])
      assert.equal((await act(s, made.id, 'reimburse', {}, user)).status, 403, user)
    assert.equal((await act(s, made.id, 'reimburse', {}, '')).status, 401)
    assert.equal((await act(s, made.id, 'reimburse', { x: 1 })).status, 400)
    assert.equal((await act(s, MISSING, 'reimburse')).status, 404)
    assert.equal(await s.versions(made.id), 1)
  }),
)

// 쓰기 거래는 학생회 행 잠금 → 운영진 확인 → 지출 행 순서다. 취소와 환급이 겹치면 지출 행 잠금 뒤의 값을 읽어 하나만 된다.
test('지출 쓰기는 학생회 행을 잠근 뒤 운영진을 확인하고, 취소와 환급은 지출 행을 잠근 뒤에 쓴다', async () => {
  const { pg, close } = await createTestDb()
  try {
    const queries: string[] = []
    const db = drizzle(pg, { logger: { logQuery: query => void queries.push(query) } })
    const council = await seedCouncil(db, pg)
    const noon = new Date('2026-10-25T03:00:00Z')
    const api = caller(
      createApp({
        auth: { handler: async () => new Response() },
        trustedOrigin: ORIGIN,
        purchases: createPurchaseRoutes(db, testSession, { clock: () => noon }),
        budget: createBudgetRoutes(db, testSession, { clock: () => noon }),
        expenses: createExpenseRoutes(db, testSession, {
          clock: () => noon,
          receiptKey: 'test-receipt-key',
        }),
      }),
    )
    const base = `/api/organizations/${council.councilId}/expenses`
    const lockOf = (table: string) =>
      queries.findIndex(
        query => query.includes(`from "${table}"`) && query.endsWith(' for no key update'),
      )
    const actorOf = () => queries.findIndex(query => query.includes('"member_login"'))
    queries.length = 0
    const created = await api.post(
      base,
      { ...BASE, paidBy: council.people.planningMember.memberId },
      FINANCE,
    )
    assert.equal(created.status, 201)
    const councilLock = lockOf('council')
    const member = queries.map(query => query.includes('"council_membership"')).lastIndexOf(true)
    assert.ok(councilLock >= 0 && actorOf() > councilLock, '만들기: 학생회 잠금 뒤에 운영진 확인')
    assert.ok(
      queries.findIndex(query => query.includes('insert into "record"')) > actorOf(),
      '만들기: 쓰기는 운영진 확인 뒤',
    )
    assert.ok(member > actorOf(), '만들기: 먼저 낸 사람 확인은 운영진 확인 뒤')
    const { expense } = (await created.json()) as { expense: { id: string } }
    for (const [action, body] of [
      ['reimburse', {}],
      ['cancel', { reason: 'a' }],
    ] as const) {
      queries.length = 0
      assert.equal((await api.post(`${base}/${expense.id}/${action}`, body, FINANCE)).status, 200)
      const rowLock = lockOf('expense')
      const update = queries.findIndex(query => query.includes('update "expense"'))
      assert.ok(
        lockOf('council') >= 0 && actorOf() > lockOf('council'),
        `${action}: 학생회 잠금 뒤에 운영진 확인`,
      )
      assert.ok(rowLock > actorOf(), `${action}: 지출 행 잠금이 운영진 확인 뒤`)
      assert.ok(update > rowLock, `${action}: 쓰기는 지출 행을 잠근 뒤`)
    }
  } finally {
    await close()
  }
})

test(
  '로그에 금액, 사용처, 사유, 이름이 남지 않는다',
  runPurchases(async s => {
    const lines: string[] = []
    const originals = {
      log: console.log,
      info: console.info,
      warn: console.warn,
      error: console.error,
    }
    for (const key of Object.keys(originals) as (keyof typeof originals)[])
      console[key] = (...args: unknown[]) => void lines.push(args.map(String).join(' '))
    try {
      const made = await make(s, { vendor: '비밀가게', reason: '비밀사유', paidBy: planning(s) })
      await act(s, made.id, 'reimburse')
      await act(s, made.id, 'cancel', { reason: '비밀취소' })
      await act(s, MISSING, 'cancel', { reason: '비밀취소' })
      await s.api.post(url(s), { ...BASE, vendor: '' }, FINANCE)
    } finally {
      Object.assign(console, originals)
    }
    const text = lines.join('\n')
    for (const secret of ['비밀가게', '비밀사유', '비밀취소', '15000', 's planningMember'])
      assert.ok(!text.includes(secret), secret)
  }),
)
