import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createDeliveryLookup } from './provider.js'
import { createTracking } from './tracking.js'

const parcel = { carrierId: 'kr.coupangls' as const, trackingNumber: '1234567890' }
const lastEvent = {
  time: '2026-10-26T03:00:00Z',
  status: { code: 'IN_TRANSIT', name: '배송 중' },
  description: '이동 중',
}

test('업체에는 택배사·번호만 보내고 마지막 사건만 읽는다', async () => {
  const lookup = createDeliveryLookup({
    apiKey: 'client:secret',
    fetcher: async (url, init) => {
      assert.equal(url, 'https://apis.tracker.delivery/graphql')
      assert.equal(new Headers(init?.headers).get('authorization'), 'TRACKQL-API-KEY client:secret')
      assert.equal(typeof init?.body, 'string')
      const body = JSON.parse(init?.body as string) as { query: string; variables: unknown }
      assert.deepEqual(body.variables, parcel)
      assert.doesNotMatch(body.query, /sender|recipient|from\s*\{|to\s*\{|events\s*\(/i)
      assert.equal(init?.redirect, 'error')
      return Response.json({ data: { track: { lastEvent, sender: 'PRIVATE' } } })
    },
  })
  assert.deepEqual(await lookup(parcel), { lastEvent, reason: null })
})

test('업체 실패·모양 다름·사건 없음·시간 초과는 정해진 reason만 준다', async () => {
  for (const [body, reason] of [
    [{ errors: [{ message: parcel.trackingNumber }] }, 'provider_failed'],
    [{ data: { track: { lastEvent: { ...lastEvent, time: 'bad' } } } }, 'invalid_response'],
    [{ data: { track: { lastEvent: null } } }, 'not_found'],
  ] as const) {
    const lookup = createDeliveryLookup({ apiKey: 'key', fetcher: async () => Response.json(body) })
    assert.deepEqual(await lookup(parcel), { lastEvent: null, reason })
  }
  const failed = createDeliveryLookup({
    apiKey: 'key',
    fetcher: async () => {
      throw new Error(parcel.trackingNumber)
    },
  })
  assert.deepEqual(await failed(parcel), { lastEvent: null, reason: 'provider_failed' })
  const timeout = createDeliveryLookup({
    apiKey: 'key',
    timeoutMs: 1,
    fetcher: async (_url, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener(
          'abort',
          () => reject(new DOMException('timeout', 'TimeoutError')),
          { once: true },
        )
        setTimeout(() => {}, 10)
      }),
  })
  assert.deepEqual(await timeout(parcel), { lastEvent: null, reason: 'timeout' })
})

test('성공만 10분 캐시하고 다른 택배사는 별개이며 키가 없어도 링크를 준다', async () => {
  let now = new Date('2026-10-26T00:00:00Z')
  let calls = 0
  const track = createTracking({
    clock: () => now,
    lookup: async () => {
      calls++
      return { lastEvent, reason: null }
    },
  })
  assert.deepEqual(await track(parcel), await track(parcel))
  assert.equal(calls, 1)
  now = new Date(now.getTime() + 600_000)
  await track(parcel)
  await track({ ...parcel, carrierId: 'kr.hanjin' })
  assert.equal(calls, 3)
  const disabled = await createTracking({})(parcel)
  assert.equal(disabled.reason, 'not_configured')
  assert.match(disabled.trackingUrl, /^https:\/\/.*coupangls\.com/)
  const failures = createTracking({
    lookup: async () => {
      calls++
      throw new Error('PRIVATE')
    },
  })
  for (let i = 0; i < 2; i++) assert.equal((await failures(parcel)).reason, 'provider_failed')
  assert.equal(calls, 5)
})

test('본문을 읽는 중의 시간 초과도 timeout이며 큰 응답·깨진 JSON·HTTP 실패는 원문을 버린다', async () => {
  const timeout = createDeliveryLookup({
    apiKey: 'key',
    timeoutMs: 1,
    fetcher: async (_url, init) =>
      new Response(
        new ReadableStream({
          start(controller) {
            init?.signal?.addEventListener(
              'abort',
              () => controller.error(new DOMException('PRIVATE', 'AbortError')),
              { once: true },
            )
            setTimeout(() => {}, 10)
          },
        }),
      ),
  })
  assert.deepEqual(await timeout(parcel), { lastEvent: null, reason: 'timeout' })
  for (const response of [new Response('bad-json'), new Response('x'.repeat(65_537))])
    assert.deepEqual(
      await createDeliveryLookup({ apiKey: 'key', fetcher: async () => response })(parcel),
      { lastEvent: null, reason: 'invalid_response' },
    )
  assert.deepEqual(
    await createDeliveryLookup({
      apiKey: 'key',
      fetcher: async () => new Response('PRIVATE', { status: 503 }),
    })(parcel),
    { lastEvent: null, reason: 'provider_failed' },
  )
})
