import assert from 'node:assert/strict'
import { test } from 'node:test'
import { coupangProductOf } from './coupang-url.js'

test('쿠팡 상품 주소: 상품 번호와 숫자인 itemId·vendorItemId만 남겨 www 주소로 맞춘다', () => {
  const cases: [string, string, string | null, string | null][] = [
    [
      'https://www.coupang.com/vp/products/7334523?itemId=18698271&vendorItemId=85839281&q=펜&searchId=abc&sourceType=srp',
      'https://www.coupang.com/vp/products/7334523?itemId=18698271&vendorItemId=85839281',
      '18698271',
      '85839281',
    ],
    [
      'http://coupang.com/vp/products/7334523',
      'https://www.coupang.com/vp/products/7334523',
      null,
      null,
    ],
    [
      'https://m.coupang.com/vm/products/7334523/?vendorItemId=85839281&itemId=x1',
      'https://www.coupang.com/vp/products/7334523?vendorItemId=85839281',
      null,
      '85839281',
    ],
    [
      'https://WWW.Coupang.com/vp/products/7334523#reviews',
      'https://www.coupang.com/vp/products/7334523',
      null,
      null,
    ],
  ]
  for (const [given, url, itemId, vendorItemId] of cases)
    assert.deepEqual(coupangProductOf(given), { url, itemId, vendorItemId }, given)
})

test('쿠팡 상품 주소가 아니면 null이다: 단축 주소, 다른 쇼핑몰, 다른 경로, 섞인 호스트·경로, 포트·계정', () => {
  for (const url of [
    'https://link.coupang.com/a/bXyZ12',
    'https://coupa.ng/abc',
    'https://smartstore.naver.com/shop/products/123',
    'https://www.coupang.com/np/search?q=펜',
    'https://www.coupang.com/vp/products/abc',
    'https://www.coupang.com/vp/products/',
    'https://www.coupang.com/vp/products/123/reviews',
    'https://m.coupang.com/vp/products/123',
    'https://www.coupang.com/vm/products/123',
    'https://www.coupang.com.evil.test/vp/products/123',
    'https://evilcoupang.com/vp/products/123',
    'https://www.coupang.com:8443/vp/products/123',
    'https://user:pass@www.coupang.com/vp/products/123',
    'ftp://www.coupang.com/vp/products/123',
    'not a url',
  ])
    assert.equal(coupangProductOf(url), null, url)
})
