import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { ExpenseResponse, ExpensesResponse, ReceiptUploadResponse } from '@vada/contracts'
import { link, refs, setupPurchases } from '../purchases/test-setup.js'

type Env = Awaited<ReturnType<typeof setupPurchases>>
const body = (overrides: Record<string, unknown> = {}) => ({ eventId: 'e', vendor: '쿠팡', description: '체육대회 물품', amount: 46000,
  paidOn: '2026-10-09', method: 'council_card', payerMembershipId: 'mf', note: null, itemIds: [] as string[], budgetLineId: null, ...overrides })
const create = async (env: Env, overrides: Record<string, unknown> = {}) =>
  (await env.ok<ExpenseResponse>(env.request('POST', '/expenses', body(overrides)), 201)).expense
// 정산 API 없이 정산된 상태를 만든다.
const settle = (env: Env, event = 'e') => env.pg.query(`INSERT INTO event_finances (event_id,organization_id,settled_at,settled_by)
  VALUES ($1,'a',now(),'f') ON CONFLICT (event_id) DO UPDATE SET settled_at = now(), settled_by = 'f'`, [event])
async function rejected(pending: Response | Promise<Response>, label: string) {
  const response = await pending
  assert.equal(response.status, 409, label)
  assert.deepEqual(await response.json(), { error: 'EVENT_SETTLED' }, label)
}

test('정산된 행사: 지출 기록·수정·옮기기·취소와 증빙 삭제를 막고, 증빙 추가는 받는다. 다른 행사와 상시 운영은 그대로다', async () => {
  const env = await setupPurchases()
  const { pg, request, ok, as, storage } = env
  try {
    as('f')
    const inside = await create(env)
    const elsewhere = await create(env, { eventId: 'e2' })
    await pg.exec(`INSERT INTO expense_receipts (id,organization_id,expense_id,object_key,file_name,content_type,size_bytes,kind,status,uploaded_by,confirmed_at)
      VALUES ('r1','a','${inside.id}','receipts/a/${inside.id}/r1','영수증.jpg','image/jpeg',1234,'receipt','ready','f',now())`)
    await settle(env)
    await rejected(request('POST', '/expenses', body()), '기록')
    await rejected(request('PATCH', `/expenses/${inside.id}`, { ...body({ amount: 1 }), version: inside.version }), '수정')
    await rejected(request('PATCH', `/expenses/${inside.id}`, { ...body({ eventId: 'e2' }), version: inside.version }), '밖으로 옮기기')
    await rejected(request('PATCH', `/expenses/${elsewhere.id}`, { ...body({ eventId: 'e' }), version: elsewhere.version }), '안으로 옮기기')
    await rejected(request('POST', `/expenses/${inside.id}/void`, { version: inside.version, reason: '중복' }), '취소')
    await rejected(request('POST', `/expenses/${inside.id}/receipts/r1/delete`, {}), '증빙 삭제')
    // 정산 뒤에 받은 거래명세서는 더 붙일 수 있다.
    const started = await ok<ReceiptUploadResponse>(request('POST', `/expenses/${inside.id}/receipts`,
      { fileName: '명세서.pdf', contentType: 'application/pdf', size: 10, kind: 'statement' }), 201)
    storage!.put(`receipts/a/${inside.id}/${started.receiptId}`, 10, 'application/pdf')
    const added = (await ok<ExpenseResponse>(request('POST', `/expenses/${inside.id}/receipts/${started.receiptId}/confirm`, {}))).expense
    assert.deepEqual([added.receiptCount, added.settled], [2, true])
    await ok(request('PATCH', `/expenses/${elsewhere.id}`, { ...body({ eventId: 'e2', amount: 1 }), version: elsewhere.version }))
    await create(env, { eventId: null })
    const list = await ok<ExpensesResponse>(request('GET', '/expenses'))
    assert.deepEqual(list.expenses.map(expense => `${expense.event?.id ?? '상시'}:${expense.settled}`).sort(), ['e2:false', 'e:true', '상시:false'])
    assert.deepEqual((await pg.query(`SELECT amount, version FROM expenses WHERE id = '${inside.id}'`)).rows, [{ amount: 46000, version: 1 }])
  } finally { await pg.close() }
})

test('정산된 행사에는 구매 요청을 낼 수 없고, 작성 중 품목은 그대로 남는다', async () => {
  const env = await setupPurchases()
  const { pg, request, drafts } = env
  try {
    const created = await drafts([link(1)])
    await settle(env)
    await rejected(request('POST', '/events/e/purchase-items/submit', { items: refs(created) }), '제출')
    assert.deepEqual((await pg.query(`SELECT status FROM purchase_items WHERE id = '${created[0]!.id}'`)).rows, [{ status: 'draft' }])
  } finally { await pg.close() }
})
