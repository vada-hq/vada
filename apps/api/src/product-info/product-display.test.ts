import assert from 'node:assert/strict'
import { test } from 'node:test'
import { fakeReef, reefItem, reefProduct } from '../test-support/reef.js'
import { coupangProductOf } from './coupang-url.js'
import { createReefLookup } from './reef.js'
import { createProductInfo } from './service.js'

const url = 'https://www.coupang.com/vp/products/100'

test('상품 사진·재고는 고른 판매 단위에서 읽고 모르는 값은 null이다', async () => {
  const item = {
    ...reefItem(),
    image: 'https://thumbnail.coupangcdn.com/image.jpg',
    in_stock: false,
  }
  const reef = fakeReef(() => Response.json(reefProduct({ item, items: [item] })))
  const result = await createReefLookup({ apiKey: 'k', fetcher: reef.fetch })(
    coupangProductOf(url)!,
  )
  assert.equal(result.outcome, 'ok')
  if (result.outcome !== 'ok') return
  assert.equal(result.product.imageUrl, item.image)
  assert.equal(result.product.inStock, false)
})

test('사진 주소가 http·외부 호스트면 사진만 버리고 상품 조회는 성공한다', async () => {
  for (const image of [
    'http://thumbnail.coupangcdn.com/x',
    'https://example.com/x',
    'javascript:alert(1)',
  ]) {
    const item = { ...reefItem(), image, in_stock: undefined }
    const reef = fakeReef(() => Response.json(reefProduct({ item, items: [item] })))
    const result = await createReefLookup({ apiKey: 'k', fetcher: reef.fetch })(
      coupangProductOf(url)!,
    )
    assert.equal(result.outcome === 'ok' && result.product.imageUrl, null)
    assert.equal(result.outcome === 'ok' && result.product.inStock, null)
  }
})

test('캐시 적중은 실제 조회 시각을 바꾸거나 외부 요청을 늘리지 않는다', async t => {
  t.mock.method(console, 'log', () => {})
  let now = new Date('2026-10-27T01:00:00Z')
  const item = reefItem()
  const reef = fakeReef(() => Response.json(reefProduct({ item, items: [item] })))
  const productInfo = createProductInfo({
    lookup: createReefLookup({ apiKey: 'k', fetcher: reef.fetch }),
    clock: () => now,
  })
  const first = await productInfo(url)
  now = new Date('2026-10-27T01:05:00Z')
  assert.deepEqual(await productInfo(url), first)
  assert.equal(first.product?.fetchedAt, '2026-10-27T01:00:00.000Z')
  assert.equal(reef.calls.length, 1)
})
