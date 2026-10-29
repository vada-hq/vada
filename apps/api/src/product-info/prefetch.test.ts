import assert from 'node:assert/strict'
import { test } from 'node:test'
import { PURCHASE_ITEMS_MAX, type ProductInfoResponse } from '@vada/contracts'
import { createProductPrefetch } from './prefetch.js'
import { createProductInfo } from './service.js'

const missing: ProductInfoResponse = { product: null, reason: 'not_found' }
const url = (id: number) => `https://www.coupang.com/vp/products/${id}`

test('같은 링크 파싱과 주소 정규화를 써서 지원 쿠팡 주소만 한 번씩 준비한다', async () => {
  const calls: string[] = []
  const prefetch = createProductPrefetch(async link => {
    calls.push(link)
    return missing
  })
  await prefetch(`준비물 (https://m.coupang.com/vm/products/1?itemId=2&q=secret).
    https://www.coupang.com/vp/products/1?itemId=2&q=other
    https://coupa.ng/a https://www.coupang.com.evil/vp/products/1
    https://www.coupang.com:444/vp/products/1 https://example.com/`)
  assert.deepEqual(calls, [`${url(1)}?itemId=2`])
})

test('조회는 한 번에 하나이며 중복과 대기 품목 상한을 넘는 링크를 쌓지 않는다', async () => {
  const calls: string[] = []
  let finish: () => void = () => {}
  const slow = new Promise<void>(resolve => (finish = resolve))
  let active = 0
  let maximum = 0
  const prefetch = createProductPrefetch(async link => {
    calls.push(link)
    active++
    maximum = Math.max(maximum, active)
    await slow
    active--
    return missing
  })
  const working = prefetch(
    Array.from({ length: PURCHASE_ITEMS_MAX + 5 }, (_, i) => url(i + 1)).join(' '),
  )
  await Promise.resolve()
  assert.equal(calls.length, 1)
  const same = prefetch(`${url(1)} ${url(1)} ${url(100)} ${url(101)}`)
  assert.equal(calls.length, 1)
  finish()
  await Promise.all([working, same])
  assert.equal(maximum, 1)
  assert.equal(calls.length, PURCHASE_ITEMS_MAX + 1)
  assert.equal(new Set(calls).size, calls.length)
  assert.equal(calls.at(-1), url(100))
})

test('조회 예외를 밖으로 던지지 않고 다음 상품과 다음 메시지는 계속 준비한다', async () => {
  const calls: string[] = []
  const prefetch = createProductPrefetch(async link => {
    calls.push(link)
    if (link === url(1)) throw new Error('외부 조회 실패')
    return missing
  })
  await prefetch(`${url(1)} ${url(2)}`)
  await prefetch(url(3))
  await prefetch(null)
  assert.deepEqual(calls, [url(1), url(2), url(3)])
})

test('마지막 조회가 끝나는 microtask 사이에 새 메시지가 와도 대기 상품을 놓치지 않는다', async () => {
  const calls: string[] = []
  const prefetch = createProductPrefetch(async link => {
    calls.push(link)
    return missing
  })
  const first = prefetch(url(1))
  await Promise.resolve()
  await Promise.resolve()
  await prefetch(url(2))
  await first
  assert.deepEqual(calls, [url(1), url(2)])
})

test('선조회와 직접 조회는 기존 하루 150회 상한·다음 한국 날짜 초기화를 공유한다', async t => {
  t.mock.method(console, 'log', () => {})
  t.mock.method(console, 'warn', () => {})
  let now = new Date('2026-10-25T14:59:00Z')
  const calls: string[] = []
  const read = createProductInfo({
    clock: () => now,
    lookup: async wanted => {
      calls.push(wanted.url)
      return { outcome: 'not_found' }
    },
  })
  const prefetch = createProductPrefetch(read)
  await prefetch(url(1))
  for (let id = 2; id <= 150; id++) await read(url(id))
  await prefetch(url(151))
  assert.deepEqual(await read(url(151)), { product: null, reason: 'unavailable' })
  assert.equal(calls.length, 150)
  now = new Date('2026-10-25T15:00:00Z')
  await prefetch(url(151))
  assert.equal(calls.length, 151)
})

test('쿠팡 앱 공유 단축 링크도 코드만 남긴 주소로 한 번씩 준비한다', async () => {
  const calls: string[] = []
  const prefetch = createProductPrefetch(async link => {
    calls.push(link)
    return missing
  })
  await prefetch(`https://link.coupang.com/a/bXyZ12?lptag=a https://link.coupang.com/a/bXyZ12
    http://link.coupang.com/a/other https://link.coupang.com.evil/a/x`)
  assert.deepEqual(calls, ['https://link.coupang.com/a/bXyZ12'])
})
