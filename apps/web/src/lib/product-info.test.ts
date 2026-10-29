import { afterEach, expect, test, vi } from 'vitest'
import { json, mockApi } from '@/test-support/mock-api'
import { readProductInfo } from './product-info'

const BASE = '/api/organizations/c1/product-info'
const LINK = 'https://www.coupang.com/vp/products/100'

afterEach(() => vi.unstubAllGlobals())

test.each(['unsupported', 'not_found', 'unavailable'] as const)(
  '상품이 없으면 서버 까닭 %s를 그대로 옮긴다',
  async reason => {
    const api = mockApi()
    api.on('POST', BASE, () => json({ product: null, reason }))
    expect(await readProductInfo('c1', LINK)).toEqual({ kind: 'none', reason })
    api.assertNoUnexpectedRequests()
  },
)

test.each([
  () => json({ product: null, reason: null }),
  () => json({ error: 'RATE_LIMITED' }, 429),
  () => Promise.reject(new TypeError('fetch failed')),
])('요청 실패나 까닭 없는 빈 상품은 unavailable이다', async respond => {
  const api = mockApi()
  api.on('POST', BASE, respond)
  expect(await readProductInfo('c1', LINK)).toEqual({ kind: 'none', reason: 'unavailable' })
  api.assertNoUnexpectedRequests()
})

test('불러온 상품은 ready로 옮긴다', async () => {
  const api = mockApi()
  const product = {
    name: '펜',
    selectedItemId: '11',
    items: [{ itemId: '11', name: '펜', price: 1000, listPrice: null }],
    shipping: null,
    deliveryEta: null,
    rocket: false,
  }
  api.on('POST', BASE, () => json({ product, reason: null }))
  expect(await readProductInfo('c1', LINK)).toEqual({ kind: 'ready', product })
})
