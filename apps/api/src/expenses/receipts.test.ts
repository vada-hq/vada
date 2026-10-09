import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { ExpenseResponse, ReceiptUploadResponse } from '@vada/contracts'
import { setupPurchases } from '../purchases/test-setup.js'

type Env = Awaited<ReturnType<typeof setupPurchases>>
const upload = { fileName: '영수증 1.jpg', contentType: 'image/jpeg', size: 1234, kind: 'receipt' }
async function expense(env: Env) {
  env.as('f')
  return (await env.ok<ExpenseResponse>(env.request('POST', '/expenses', { eventId: null, vendor: '다이소', description: '다과', amount: 12000,
    paidOn: '2026-10-09', method: 'council_card', payerMembershipId: 'mf', note: null, itemIds: [] }), 201)).expense
}
const readyReceipts = (expenseId: string, count: number) => `INSERT INTO expense_receipts
  (id,organization_id,expense_id,object_key,file_name,content_type,size_bytes,kind,status,uploaded_by,confirmed_at)
  SELECT 'r' || n, 'a', '${expenseId}', 'receipts/a/${expenseId}/r' || n, '영수증.jpg', 'image/jpeg', 1234, 'receipt', 'ready', 'f', now()
  FROM generate_series(1, ${count}) AS n`

test('영수증: 서명 주소로 올리고 확인하면 증빙 완료가 되고, 확인 전에는 보이지 않으며, 구성원 누구나 파일을 연다', async () => {
  const env = await setupPurchases()
  const { pg, request, ok, as, storage } = env
  try {
    const { id } = await expense(env)
    const path = `/expenses/${id}/receipts`
    const started = await ok<ReceiptUploadResponse>(request('POST', path, upload), 201)
    const key = `receipts/a/${id}/${started.receiptId}`
    assert.deepEqual([started.upload.url, started.upload.headers], [`https://r2.test/${key}`, { 'Content-Type': 'image/jpeg' }])
    assert.ok(Date.parse(started.expiresAt) > Date.now())
    assert.deepEqual((await ok<ExpenseResponse>(request('GET', `/expenses/${id}`))).expense.receipts, [])
    storage!.put(key, 1234, 'image/jpeg')
    const confirmed = (await ok<ExpenseResponse>(request('POST', `${path}/${started.receiptId}/confirm`, {}))).expense
    assert.deepEqual([confirmed.evidence, confirmed.receiptCount, confirmed.receipts.map(receipt => receipt.fileName)], ['complete', 1, ['영수증 1.jpg']])
    const last = confirmed.history.at(-1)!
    assert.deepEqual([last.action, last.changes], ['receipt_added', { fileName: '영수증 1.jpg', kind: 'receipt' }])
    // 같은 확인을 다시 보내도 한 번만 기록한다.
    const again = (await ok<ExpenseResponse>(request('POST', `${path}/${started.receiptId}/confirm`, {}))).expense
    assert.equal(again.history.length, confirmed.history.length)
    as('n')
    const file = await request('GET', `${path}/${started.receiptId}/file`)
    assert.deepEqual([file.status, file.headers.get('Location'), file.headers.get('Cache-Control')], [302, `https://r2.test/${key}?signed=1`, 'no-store'])
  } finally { await pg.close() }
})

test('확인할 때 파일이 없거나 크기·형식이 다르면 파일과 행을 지우고 거절한다. 형식의 매개변수는 무시한다', async () => {
  const env = await setupPurchases()
  const { pg, request, ok, storage } = env
  try {
    const { id } = await expense(env)
    const path = `/expenses/${id}/receipts`
    const cases: [{ size: number; contentType: string } | null, string][] = [
      [null, '파일 없음'], [{ size: 999, contentType: 'image/jpeg' }, '크기 다름'], [{ size: 1234, contentType: 'image/png' }, '형식 다름']]
    for (const [stored, label] of cases) {
      const started = await ok<ReceiptUploadResponse>(request('POST', path, upload), 201)
      const key = `receipts/a/${id}/${started.receiptId}`
      if (stored) storage!.put(key, stored.size, stored.contentType)
      const response = await request('POST', `${path}/${started.receiptId}/confirm`, {})
      assert.equal(response.status, 400, label)
      assert.deepEqual(await response.json(), { error: 'UPLOAD_MISMATCH' }, label)
      assert.ok(storage!.removed.includes(key), label)
      assert.equal((await pg.query(`SELECT id FROM expense_receipts WHERE id = '${started.receiptId}'`)).rows.length, 0, label)
    }
    const started = await ok<ReceiptUploadResponse>(request('POST', path, upload), 201)
    storage!.put(`receipts/a/${id}/${started.receiptId}`, 1234, 'image/jpeg; charset=binary')
    assert.equal((await request('POST', `${path}/${started.receiptId}/confirm`, {})).status, 200)
  } finally { await pg.close() }
})

test('영수증은 지출당 10개까지이고, 삭제하면 기록을 남기고 파일을 지우며, 취소한 지출에는 올리거나 지울 수 없다', async () => {
  const env = await setupPurchases()
  const { pg, request, ok, storage } = env
  try {
    const { id } = await expense(env)
    const path = `/expenses/${id}/receipts`
    await pg.exec(readyReceipts(id, 10))
    const full = await request('POST', path, upload)
    assert.equal(full.status, 409)
    assert.deepEqual(await full.json(), { error: 'RECEIPT_LIMIT' })
    const removed = (await ok<ExpenseResponse>(request('POST', `${path}/r1/delete`, {}))).expense
    assert.equal(removed.receiptCount, 9)
    assert.deepEqual([removed.history.at(-1)?.action, removed.history.at(-1)?.changes], ['receipt_removed', { fileName: '영수증.jpg', kind: 'receipt' }])
    assert.ok(storage!.removed.includes(`receipts/a/${id}/r1`))
    assert.equal((await request('POST', `${path}/r1/delete`, {})).status, 404)
    await ok(request('POST', `/expenses/${id}/void`, { version: removed.version, reason: '잘못 기록' }))
    for (const response of [await request('POST', path, upload), await request('POST', `${path}/r2/delete`, {})]) {
      assert.equal(response.status, 409)
      assert.deepEqual(await response.json(), { error: 'INVALID_STATE' })
    }
  } finally { await pg.close() }
})

test('권한·경계: 재정이 아니면 올리거나 지우지 못하지만 파일은 연다. 다른 학생회와 없는 영수증은 없는 것으로 본다', async () => {
  const env = await setupPurchases()
  const { pg, request, as } = env
  try {
    const { id } = await expense(env)
    const path = `/expenses/${id}/receipts`
    await pg.exec(readyReceipts(id, 1))
    as('p')
    assert.equal((await request('POST', path, upload)).status, 403)
    assert.equal((await request('POST', `${path}/r1/delete`, {})).status, 403)
    assert.equal((await request('GET', `${path}/r1/file`)).status, 302)
    as('x')
    assert.equal((await request('GET', `${path}/r1/file`)).status, 403)
    as(null)
    assert.equal((await request('GET', `${path}/r1/file`)).status, 401)
    as('f')
    for (const response of [await request('GET', `${path}/missing/file`), await request('POST', `${path}/missing/confirm`, {}),
      await request('POST', '/expenses/missing/receipts', upload), await request('GET', `${path}/${'x'.repeat(65)}/file`)]) {
      assert.equal(response.status, 404)
    }
    assert.equal((await request('POST', path, { ...upload, contentType: 'image/gif' })).status, 400)
  } finally { await pg.close() }
})

test('저장소가 없으면 지출은 기록하지만 영수증 올리기·보기는 503이다', async () => {
  const env = await setupPurchases(undefined, { storage: null })
  const { pg, request } = env
  try {
    const { id } = await expense(env)
    const started = await request('POST', `/expenses/${id}/receipts`, upload)
    assert.equal(started.status, 503)
    assert.deepEqual(await started.json(), { error: 'STORAGE_NOT_CONFIGURED' })
    await pg.exec(readyReceipts(id, 1))
    assert.equal((await request('GET', `/expenses/${id}/receipts/r1/file`)).status, 503)
  } finally { await pg.close() }
})
