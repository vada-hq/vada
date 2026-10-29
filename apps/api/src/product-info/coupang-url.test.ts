import assert from 'node:assert/strict'
import { test } from 'node:test'
import { coupangProductOf, coupangShortLinkOf } from './coupang-url.js'

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

test('쿠팡 앱 공유 단축 링크: https://link.coupang.com/a/<코드>만 받아 코드만 남긴 주소로 맞춘다', () => {
  const cases: [string, string][] = [
    ['https://link.coupang.com/a/bXyZ12', 'https://link.coupang.com/a/bXyZ12'],
    ['https://LINK.Coupang.com/a/bXyZ12/', 'https://link.coupang.com/a/bXyZ12'],
    ['https://link.coupang.com/a/c_Q-9?lptag=x&subid=y#z', 'https://link.coupang.com/a/c_Q-9'],
  ]
  for (const [given, url] of cases) assert.equal(coupangShortLinkOf(given), url, given)
})

test('단축 링크가 아니면 null이다: http, 다른 호스트·끝점·포트·계정, 다른 경로, 이상한 코드', () => {
  for (const url of [
    'http://link.coupang.com/a/bXyZ12',
    'https://link.coupang.com./a/bXyZ12',
    'https://link.coupang.com:443x/a/bXyZ12',
    'https://link.coupang.com:8443/a/bXyZ12',
    'https://user@link.coupang.com/a/bXyZ12',
    'https://link.coupang.com@evil.test/a/bXyZ12',
    'https://link.coupang.com.evil.test/a/bXyZ12',
    'https://evil.test/a/bXyZ12?link.coupang.com',
    'https://xn--lnk-coupang-v9a.com/a/bXyZ12',
    'https://coupa.ng/abc',
    'https://link.coupang.com/re/AFFSDP?lptag=x',
    'https://link.coupang.com/a/',
    'https://link.coupang.com/a/bX/yZ',
    'https://link.coupang.com/a/%2e%2e',
    'https://link.coupang.com/a/b%40evil',
    `https://link.coupang.com/a/${'a'.repeat(65)}`,
    'https://www.coupang.com/vp/products/123',
    'not a url',
  ])
    assert.equal(coupangShortLinkOf(url), null, url)
})
