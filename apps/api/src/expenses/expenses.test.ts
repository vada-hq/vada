import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { ExpenseResponse, ExpensesResponse, LinkableItemsResponse } from '@vada/contracts'
import { generated, link, setupPurchases } from '../purchases/test-setup.js'

type Env = Awaited<ReturnType<typeof setupPurchases>>
const body = (overrides: Record<string, unknown> = {}) => ({ eventId: 'e', vendor: '쿠팡', description: '체육대회 물품', amount: 46000,
  paidOn: '2026-10-09', method: 'council_card', payerMembershipId: 'mf', note: null, itemIds: [] as string[], budgetLineId: null, ...overrides })
// 기획(p)이 담아 제출하고 재정(f)이 승인한 품목. 끝나면 재정으로 남는다.
async function approved(env: Env, links: string[], event = 'e') {
  // 다른 행사방에는 e의 메시지가 없으므로 근거 없이 만든다.
  env.state.generate = async input => ({ items: input.links.map(url => generated(url, { sourceMessageIds: [] })) })
  env.as('p')
  const items = await env.submitted(links, event)
  env.as('f')
  await env.ok(env.request('POST', '/purchase-review/decisions', { decisions: items.map(item => ({ id: item.id, version: item.version, decision: 'approved' })) }))
  return items.map(item => item.id)
}
const create = async (env: Env, overrides: Record<string, unknown> = {}) =>
  (await env.ok<ExpenseResponse>(env.request('POST', '/expenses', body(overrides)), 201)).expense
const quoted = (ids: string[]) => ids.map(id => `'${id}'`).join(',')

test('지출 기록: 재정 권한자만 기록하고, 승인 품목을 연결하면 구매함으로 표시하며, 승인 금액을 계산한다', async () => {
  const env = await setupPurchases()
  const { pg, request, as } = env
  try {
    const itemIds = await approved(env, [link(1), link(2)])
    for (const user of ['p', 'n', 'x']) {
      as(user)
      assert.equal((await request('POST', '/expenses', body({ itemIds }))).status, 403, user)
    }
    as(null)
    assert.equal((await request('POST', '/expenses', body({ itemIds }))).status, 401)
    as('f')
    const expense = await create(env, { itemIds, vendor: ' 쿠팡 ' })
    assert.deepEqual([expense.vendor, expense.amount, expense.method, expense.payer, expense.recordedBy, expense.event],
      ['쿠팡', 46000, 'council_card', { id: 'f', name: '재정' }, { id: 'f', name: '재정' }, { id: 'e', name: '체육대회' }])
    assert.equal(expense.payerMembershipId, 'mf')
    assert.deepEqual(expense.items.map(item => item.id).sort(), [...itemIds].sort())
    // 가짜 생성기의 품목은 수량 2, 예상 단가 11,590원이다.
    assert.equal(expense.approvedTotal, 46360)
    assert.deepEqual([expense.evidence, expense.receiptCount, expense.voided, expense.version], ['missing', 0, null, 1])
    assert.deepEqual(expense.history.map(entry => [entry.action, entry.actor.name]), [['created', '재정']])
    const bought = (await pg.query<{ purchased_by: string | null }>(`SELECT purchased_by FROM purchase_items WHERE id IN (${quoted(itemIds)})`)).rows
    assert.deepEqual(bought.map(row => row.purchased_by), ['f', 'f'])
    assert.equal((await pg.query("SELECT id FROM purchase_item_events WHERE action = 'purchased'")).rows.length, 2)
    // 회장단도 기록한다. 상시 운영 지출은 품목 없이 기록한다.
    as('l')
    assert.equal((await request('POST', '/expenses', body({ eventId: null, vendor: '다이소', payerMembershipId: 'ml' }))).status, 201)
    assert.equal((await request('POST', '/expenses', { ...body(), amount: -1 })).status, 400)
  } finally { await pg.close() }
})

test('연결 규칙: 승인 전 품목·다른 행사 품목·이미 연결된 품목·상시 운영의 품목은 거절하고 아무것도 남기지 않는다', async () => {
  const env = await setupPurchases()
  const { pg, request, as, submitted } = env
  try {
    const [mine] = await approved(env, [link(1)])
    const [other] = await approved(env, [link(2)], 'e2')
    as('p')
    const [waiting] = await submitted([link(3)])
    as('f')
    await create(env, { itemIds: [mine] })
    const reject = async (overrides: Record<string, unknown>, status: number, error: string) => {
      const response = await request('POST', '/expenses', body(overrides))
      assert.equal(response.status, status, JSON.stringify(overrides))
      assert.deepEqual(await response.json(), { error }, JSON.stringify(overrides))
    }
    await reject({ itemIds: [mine] }, 409, 'ITEM_NOT_LINKABLE')
    await reject({ itemIds: [other] }, 409, 'ITEM_NOT_LINKABLE')
    await reject({ itemIds: [waiting!.id] }, 409, 'ITEM_NOT_LINKABLE')
    await reject({ eventId: null, itemIds: [other] }, 409, 'ITEM_NOT_LINKABLE')
    await reject({ itemIds: ['missing'] }, 404, 'NOT_FOUND')
    await reject({ eventId: 'ex' }, 404, 'NOT_FOUND')
    await reject({ eventId: 'missing' }, 404, 'NOT_FOUND')
    await reject({ payerMembershipId: 'mx' }, 400, 'PAYER_NOT_MEMBER')
    assert.equal((await pg.query('SELECT id FROM expenses')).rows.length, 1)
    assert.equal((await pg.query('SELECT purchase_item_id FROM expense_items')).rows.length, 1)
    assert.equal((await pg.query(`SELECT id FROM purchase_items WHERE id = '${waiting!.id}' AND purchased_at IS NULL`)).rows.length, 1)
  } finally { await pg.close() }
})

test('수정: 버전이 맞을 때만 바꾸고, 바뀐 칸과 품목 수를 남기며, 행사를 바꾸면 이전 행사 품목은 연결할 수 없다', async () => {
  const env = await setupPurchases()
  const { pg, request, ok } = env
  try {
    const itemIds = await approved(env, [link(1), link(2)])
    const expense = await create(env, { itemIds })
    const path = `/expenses/${expense.id}`
    const update = (overrides: Record<string, unknown>, version = expense.version) => request('PATCH', path, { ...body(overrides), version })
    const kept = { amount: 47000, payerMembershipId: 'ml', itemIds: [itemIds[0]] }
    const changed = (await ok<ExpenseResponse>(update(kept))).expense
    assert.deepEqual([changed.amount, changed.payer.name, changed.version, changed.items.length], [47000, '회장', 2, 1])
    assert.deepEqual(changed.history.at(-1)?.changes,
      { amount: { from: 46000, to: 47000 }, payer: { from: '재정', to: '회장' }, items: { added: 0, removed: 1 } })
    const stale = await update({ amount: 1 })
    assert.equal(stale.status, 409)
    assert.deepEqual(await stale.json(), { error: 'VERSION_CONFLICT' })
    // 바뀐 것이 없으면 버전과 기록을 그대로 둔다.
    const same = (await ok<ExpenseResponse>(update(kept, 2))).expense
    assert.deepEqual([same.version, same.history.length], [2, 2])
    // 풀린 품목은 다른 지출에 연결할 수 있다.
    assert.equal((await request('POST', '/expenses', body({ itemIds: [itemIds[1]] }))).status, 201)
    const moved = await update({ ...kept, eventId: 'e2' }, 2)
    assert.equal(moved.status, 409)
    assert.deepEqual(await moved.json(), { error: 'ITEM_NOT_LINKABLE' })
    const toEvent = (await ok<ExpenseResponse>(update({ ...kept, eventId: 'e2', itemIds: [] }, 2))).expense
    assert.deepEqual(toEvent.history.at(-1)?.changes, { event: { from: '체육대회', to: '축제' }, items: { added: 0, removed: 1 } })
    for (const id of ['missing', 'x'.repeat(65)]) {
      assert.equal((await request('PATCH', `/expenses/${id}`, { ...body(), version: 1 })).status, 404, id)
    }
  } finally { await pg.close() }
})

test('취소: 사유를 남기고 연결 품목을 풀며, 합계와 증빙 누락에서 빠지고, 다시 취소하거나 고칠 수 없다', async () => {
  const env = await setupPurchases()
  const { pg, request, ok } = env
  try {
    const itemIds = await approved(env, [link(1)])
    const expense = await create(env, { itemIds })
    const voided = (await ok<ExpenseResponse>(request('POST', `/expenses/${expense.id}/void`, { version: 1, reason: ' 중복 기록 ' }))).expense
    assert.deepEqual([voided.voided?.by.name, voided.voided?.reason, voided.items, voided.version], ['재정', '중복 기록', [], 2])
    assert.deepEqual(voided.history.at(-1)?.changes, { reason: '중복 기록', releasedItems: 1 })
    for (const response of [await request('POST', `/expenses/${expense.id}/void`, { version: 2, reason: '다시' }),
      await request('PATCH', `/expenses/${expense.id}`, { ...body(), version: 2 })]) {
      assert.equal(response.status, 409)
      assert.deepEqual(await response.json(), { error: 'INVALID_STATE' })
    }
    const list = await ok<ExpensesResponse>(request('GET', '/expenses'))
    assert.deepEqual(list.totals, { thisMonth: 0, total: 0, missingEvidence: 0 })
    assert.equal(list.expenses[0]!.voided?.reason, '중복 기록')
    // 풀린 품목은 다시 연결할 수 있다. 구매함 표시는 그대로다.
    assert.equal((await request('POST', '/expenses', body({ itemIds }))).status, 201)
  } finally { await pg.close() }
})

test('사용 내역: 구성원 누구나 결제일 최근 순으로 보고, 이번 달(한국 시간)·전체 합계와 증빙 누락을 센다', async () => {
  const env = await setupPurchases()
  const { pg, request, ok, as } = env
  try {
    const dates = (await pg.query<{ today: string; last: string }>(`SELECT
      to_char((now() AT TIME ZONE 'Asia/Seoul')::date, 'YYYY-MM-DD') AS today,
      to_char((date_trunc('month', now() AT TIME ZONE 'Asia/Seoul') - interval '1 day')::date, 'YYYY-MM-DD') AS last`)).rows[0]!
    as('f')
    const recent = await create(env, { eventId: null, vendor: '다이소', amount: 15000, paidOn: dates.today })
    const old = await create(env, { eventId: null, vendor: '인쇄소', amount: 60000, paidOn: dates.last })
    await pg.exec(`INSERT INTO expense_receipts (id,organization_id,expense_id,object_key,file_name,content_type,size_bytes,kind,status,uploaded_by,confirmed_at)
      VALUES ('r1','a','${old.id}','receipts/a/${old.id}/r1','영수증.jpg','image/jpeg',1234,'receipt','ready','f',now()),
             ('r2','a','${recent.id}','receipts/a/${recent.id}/r2','올리는 중.jpg','image/jpeg',1234,'receipt','pending','f',NULL)`)
    as('n')
    const list = await ok<ExpensesResponse>(request('GET', '/expenses'))
    assert.deepEqual(list.expenses.map(expense => expense.id), [recent.id, old.id])
    // 확인 전(pending) 파일은 세지 않는다.
    assert.deepEqual(list.expenses.map(expense => [expense.evidence, expense.receiptCount]), [['missing', 0], ['complete', 1]])
    assert.deepEqual(list.totals, { thisMonth: 15000, total: 75000, missingEvidence: 1 })
    assert.equal(list.truncated, false)
    const detail = (await ok<ExpenseResponse>(request('GET', `/expenses/${old.id}`))).expense
    assert.deepEqual(detail.receipts.map(receipt => [receipt.fileName, receipt.kind, receipt.uploadedBy.name]), [['영수증.jpg', 'receipt', '재정']])
    as('x')
    assert.equal((await request('GET', '/expenses')).status, 403)
    as(null)
    assert.equal((await request('GET', '/expenses')).status, 401)
  } finally { await pg.close() }
})

test('사용 내역은 최근 300개까지 주고 잘렸다고 알린다. 다른 학생회의 지출은 보이지 않는다', async () => {
  const { pg, request, ok, as } = await setupPurchases()
  try {
    await pg.exec(`INSERT INTO expenses (id,organization_id,vendor,description,amount,paid_on,method,payer_id,recorded_by)
      SELECT 'bulk-' || n, 'a', '가게', '다과', 1000, DATE '2026-01-01' + n, 'cash', 'f', 'f' FROM generate_series(1, 301) AS n;
      INSERT INTO expenses (id,organization_id,vendor,description,amount,paid_on,method,payer_id,recorded_by)
      VALUES ('theirs','b','가게','남의 지출',5,'2026-12-31','cash','x','x');`)
    as('f')
    const list = await ok<ExpensesResponse>(request('GET', '/expenses'))
    assert.deepEqual([list.expenses.length, list.truncated, list.expenses[0]!.id, list.totals.total], [300, true, 'bulk-301', 301000])
    for (const id of ['theirs', 'missing', 'x'.repeat(65)]) assert.equal((await request('GET', `/expenses/${id}`)).status, 404, id)
  } finally { await pg.close() }
})
test('연결할 품목 목록은 재정만 보고, 연결 안 된 승인 품목만 행사·요청자와 함께 준다', async () => {
  const env = await setupPurchases()
  const { pg, request, ok, as } = env
  try {
    const [first, second] = await approved(env, [link(1), link(2)])
    await create(env, { itemIds: [first] })
    const list = await ok<LinkableItemsResponse>(request('GET', '/purchase-review/linkable-items'))
    assert.deepEqual(list.items.map(item => [item.id, item.event.name, item.requester.name]), [[second, '체육대회', '기획']])
    assert.equal(list.truncated, false)
    for (const user of ['p', 'n', 'x']) {
      as(user)
      assert.equal((await request('GET', '/purchase-review/linkable-items')).status, 403, user)
    }
  } finally { await pg.close() }
})

test('지출에 연결된 품목은 구매 표시를 취소할 수 없고, 지출을 취소하면 다시 할 수 있다', async () => {
  const env = await setupPurchases()
  const { pg, request, ok } = env
  try {
    const [itemId] = await approved(env, [link(1)])
    const expense = await create(env, { itemIds: [itemId] })
    const version = async () => (await pg.query<{ version: number }>(`SELECT version FROM purchase_items WHERE id = '${itemId}'`)).rows[0]!.version
    const undo = await request('POST', `/purchase-review/${itemId}/purchased`, { version: await version(), purchased: false })
    assert.equal(undo.status, 409)
    assert.deepEqual(await undo.json(), { error: 'LINKED_TO_EXPENSE' })
    await ok(request('POST', `/expenses/${expense.id}/void`, { version: expense.version, reason: '잘못 기록' }))
    await ok(request('POST', `/purchase-review/${itemId}/purchased`, { version: await version(), purchased: false }))
  } finally { await pg.close() }
})

test('운영 항목: 상시 운영 지출은 결제일이 든 기간의 운영 줄만 고르고, 고친 것은 처리 기록에 남는다', async () => {
  const env = await setupPurchases()
  const { pg, ok, request, as } = env
  try {
    await pg.exec(`
      INSERT INTO budget_periods (id,organization_id,name,starts_on,ends_on,created_by) VALUES
        ('pa','a','2026년 2학기','2026-09-01','2027-02-28','f'),('pb','b','B 기간','2026-09-01','2027-02-28','x');
      INSERT INTO budget_lines (id,organization_id,period_id,kind,name,amount,position) VALUES
        ('lm','a','pa','operating','회의비',100000,0),('ls','a','pa','operating','소모품',50000,1),
        ('li','a','pa','income','학생회비',800000,0),('lb','b','pb','operating','남의 항목',1,0);
    `)
    as('f')
    const operating = (overrides: Record<string, unknown> = {}) => ({ eventId: null, vendor: '다이소', description: '회의 다과', amount: 12000,
      paidOn: '2026-10-09', method: 'council_card', payerMembershipId: 'mf', note: null, itemIds: [] as string[], budgetLineId: 'lm', ...overrides })
    const expense = (await ok<ExpenseResponse>(request('POST', '/expenses', operating()), 201)).expense
    assert.deepEqual(expense.budgetLine, { id: 'lm', name: '회의비' })
    for (const [label, overrides] of [['기간 밖 결제일', { paidOn: '2026-08-31' }], ['수입 줄', { budgetLineId: 'li' }],
      ['다른 학생회의 줄', { budgetLineId: 'lb' }], ['없는 줄', { budgetLineId: 'missing' }]] as const) {
      const response = await request('POST', '/expenses', operating(overrides))
      assert.equal(response.status, 409, label)
      assert.deepEqual(await response.json(), { error: 'BUDGET_LINE_INVALID' }, label)
    }
    assert.equal((await request('POST', '/expenses', operating({ eventId: 'e' }))).status, 400)
    const patch = (overrides: Record<string, unknown>, version: number) =>
      request('PATCH', `/expenses/${expense.id}`, { ...operating(overrides), version })
    const moved = (await ok<ExpenseResponse>(patch({ budgetLineId: 'ls' }, 1))).expense
    assert.deepEqual([moved.budgetLine, moved.history.at(-1)!.changes], [{ id: 'ls', name: '소모품' }, { budgetLine: { from: '회의비', to: '소모품' } }])
    // 결제일을 다른 기간으로 옮기면서 옛 항목을 그대로 보내면 막는다.
    assert.equal((await patch({ budgetLineId: 'ls', paidOn: '2027-03-02' }, 2)).status, 409)
    const cleared = (await ok<ExpenseResponse>(patch({ budgetLineId: null }, 2))).expense
    assert.deepEqual([cleared.budgetLine, cleared.history.at(-1)!.changes], [null, { budgetLine: { from: '소모품', to: null } }])
    assert.equal((await ok<ExpensesResponse>(request('GET', '/expenses'))).expenses[0]!.budgetLine, null)
  } finally { await pg.close() }
})
