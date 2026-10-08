import assert from 'node:assert/strict'
import { test } from 'node:test'
import { COUPANG_LINKS_PER_MESSAGE_MAX, normalizeCoupangUrl, parseCoupangLinks, readCoupangUrl } from './coupang.js'

const url = (n: number) => `https://www.coupang.com/vp/products/${n}?itemId=${n + 1}&vendorItemId=${n + 2}`

test('쿠팡 상품 주소를 www 상품 주소로 정규화하고 itemId·vendorItemId만 남긴다', () => {
  for (const raw of ['https://www.coupang.com/vp/products/10?itemId=11&vendorItemId=12',
    'https://coupang.com/vp/products/10/?vendorItemId=12&itemId=11&src=1032&q=x',
    'https://m.coupang.com/vm/products/10?itemId=11&vendorItemId=12&isAddedCart=']) {
    assert.deepEqual(readCoupangUrl(raw), { url: url(10), productId: '10', itemId: '11', vendorItemId: '12' }, raw)
  }
  assert.equal(normalizeCoupangUrl('5', null, '7'), 'https://www.coupang.com/vp/products/5?vendorItemId=7')
  assert.deepEqual(readCoupangUrl('https://www.coupang.com/vp/products/5'),
    { url: 'https://www.coupang.com/vp/products/5', productId: '5', itemId: null, vendorItemId: null })
})

test('옵션 값이 숫자가 아니거나 두 번 있으면 버리고, 상품 주소가 아니면 링크로 보지 않는다', () => {
  assert.deepEqual(readCoupangUrl('https://www.coupang.com/vp/products/5?itemId=a&vendorItemId=1&vendorItemId=2'),
    { url: 'https://www.coupang.com/vp/products/5', productId: '5', itemId: null, vendorItemId: null })
  for (const raw of ['http://www.coupang.com/vp/products/5', 'https://link.coupang.com/a/bVaRjX', 'https://example.com/vp/products/5',
    'https://www.coupang.com/vp/products/abc', `https://www.coupang.com/vp/products/${'1'.repeat(21)}`,
    'https://www.coupang.com:8443/vp/products/5', 'https://m.coupang.com/vp/products/5', 'https://www.coupang.com/vm/products/5',
    'https://user@www.coupang.com/vp/products/5', 'not a url']) {
    assert.equal(readCoupangUrl(raw), null, raw)
  }
})

test('메시지에서 링크를 순서대로 찾고, 끝 문장 부호와 이어 쓴 한글을 떼며, 10개까지만 받는다', () => {
  const text = `이거 어때? (${url(1)}). 그리고 ${url(4)}이거도\nhttps://link.coupang.com/a/x https://example.com`
  const links = parseCoupangLinks(text)
  assert.deepEqual(links.map(link => link.productId), ['1', '4'])
  for (const link of links) assert.equal(text.slice(link.start, link.end), link.url)
  const many = Array.from({ length: COUPANG_LINKS_PER_MESSAGE_MAX + 2 }, (_, index) => url(index * 10 + 10)).join(' ')
  assert.equal(parseCoupangLinks(many).length, COUPANG_LINKS_PER_MESSAGE_MAX)
  assert.deepEqual(parseCoupangLinks('링크 없음'), [])
})
