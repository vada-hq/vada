import assert from 'node:assert/strict'
import { test } from 'node:test'
import { isStrictObject } from './input.js'
import { ProductInfoSchema } from './product-info.js'
import { PURCHASE_ITEM_LINK_MAX } from './purchases.js'

test('상품 정보 요청: http·https 주소를 다듬어 받고, 빈 값·공백만·javascript:·상한+1·NUL·서러게이트·모르는 키는 거절한다', () => {
  const url = 'https://www.coupang.com/vp/products/123'
  assert.deepEqual(ProductInfoSchema.parse({ url: ` ${url} ` }), { url })
  assert.equal(
    ProductInfoSchema.safeParse({ url: 'http://coupang.com/vp/products/1' }).success,
    true,
  )
  const longest = `https://a.test/${'a'.repeat(PURCHASE_ITEM_LINK_MAX - 'https://a.test/'.length)}`
  assert.equal(ProductInfoSchema.safeParse({ url: longest }).success, true)
  // 상한은 코드 포인트로 센다(품목 링크 칸의 DB char_length와 같다).
  const emoji = (count: number) => `https://a.test/${'😀'.repeat(count - 'https://a.test/'.length)}`
  assert.equal(ProductInfoSchema.safeParse({ url: emoji(PURCHASE_ITEM_LINK_MAX) }).success, true)
  for (const value of [
    {},
    { url: '' },
    { url: '   ' },
    { url: 'javascript:alert(1)' },
    { url: `${longest}a` },
    { url: emoji(PURCHASE_ITEM_LINK_MAX + 1) },
    { url: 'https://a.test/\u0000' },
    { url: 'https://a.test/\uD800' },
    { url: 'coupang.com/vp/products/1' },
    { url: null },
    { url, extra: 1 },
  ]) {
    assert.equal(ProductInfoSchema.safeParse(value).success, false, JSON.stringify(value))
  }
  assert.equal(isStrictObject(ProductInfoSchema), true)
})
