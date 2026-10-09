import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { EventFinanceResponse, ExpenseResponse } from '@vada/contracts'
import { link, setupPurchases } from '../purchases/test-setup.js'

type Env = Awaited<ReturnType<typeof setupPurchases>>
const body = (overrides: Record<string, unknown> = {}) => ({ eventId: 'e', vendor: '쿠팡', description: '체육대회 물품', amount: 46000,
  paidOn: '2026-10-09', method: 'council_card', payerMembershipId: 'mf', note: null, itemIds: [] as string[], ...overrides })
const create = async (env: Env, overrides: Record<string, unknown> = {}) =>
  (await env.ok<ExpenseResponse>(env.request('POST', '/expenses', body(overrides)), 201)).expense
const readyReceipt = (expenseId: string, id = 'r1') => `INSERT INTO expense_receipts
  (id,organization_id,expense_id,object_key,file_name,content_type,size_bytes,kind,status,uploaded_by,confirmed_at)
  VALUES ('${id}','a','${expenseId}','receipts/a/${expenseId}/${id}','영수증.jpg','image/jpeg',1234,'receipt','ready','f',now())`
const financeOf = (env: Env, event = 'e') => env.ok<EventFinanceResponse>(env.request('GET', `/events/${event}/finance`))
async function refused(pending: Response | Promise<Response>, status: number, error: string, label = error) {
  const response = await pending
  assert.equal(response.status, status, label)
  assert.deepEqual(await response.json(), { error }, label)
}

test('숫자: 실제 지출은 취소를 빼고, 지출 예정은 지출에 연결 안 된 승인 품목이며, 금액을 모르는 품목과 정산 조건 셋을 센다', async () => {
  const env = await setupPurchases()
  const { pg, request, ok, as, submitted } = env
  try {
    const [linked, , unknown] = await env.approved([link(1), link(2), link(3)])
    await pg.query('UPDATE purchase_items SET estimated_unit_price = NULL WHERE id = $1', [unknown])
    await create(env, { amount: 50000, itemIds: [linked] })
    const voided = await create(env, { amount: 9000 })
    await ok(request('POST', `/expenses/${voided.id}/void`, { version: 1, reason: '중복' }))
    await create(env, { eventId: 'e2', amount: 7000 })
    as('p')
    await submitted([link(4)])
    as('n')
    const { finance, expenses, truncated } = await financeOf(env)
    // 가짜 생성기의 품목은 수량 2, 예상 단가 11,590원이다.
    assert.deepEqual([finance.budget, finance.spent, finance.planned, finance.plannedUnknown, finance.remaining], [null, 50000, 23180, 1, null])
    assert.deepEqual([finance.expenseCount, finance.missingEvidence, finance.pendingRequests, finance.unrecordedItems], [1, 1, 1, 2])
    assert.deepEqual([finance.settled, finance.version, finance.history], [null, 0, []])
    // 목록은 이 행사의 지출만 주고, 취소한 것도 "취소됨"으로 준다.
    assert.deepEqual(expenses.map(expense => `${expense.amount}:${expense.voided !== null}`).sort(), ['50000:false', '9000:true'])
    assert.equal(truncated, false)
    as('x')
    assert.equal((await request('GET', '/events/e/finance')).status, 403)
    as(null)
    assert.equal((await request('GET', '/events/e/finance')).status, 401)
    as('f')
    for (const id of ['ex', 'missing', 'x'.repeat(65)]) assert.equal((await request('GET', `/events/${id}/finance`)).status, 404, id)
  } finally { await pg.close() }
})

test('예산: 재정 권한자만 정하고, 미정으로 되돌릴 수 있으며, 버전이 맞아야 한다. 바뀐 값만 기록하고 남은 예산은 음수가 될 수 있다', async () => {
  const env = await setupPurchases()
  const { pg, request, ok, as } = env
  try {
    as('f')
    await create(env, { amount: 50000 })
    const path = '/events/e/finance/budget'
    for (const user of ['p', 'n', 'x']) {
      as(user)
      assert.equal((await request('POST', path, { version: 0, budget: 1 })).status, 403, user)
    }
    as(null)
    assert.equal((await request('POST', path, { version: 0, budget: 1 })).status, 401)
    as('l')
    const first = (await ok<EventFinanceResponse>(request('POST', path, { version: 0, budget: 30000 }))).finance
    assert.deepEqual([first.budget, first.remaining, first.version], [30000, -20000, 1])
    await refused(request('POST', path, { version: 0, budget: 1 }), 409, 'VERSION_CONFLICT')
    const cleared = (await ok<EventFinanceResponse>(request('POST', path, { version: 1, budget: null }))).finance
    assert.deepEqual([cleared.budget, cleared.remaining, cleared.version], [null, null, 2])
    // 같은 값이면 버전과 기록을 그대로 둔다.
    const same = (await ok<EventFinanceResponse>(request('POST', path, { version: 2, budget: null }))).finance
    assert.equal(same.version, 2)
    assert.deepEqual(same.history.map(entry => [entry.action, entry.actor.name, entry.changes, entry.reason]),
      [['budget_set', '회장', { from: null, to: 30000 }, null], ['budget_set', '회장', { from: 30000, to: null }, null]])
    for (const id of ['ex', 'missing', 'x'.repeat(65)]) {
      assert.equal((await request('POST', `/events/${id}/finance/budget`, { version: 0, budget: 1 })).status, 404, id)
    }
    // 행이 없는 행사에 미정을 보내면 아무것도 만들지 않는다.
    const untouched = (await ok<EventFinanceResponse>(request('POST', '/events/e2/finance/budget', { version: 0, budget: null }))).finance
    assert.deepEqual([untouched.version, untouched.history], [0, []])
  } finally { await pg.close() }
})

test('정산: 증빙 누락·검토 대기 요청·지출로 기록하지 않은 승인 품목이 남으면 거절하고, 다 채우면 닫아 그때 숫자를 남긴다', async () => {
  const env = await setupPurchases()
  const { pg, request, ok, as, submitted } = env
  try {
    const [bought] = await env.approved([link(1)])
    as('p')
    const [waiting] = await submitted([link(2)])
    as('f')
    const expense = await create(env, { amount: 50000 })
    const settle = (version = 0) => request('POST', '/events/e/finance/settle', { version })
    await refused(settle(), 409, 'NOT_READY_TO_SETTLE', '셋 다 남음')
    await pg.exec(readyReceipt(expense.id))
    await refused(settle(), 409, 'NOT_READY_TO_SETTLE', '대기·미기록 남음')
    await ok(request('POST', '/purchase-review/decisions',
      { decisions: [{ id: waiting!.id, version: waiting!.version, decision: 'rejected', reason: '필요 없음' }] }))
    await refused(settle(), 409, 'NOT_READY_TO_SETTLE', '미기록 남음')
    await ok(request('PATCH', `/expenses/${expense.id}`, { ...body({ amount: 50000, itemIds: [bought] }), version: expense.version }))
    as('p')
    assert.equal((await settle()).status, 403)
    as('f')
    const settled = (await ok<EventFinanceResponse>(settle())).finance
    assert.deepEqual([settled.settled?.by.name, settled.version, settled.missingEvidence, settled.pendingRequests, settled.unrecordedItems],
      ['재정', 1, 0, 0, 0])
    assert.deepEqual(settled.history.map(entry => [entry.action, entry.changes]), [['settled', { budget: null, spent: 50000, expenseCount: 1 }]])
    await refused(settle(1), 409, 'INVALID_STATE')
    await refused(request('POST', '/events/e/finance/budget', { version: 1, budget: 1000 }), 409, 'EVENT_SETTLED')
  } finally { await pg.close() }
})

test('다시 열기: 재정 권한자가 사유를 적어야 하고, 정산 전이면 거절한다. 열면 잠금이 풀리고 기록이 남는다', async () => {
  const env = await setupPurchases()
  const { pg, request, ok, as } = env
  try {
    as('f')
    // 지출·품목이 없으면 바로 정산된다.
    await ok(request('POST', '/events/e/finance/settle', { version: 0 }))
    const reopen = (payload: unknown) => request('POST', '/events/e/finance/reopen', payload)
    assert.equal((await reopen({ version: 1 })).status, 400)
    assert.equal((await reopen({ version: 1, reason: ' ' })).status, 400)
    as('n')
    assert.equal((await reopen({ version: 1, reason: '영수증 빠짐' })).status, 403)
    as('f')
    const opened = (await ok<EventFinanceResponse>(reopen({ version: 1, reason: ' 영수증 빠짐 ' }))).finance
    assert.deepEqual([opened.settled, opened.version], [null, 2])
    assert.deepEqual(opened.history.map(entry => [entry.action, entry.reason]), [['settled', null], ['reopened', '영수증 빠짐']])
    await refused(reopen({ version: 2, reason: '다시' }), 409, 'INVALID_STATE')
    await create(env)
  } finally { await pg.close() }
})

test('재정 탭의 지출은 이 행사 것만 결제일 최근 순으로 300개까지 주고, 숫자는 전체로 센다', async () => {
  const env = await setupPurchases()
  const { pg, as } = env
  try {
    await pg.exec(`INSERT INTO expenses (id,organization_id,event_id,vendor,description,amount,paid_on,method,payer_id,recorded_by)
      SELECT 'bulk-' || n, 'a', 'e', '가게', '다과', 1000, DATE '2026-01-01' + n, 'cash', 'f', 'f' FROM generate_series(1, 301) AS n;
      INSERT INTO expenses (id,organization_id,event_id,vendor,description,amount,paid_on,method,payer_id,recorded_by)
      VALUES ('other','a','e2','가게','축제',5,'2026-12-31','cash','f','f');`)
    as('n')
    const { finance, expenses, truncated } = await financeOf(env)
    assert.deepEqual([expenses.length, truncated, expenses[0]!.id, finance.spent, finance.expenseCount], [300, true, 'bulk-301', 301000, 301])
  } finally { await pg.close() }
})
