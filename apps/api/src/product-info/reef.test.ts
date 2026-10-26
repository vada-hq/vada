import assert from 'node:assert/strict'
import { test } from 'node:test'
import { coupangProductOf } from '@vada/contracts'
import { createReefLookup, reefKeyFrom } from './reef.js'
import { fakeReef, reefItem, reefProduct } from '../test-support/reef.js'

const productOf = (url: string) => coupangProductOf(url)!

test('ReefAPI 부르기: 정규화한 주소 하나만 본문에 넣고 x-api-key를 붙여 상품 엔드포인트에 POST한다', async () => {
  const reef = fakeReef(() => Response.json(reefProduct()))
  const lookup = createReefLookup({ apiKey: 'test-key', fetcher: reef.fetch })
  await lookup(productOf('https://www.coupang.com/vp/products/100?itemId=11&q=펜&searchId=s'))
  assert.equal(reef.calls.length, 1)
  const [call] = reef.calls
  assert.equal(call!.url, 'https://api.reefapi.com/coupang/v1/product')
  assert.equal(call!.method, 'POST')
  assert.equal(call!.headers.get('x-api-key'), 'test-key')
  assert.equal(call!.headers.get('content-type'), 'application/json')
  assert.deepEqual(JSON.parse(call!.body), {
    product_id: 'https://www.coupang.com/vp/products/100?itemId=11',
  })
})

test('ReefAPI 부르기: 판매 단위 목록을 옮기고 주소의 itemId와 같은 줄을 고른다', async () => {
  const items = [
    reefItem({
      item_id: '11',
      vendor_item_id: '91',
      name: '펜 검정',
      price: 1000,
      list_price: 1200,
    }),
    reefItem({
      item_id: '12',
      vendor_item_id: '92',
      name: '펜 빨강',
      price: 1100,
      list_price: null,
    }),
  ]
  const reef = fakeReef(() =>
    Response.json(reefProduct({ item: items[0], items, shipping: '무료배송' })),
  )
  const lookup = createReefLookup({ apiKey: 'k', fetcher: reef.fetch })
  const byItem = await lookup(productOf('https://www.coupang.com/vp/products/100?itemId=12'))
  assert.deepEqual(byItem, {
    outcome: 'ok',
    product: {
      name: '펜 빨강',
      items: [
        { itemId: '11', name: '펜 검정', price: 1000, listPrice: 1200 },
        { itemId: '12', name: '펜 빨강', price: 1100, listPrice: null },
      ],
      selectedItemId: '12',
      shipping: '무료배송',
      deliveryEta: '내일(토) 도착 보장',
      rocket: true,
    },
  })
  const byVendor = await lookup(
    productOf('https://www.coupang.com/vp/products/100?vendorItemId=92'),
  )
  assert.equal(byVendor.outcome === 'ok' && byVendor.product.selectedItemId, '12')
  // 주소에 판매 단위가 없거나 맞는 줄이 없으면 쿠팡이 맨 앞에 둔 것(data.item)이다.
  for (const url of [
    'https://www.coupang.com/vp/products/100',
    'https://www.coupang.com/vp/products/100?itemId=99',
  ]) {
    const result = await lookup(productOf(url))
    assert.equal(result.outcome === 'ok' && result.product.selectedItemId, '11', url)
  }
})

test('ReefAPI 부르기: 모양이 틀린 줄만 버리고 나머지로 ok다. item이 틀리면 목록 맨 앞을 고른다', async () => {
  const items = Array.from({ length: 41 }, (_, index) =>
    reefItem({ item_id: String(index + 1), name: index === 5 ? '' : `펜 ${index + 1}` }),
  )
  const reef = fakeReef(() =>
    Response.json(reefProduct({ item: reefItem({ item_id: '1', name: '' }), items })),
  )
  const result = await createReefLookup({ apiKey: 'k', fetcher: reef.fetch })(
    productOf('https://www.coupang.com/vp/products/100'),
  )
  assert.equal(result.outcome, 'ok')
  if (result.outcome !== 'ok') return
  assert.equal(result.product.items.length, 40)
  assert.ok(!result.product.items.some(item => item.itemId === '6'))
  assert.equal(result.product.selectedItemId, '1')
  const none = fakeReef(() =>
    Response.json(reefProduct({ item: reefItem({ name: '' }), items: [reefItem({ name: '' })] })),
  )
  assert.deepEqual(
    await createReefLookup({ apiKey: 'k', fetcher: none.fetch })(
      productOf('https://www.coupang.com/vp/products/100'),
    ),
    { outcome: 'other' },
  )
})

test('ReefAPI 부르기: data.item이 목록에 없는 판매 단위면 고른 것은 목록 맨 앞이다', async () => {
  const reef = fakeReef(() =>
    Response.json(
      reefProduct({
        item: reefItem({ item_id: '99', name: '목록 밖' }),
        items: [reefItem({ item_id: '11', name: '펜 검정' }), reefItem({ item_id: '12' })],
      }),
    ),
  )
  const result = await createReefLookup({ apiKey: 'k', fetcher: reef.fetch })(
    productOf('https://www.coupang.com/vp/products/100'),
  )
  assert.equal(result.outcome === 'ok' && result.product.selectedItemId, '11')
  assert.equal(result.outcome === 'ok' && result.product.name, '펜 검정')
})

test('ReefAPI 부르기: 숫자 id도 글자로 받고, items가 비면 data.item 하나를 목록으로 둔다', async () => {
  const only = reefItem({ item_id: 11, vendor_item_id: 91, name: '공책' })
  const reef = fakeReef(() => Response.json(reefProduct({ item: only, items: [] })))
  const result = await createReefLookup({ apiKey: 'k', fetcher: reef.fetch })(
    productOf('https://www.coupang.com/vp/products/100'),
  )
  assert.equal(result.outcome, 'ok')
  assert.deepEqual(result.outcome === 'ok' && result.product.items.map(item => item.itemId), ['11'])
})

const failure = (code: string, status: number) => () =>
  Response.json(
    {
      ok: false,
      data: null,
      meta: {},
      error: { code, message: 'secret detail', retryable: false },
    },
    { status },
  )

test('ReefAPI 실패: NOT_FOUND는 not_found, 차단·시간 초과·크레딧·인증·그 밖의 오류는 각 결과 종류다', async () => {
  const cases: [() => Response | Promise<Response>, string][] = [
    [failure('NOT_FOUND', 404), 'not_found'],
    [failure('TARGET_BLOCKED', 502), 'blocked'],
    [failure('UPSTREAM_TIMEOUT', 504), 'timeout'],
    [failure('QUOTA_EXCEEDED', 402), 'quota'],
    [failure('AUTH_FAILED', 401), 'auth'],
    [failure('PARSE_ERROR', 502), 'other'],
    [failure('RATE_LIMITED', 429), 'other'],
    [failure('DISABLED', 503), 'other'],
    [failure('INTERNAL', 500), 'other'],
    [failure('__proto__', 500), 'other'],
    // 모양이 다른 응답
    [() => new Response('<html>blocked</html>', { status: 200 }), 'other'],
    [() => Response.json({ ok: true, data: { items: [{ name: 1 }] } }), 'other'],
    [() => Response.json({ ok: true, data: { item: null, items: [] } }), 'other'],
    [() => Response.json(reefProduct(), { status: 500 }), 'other'],
    // 연결 실패
    [() => Promise.reject(new TypeError('fetch failed')), 'other'],
  ]
  for (const [respond, outcome] of cases) {
    const reef = fakeReef(respond)
    const result = await createReefLookup({ apiKey: 'k', fetcher: reef.fetch })(
      productOf('https://www.coupang.com/vp/products/100'),
    )
    assert.deepEqual(result, { outcome }, outcome)
    assert.equal(reef.calls.length, 1, `${outcome}: 다시 시도하지 않는다`)
  }
})

test('ReefAPI 시간 제한: 응답이 늦으면 끊고 timeout이다', async () => {
  // 신호를 따르는 가짜다. 실제 fetch처럼 신호가 끊으면 TimeoutError로 거절한다.
  const reef = fakeReef(
    (signal: AbortSignal) =>
      new Promise<Response>((_resolve, reject) =>
        signal.addEventListener('abort', () => reject(signal.reason as Error)),
      ),
  )
  // AbortSignal.timeout의 타이머는 프로세스를 붙잡지 않아, 기다리는 동안 시험이 먼저 끝나지 않게 붙잡아 둔다.
  const keepAlive = setTimeout(() => {}, 5000)
  const result = await createReefLookup({ apiKey: 'k', fetcher: reef.fetch, timeoutMs: 20 })(
    productOf('https://www.coupang.com/vp/products/100'),
  )
  clearTimeout(keepAlive)
  assert.deepEqual(result, { outcome: 'timeout' })
})

test('ReefAPI 응답 크기: 5MB를 넘으면 읽다가 끊고 other다', async () => {
  const big = new Uint8Array(1024 * 1024)
  let sent = 0
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      sent++
      controller.enqueue(big)
      if (sent > 10) controller.close()
    },
  })
  const reef = fakeReef(() => new Response(stream, { status: 200 }))
  const result = await createReefLookup({ apiKey: 'k', fetcher: reef.fetch })(
    productOf('https://www.coupang.com/vp/products/100'),
  )
  assert.deepEqual(result, { outcome: 'other' })
  assert.ok(sent <= 7, `끊은 뒤 더 읽지 않는다 (${sent})`)
  const declared = fakeReef(
    () => new Response('{}', { headers: { 'content-length': String(6 * 1024 * 1024) } }),
  )
  assert.deepEqual(
    await createReefLookup({ apiKey: 'k', fetcher: declared.fetch })(
      productOf('https://www.coupang.com/vp/products/100'),
    ),
    { outcome: 'other' },
  )
})

test('키 설정: REEF_API_KEY가 없거나 비면 null이라 불러오기만 꺼진다', () => {
  assert.equal(reefKeyFrom({}), null)
  assert.equal(reefKeyFrom({ REEF_API_KEY: '  ' }), null)
  assert.equal(reefKeyFrom({ REEF_API_KEY: ' key ' }), 'key')
})
