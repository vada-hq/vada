import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { ProductInfo, ProductInfoResponse, RoomListResponse } from '@vada/contracts'
import { appModulesOf } from '../app-modules.js'
import { createApp } from '../app.js'
import { createTestDb, type TestDb } from '../db/test-db.js'
import { createPurchaseWriteLimiter } from '../purchases/write-limit.js'
import { seedCouncil } from '../test-support/council.js'
import { caller, ORIGIN, testSession } from '../test-support/http.js'
import type { ProductLookup } from './reef.js'

const NOW = new Date('2026-10-25T03:00:00Z')

// 선조회는 메시지 응답 뒤에 DB를 읽고 부른다. 조건이 설 때까지 기다린다.
async function until(done: () => boolean | Promise<boolean>) {
  for (let i = 0; i < 500 && !(await done()); i++)
    await new Promise(resolve => setTimeout(resolve, 10))
  assert.ok(await done())
}
const URL = 'https://www.coupang.com/vp/products/123?itemId=11'
const product: ProductInfo = {
  name: '행사 준비물',
  items: [{ itemId: '11', name: '행사 준비물', price: 1000, listPrice: null }],
  selectedItemId: '11',
  shipping: null,
  deliveryEta: null,
  rocket: false,
}

async function setup(testDb: TestDb, lookup: ProductLookup) {
  const council = await seedCouncil(testDb.db, testDb.pg)
  await seedCouncil(testDb.db, testDb.pg, 'o')
  const modules = appModulesOf(testDb.db, testSession, {
    trustedOrigin: ORIGIN,
    clock: () => NOW,
    writeLimiter: createPurchaseWriteLimiter(),
    receiptKey: 'test-receipt-key',
    productLookup: lookup,
  })
  const api = caller(
    createApp({
      auth: { handler: async () => new Response() },
      trustedOrigin: ORIGIN,
      ...modules,
    }),
  )
  const base = `/api/organizations/${council.councilId}`
  const storedCount = async () =>
    (await testDb.pg.query<{ n: number }>('SELECT count(*)::int AS n FROM product_info')).rows[0]!.n
  const response = await api.get(`${base}/rooms`, 's-president')
  assert.equal(response.status, 200)
  const { rooms } = (await response.json()) as RoomListResponse
  return {
    api,
    storedCount,
    ask: () => api.post(`${base}/product-info`, { url: URL }, 's-president'),
    send: (body: unknown, user: string | undefined = 's-president') =>
      api.post(`${base}/rooms/${rooms[0]!.id}/messages`, body, user),
  }
}

test(
  '느린 상품 선조회가 끝나기 전에도 채팅 저장과 201 응답은 끝나고, 구매 양식 조회는 같은 결과를 쓴다',
  { timeout: 60_000 },
  async t => {
    const testDb = await createTestDb()
    let calls = 0
    let finish: () => void = () => {}
    const pending = new Promise<void>(resolve => (finish = resolve))
    t.after(() => finish())
    try {
      const api = await setup(testDb, async () => {
        calls++
        await pending
        return { outcome: 'ok', product }
      })
      const sent = await api.send({ body: URL })
      assert.equal(sent.status, 201)
      assert.equal(await api.storedCount(), 0)
      await until(() => calls === 1)
      const reading = api.ask()
      finish()
      const response = await reading
      assert.equal(response.status, 200)
      const expected = { product: { ...product, fetchedAt: NOW.toISOString() }, reason: null }
      assert.deepEqual(await response.json(), expected)
      assert.equal(calls, 1, '선조회와 실제 상품 패널/양식 조회는 진행 조회를 공유한다')
      // 보낼 때 불러온 것은 DB에 두고, 그 뒤 읽기는 저장값이다.
      await until(async () => (await api.storedCount()) === 1)
      assert.deepEqual(await (await api.ask()).json(), expected)
      assert.equal(calls, 1)
    } finally {
      finish()
      await testDb.close()
    }
  },
)

test('같은 상품 링크를 다시 보내거나 열어도 저장값을 쓰며 권한 실패·미지원 링크는 선조회하지 않는다', async () => {
  const testDb = await createTestDb()
  const asked: string[] = []
  try {
    const api = await setup(testDb, async wanted => {
      asked.push(wanted.url)
      return { outcome: 'ok', product }
    })
    assert.equal((await api.send({ body: URL }, '')).status, 401)
    assert.equal((await api.send({ body: URL }, 'o-president')).status, 403)
    assert.equal((await api.send({ body: '' })).status, 400)
    assert.equal(
      (await api.send({ body: 'https://coupa.ng/abc https://example.com/' })).status,
      201,
    )
    assert.equal(asked.length, 0)
    assert.equal((await api.send({ body: `${URL}&q=첫검색 ${URL}&q=다른검색` })).status, 201)
    await until(async () => (await api.storedCount()) === 1)
    assert.deepEqual(asked, [URL])
    assert.equal((await api.send({ body: URL })).status, 201)
    assert.equal((await api.ask()).status, 200)
    await new Promise(resolve => setTimeout(resolve, 50))
    assert.deepEqual(asked, [URL])
  } finally {
    await testDb.close()
  }
})

test('상품 선조회 실패는 채팅 성공을 유지하고, 사용자가 다시 열면 조회할 수 있다', async () => {
  const testDb = await createTestDb()
  let calls = 0
  try {
    const api = await setup(testDb, async () => {
      calls++
      return calls === 1 ? { outcome: 'blocked' } : { outcome: 'ok', product }
    })
    assert.equal((await api.send({ body: URL })).status, 201)
    await until(() => calls === 1)
    await new Promise(resolve => setTimeout(resolve, 20))
    // 일시 실패는 저장하지 않으므로 사람이 열면 다시 부른다.
    assert.equal(await api.storedCount(), 0)
    const response = await api.ask()
    assert.equal(response.status, 200)
    assert.equal(((await response.json()) as ProductInfoResponse).reason, null)
    assert.equal(calls, 2)
  } finally {
    await testDb.close()
  }
})
