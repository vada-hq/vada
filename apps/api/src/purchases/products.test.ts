import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createReefFetcher, lookupFor, lookupWarnings, matchItem, readItem, SELLER_WARNING } from './products.js'

const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } })
const raw = (overrides: Record<string, unknown> = {}) => ({ product_id: '1', item_id: '2', vendor_item_id: '3', name: '테이블, 화이트', currency: 'KRW',
  price: 11590, list_price: 15000, discount_percent: 22.7, in_stock: true, delivery_eta: '내일(금) 도착 보장',
  image: 'https://thumbnail6.coupangcdn.com/a.jpg', ...overrides })

test('상품 ID만 보내 옵션 전체를 받고, 다른 상품의 옵션은 버린다', async () => {
  let sent: RequestInit | undefined
  const fetchProduct = createReefFetcher('test-key', async (url, init) => {
    assert.equal(url, 'https://api.reefapi.com/coupang/v1/product')
    sent = init
    return json({ ok: true, data: { items: [raw(), raw({ item_id: '4', vendor_item_id: '5', name: '테이블, 블랙' }), raw({ product_id: '9' })] } })
  })
  const result = await fetchProduct('1')
  assert.deepEqual(JSON.parse(String(sent?.body)), { product_id: '1' })
  assert.equal(sent?.redirect, 'error')
  assert.ok(result.ok)
  assert.deepEqual(result.items.map(item => item.vendorItemId), ['3', '5'])
  assert.deepEqual(result.items[0], { itemId: '2', vendorItemId: '3', name: '테이블, 화이트', price: 11590, listPrice: 15000, discountPercent: 23,
    inStock: true, deliveryEta: '내일(금) 도착 보장', imageUrl: 'https://thumbnail6.coupangcdn.com/a.jpg' })
})

test('이상한 응답 값은 버리거나 자르고, 이미지는 쿠팡 이미지 서버의 https 주소만 받는다', async () => {
  assert.equal(readItem(raw({ name: '  ' }), '1'), null)
  assert.equal(readItem(raw({ name: '이름\u0000' }), '1'), null)
  assert.equal(readItem(raw({ product_id: '2' }), '1'), null)
  assert.equal(readItem([], '1'), null)
  const odd = readItem(raw({ name: '가'.repeat(600), price: '11590', list_price: -1, discount_percent: 150, in_stock: 'yes',
    delivery_eta: 'x'.repeat(101), image: 'http://thumbnail.coupangcdn.com/a.jpg', item_id: '2a', vendor_item_id: 3 }), '1')!
  assert.equal([...odd.name].length, 500)
  assert.deepEqual([odd.price, odd.listPrice, odd.discountPercent, odd.inStock, odd.itemId, odd.vendorItemId, odd.imageUrl],
    [null, null, null, null, null, null, null])
  assert.equal(odd.deliveryEta?.length, 100)
  for (const image of ['https://evil.test/a.jpg', 'https://coupangcdn.com.evil.test/a.jpg', 'https://user@image.coupangcdn.com/a.jpg', 'not a url']) {
    assert.equal(readItem(raw({ image }), '1')!.imageUrl, null, image)
  }
  assert.equal(readItem(raw({ currency: 'USD' }), '1')!.price, null)
  const many = await createReefFetcher('k', async () => json({ ok: true,
    data: { items: Array.from({ length: 150 }, (_, index) => raw({ vendor_item_id: String(index + 10) })) } }))('1')
  assert.ok(many.ok && many.items.length === 100)
})

test('실패는 다시 시도할 것과 멈출 것으로 나누고, 원문을 남기지 않는다', async () => {
  // 서비스가 HTTP 오류로 답하면 상태 번호를 같이 둔다. 키·크레딧 문제(401·402·403)를 로그에서 알아보게 한다.
  const cases: [typeof fetch, string, boolean, number?][] = [
    [async () => json({ ok: false, error: { code: 'NOT_FOUND' } }, 404), 'NOT_FOUND', false],
    [async () => json({ ok: false, error: { code: 'RATE_LIMITED' } }, 429), 'RATE_LIMITED', true],
    [async () => json({ ok: false, error: { code: 'TARGET_BLOCKED' } }, 502), 'UPSTREAM', true, 502],
    [async () => json({ ok: false, error: { code: 'NO_CREDITS-secret' } }, 402), 'UPSTREAM', true, 402],
    [async () => new Response('busy', { status: 503 }), 'UPSTREAM', true, 503],
    [async () => json({ ok: false }), 'UPSTREAM', true],
    [async () => { throw new Error('network-secret') }, 'UPSTREAM', true],
    [async () => { throw new DOMException('slow', 'TimeoutError') }, 'TIMEOUT', true],
    [async () => json({ ok: true, data: {} }), 'INVALID_RESPONSE', false],
    [async () => json({ ok: true, data: { items: [] } }), 'NOT_FOUND', false],
  ]
  for (const [fetcher, code, retryable, status] of cases) {
    const result = await createReefFetcher('test-key', fetcher)('1')
    assert.deepEqual(result, { ok: false, code, retryable, ...(status ? { status } : {}) }, code)
    assert.ok(!JSON.stringify(result).includes('secret'))
  }
  const never: typeof fetch = async () => { throw new Error('must not call') }
  assert.deepEqual(await createReefFetcher('', never)('1'), { ok: false, code: 'NOT_CONFIGURED', retryable: false })
  assert.deepEqual(await createReefFetcher('k', never)('1a'), { ok: false, code: 'NOT_FOUND', retryable: false })
})

test('링크의 옵션은 판매자 → 옵션 순서로 맞추고, 못 맞추면 옵션을 모르는 것으로 본다', () => {
  const items = [readItem(raw(), '1')!, readItem(raw({ item_id: '4', vendor_item_id: '5', price: null }), '1')!]
  assert.equal(matchItem(items, { itemId: '2', vendorItemId: '3' }).item?.vendorItemId, '3')
  assert.deepEqual(matchItem(items, { itemId: '2', vendorItemId: '9' }), { item: items[0], warning: SELLER_WARNING })
  assert.deepEqual(matchItem(items, { itemId: '2', vendorItemId: null }), { item: items[0], warning: null })
  assert.deepEqual(matchItem(items, { itemId: '8', vendorItemId: '9' }), { item: null, warning: null })
  const ready = { status: 'ready' as const, items, fetchedAt: new Date('2026-10-09T00:00:00Z'), errorCode: null }
  const found = lookupFor(ready, { productId: '1', itemId: '2', vendorItemId: '3' })
  assert.deepEqual([found.name, found.price, found.warning, found.snapshot?.price, found.snapshot?.vendorItemId, found.fetchedAt],
    ['테이블, 화이트', 11590, null, 11590, '3', ready.fetchedAt])
  assert.equal(lookupFor(ready, { productId: '1', itemId: '4', vendorItemId: '5' }).warning, lookupWarnings.noPrice)
  assert.equal(lookupFor(ready, { productId: '1', itemId: null, vendorItemId: null }).warning, lookupWarnings.noOption)
  assert.equal(lookupFor(ready, { productId: '1', itemId: '8', vendorItemId: '9' }).warning, lookupWarnings.noMatch)
  const link = { productId: '1', itemId: '2', vendorItemId: '3' }
  assert.equal(lookupFor({ ...ready, status: 'failed', errorCode: 'NOT_FOUND' }, link).warning, lookupWarnings.failed)
  assert.equal(lookupFor({ ...ready, status: 'failed', errorCode: 'NOT_CONFIGURED' }, link).warning, lookupWarnings.notConfigured)
  assert.deepEqual([lookupFor(undefined, link).price, lookupFor(undefined, link).snapshot], [null, null])
})
