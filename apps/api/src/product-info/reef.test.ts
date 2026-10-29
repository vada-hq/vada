import assert from 'node:assert/strict'
import { test } from 'node:test'
import { coupangProductOf } from './coupang-url.js'
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
    diag: { status: 200, attempts: 1 },
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
      imageUrl: null,
      inStock: true,
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
    { outcome: 'other', diag: { code: 'no_rows', status: 200, attempts: 1 } },
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

const failure =
  (code: string, status: number, retryable: unknown = false) =>
  () =>
    Response.json(
      {
        ok: false,
        data: null,
        meta: {},
        error: { code, message: 'secret detail', retryable },
      },
      { status },
    )

test('ReefAPI 실패: NOT_FOUND는 not_found, 차단·시간 초과·크레딧·인증·그 밖의 오류는 각 결과 종류다', async () => {
  const cases: [() => Response | Promise<Response>, string, string, number | null, number][] = [
    [failure('NOT_FOUND', 404), 'not_found', 'NOT_FOUND', 404, 1],
    [failure('TARGET_BLOCKED', 502), 'blocked', 'TARGET_BLOCKED', 502, 2],
    [failure('UPSTREAM_TIMEOUT', 504), 'timeout', 'UPSTREAM_TIMEOUT', 504, 1],
    [failure('QUOTA_EXCEEDED', 402), 'quota', 'QUOTA_EXCEEDED', 402, 1],
    [failure('AUTH_FAILED', 401), 'auth', 'AUTH_FAILED', 401, 1],
    [failure('PARSE_ERROR', 502), 'other', 'PARSE_ERROR', 502, 2],
    [failure('RATE_LIMITED', 429), 'other', 'RATE_LIMITED', 429, 1],
    [failure('DISABLED', 503), 'other', 'DISABLED', 503, 1],
    [failure('INTERNAL', 500), 'other', 'INTERNAL', 500, 2],
    [failure('UPSTREAM_HTTP', 502), 'other', 'UPSTREAM_HTTP', 502, 2],
    [failure('__proto__', 500), 'other', 'unknown', 500, 1],
    [failure('A'.repeat(33), 500), 'other', 'unknown', 500, 1],
    // 모양이 다른 응답
    [() => new Response('<html>blocked</html>', { status: 200 }), 'other', 'non_json', 200, 1],
    [() => Response.json(null), 'other', 'bad_shape', 200, 1],
    [
      () => Response.json({ ok: true, data: { items: [{ name: 1 }] } }),
      'other',
      'bad_shape',
      200,
      1,
    ],
    [
      () => Response.json({ ok: true, data: { item: null, items: [] } }),
      'other',
      'no_rows',
      200,
      1,
    ],
    [() => Response.json(reefProduct(), { status: 500 }), 'other', 'http_error', 500, 1],
    // 연결 실패
    [() => Promise.reject(new TypeError('fetch failed')), 'other', 'network', null, 1],
  ]
  for (const [respond, outcome, code, status, attempts] of cases) {
    const reef = fakeReef(respond)
    const result = await createReefLookup({ apiKey: 'k', fetcher: reef.fetch })(
      productOf('https://www.coupang.com/vp/products/100'),
    )
    assert.equal(result.outcome, outcome, code)
    assert.deepEqual(result.diag, { code, status, attempts }, code)
    assert.equal(reef.calls.length, attempts, code)
  }
})

test('일시 오류는 한 번만 재시도하고 두 호출이 같은 시간 제한 신호를 쓴다', async () => {
  for (const code of ['DISABLED', 'TEMPORARY_FAILURE']) {
    const signals: AbortSignal[] = []
    const reef = fakeReef(signal => {
      signals.push(signal)
      return signals.length === 1 ? failure(code, 503, true)() : Response.json(reefProduct())
    })
    const result = await createReefLookup({ apiKey: 'k', fetcher: reef.fetch })(
      productOf('https://www.coupang.com/vp/products/100'),
    )
    assert.equal(result.outcome, 'ok')
    assert.deepEqual(result.diag, { status: 200, attempts: 2 })
    assert.equal(reef.calls.length, 2)
    assert.equal(signals[0], signals[1])
  }
})

test('두 번 실패하면 마지막 시도의 코드와 HTTP 상태만 남긴다', async () => {
  const reef = fakeReef(() =>
    failure(reef.calls.length === 1 ? 'INTERNAL' : 'TEMPORARY_FAILURE', 503, true)(),
  )
  const result = await createReefLookup({ apiKey: 'k', fetcher: reef.fetch })(
    productOf('https://www.coupang.com/vp/products/100'),
  )
  assert.equal(result.outcome, 'other')
  assert.deepEqual(result.diag, { code: 'TEMPORARY_FAILURE', status: 503, attempts: 2 })
  assert.equal(reef.calls.length, 2)
})

test('RATE_LIMITED는 retryable이어도 재시도하지 않고, 잘못된 retryable은 버린다', async () => {
  for (const [code, retryable] of [
    ['RATE_LIMITED', true],
    ['DISABLED', 'true'],
  ] as const) {
    const reef = fakeReef(failure(code, 429, retryable))
    const result = await createReefLookup({ apiKey: 'k', fetcher: reef.fetch })(
      productOf('https://www.coupang.com/vp/products/100'),
    )
    assert.equal(result.outcome, 'other')
    assert.deepEqual(result.diag, { code, status: 429, attempts: 1 })
    assert.equal(reef.calls.length, 1)
  }
})

test('남은 시간이 3초 미만이면 다시 부르지 않고 3초면 재시도한다', async () => {
  for (const [elapsed, attempts] of [
    [8000, 1],
    [7000, 2],
  ]) {
    let time = 0
    const reef = fakeReef(() => {
      time = elapsed!
      return failure('INTERNAL', 500, true)()
    })
    const result = await createReefLookup({ apiKey: 'k', fetcher: reef.fetch, now: () => time })(
      productOf('https://www.coupang.com/vp/products/100'),
    )
    assert.deepEqual(result.diag, { code: 'INTERNAL', status: 500, attempts })
    assert.equal(reef.calls.length, attempts)
  }
})

test('재시도에서 응답 없이 끊기면 앞 시도의 HTTP 상태를 남기지 않는다', async () => {
  const reef = fakeReef(() => {
    if (reef.calls.length === 1) return failure('INTERNAL', 500)()
    return Promise.reject(new TypeError('secret network detail'))
  })
  const result = await createReefLookup({ apiKey: 'k', fetcher: reef.fetch })(
    productOf('https://www.coupang.com/vp/products/100'),
  )
  assert.deepEqual(result, {
    outcome: 'other',
    diag: { code: 'network', status: null, attempts: 2 },
  })
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
  assert.deepEqual(result, {
    outcome: 'timeout',
    diag: { code: 'timeout', status: null, attempts: 1 },
  })
  assert.equal(reef.calls.length, 1)
})

test('첫 시도가 전체 10초 신호를 다 쓰면 재시도 없이 timeout이다', async t => {
  const controller = new AbortController()
  const timeout = t.mock.method(AbortSignal, 'timeout', () => controller.signal)
  const reef = fakeReef(signal => {
    controller.abort(new DOMException('secret timeout detail', 'TimeoutError'))
    return Promise.reject(signal.reason as Error)
  })
  const result = await createReefLookup({ apiKey: 'k', fetcher: reef.fetch })(
    productOf('https://www.coupang.com/vp/products/100'),
  )
  assert.deepEqual(
    timeout.mock.calls.map(call => call.arguments),
    [[10_000]],
  )
  assert.deepEqual(result, {
    outcome: 'timeout',
    diag: { code: 'timeout', status: null, attempts: 1 },
  })
  assert.equal(reef.calls.length, 1)
})

test('본문을 읽다가 시간 제한에 걸리면 마지막 HTTP 상태와 timeout을 남긴다', async t => {
  const controller = new AbortController()
  t.mock.method(AbortSignal, 'timeout', () => controller.signal)
  const reef = fakeReef(
    signal =>
      new Response(
        new ReadableStream({
          pull(stream) {
            controller.abort(new DOMException('secret timeout detail', 'TimeoutError'))
            stream.error(signal.reason)
          },
        }),
        { status: 200 },
      ),
  )
  const result = await createReefLookup({ apiKey: 'k', fetcher: reef.fetch })(
    productOf('https://www.coupang.com/vp/products/100'),
  )
  assert.deepEqual(result, {
    outcome: 'timeout',
    diag: { code: 'timeout', status: 200, attempts: 1 },
  })
  assert.equal(reef.calls.length, 1)
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
  assert.deepEqual(result, {
    outcome: 'other',
    diag: { code: 'too_large', status: 200, attempts: 1 },
  })
  assert.equal(reef.calls.length, 1)
  assert.ok(sent <= 7, `끊은 뒤 더 읽지 않는다 (${sent})`)
  const declared = fakeReef(
    () => new Response('{}', { headers: { 'content-length': String(6 * 1024 * 1024) } }),
  )
  assert.deepEqual(
    await createReefLookup({ apiKey: 'k', fetcher: declared.fetch })(
      productOf('https://www.coupang.com/vp/products/100'),
    ),
    { outcome: 'other', diag: { code: 'too_large', status: 200, attempts: 1 } },
  )
})

test('키 설정: REEF_API_KEY가 없거나 비면 null이라 불러오기만 꺼진다', () => {
  assert.equal(reefKeyFrom({}), null)
  assert.equal(reefKeyFrom({ REEF_API_KEY: '  ' }), null)
  assert.equal(reefKeyFrom({ REEF_API_KEY: ' key ' }), 'key')
})

test('앞에서 쓴 시간(단축 링크 풀기)은 10초 예산에서 빼고, 남은 시간이 3초 미만이면 다시 부르지 않는다', async () => {
  for (const [spentMs, attempts] of [
    [7500, 1],
    [6000, 2],
  ]) {
    const reef = fakeReef(failure('INTERNAL', 500, true))
    const result = await createReefLookup({ apiKey: 'k', fetcher: reef.fetch, now: () => 0 })(
      productOf('https://www.coupang.com/vp/products/100'),
      spentMs,
    )
    assert.equal(result.diag?.attempts, attempts, String(spentMs))
  }
})
