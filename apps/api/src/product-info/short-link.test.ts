import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createShortLinkResolver } from './short-link.js'

const SHORT = 'https://link.coupang.com/a/bXyZ12'
const clock = () => new Date('2026-06-01T03:00:00Z')

type Call = { url: string; init: RequestInit | undefined }

// 가짜 쿠팡 단축 링크 서버. 서버가 보낸 요청을 남기고, 본문을 읽었는지 센다.
function fakeCoupang(respond: (signal: AbortSignal) => Response | Promise<Response>) {
  const calls: Call[] = []
  const fetcher: typeof fetch = async (input, init) => {
    calls.push({ url: input instanceof Request ? input.url : String(input), init })
    return respond(init?.signal ?? new AbortController().signal)
  }
  return { fetch: fetcher, calls }
}

const redirect = (location: string | null, status = 302) => {
  const headers = new Headers()
  if (location !== null) headers.set('location', location)
  return new Response(null, { status, headers })
}

test('단축 링크: 302 한 번의 Location을 쿠팡 상품 주소로 맞추고, 따라가지 않으며 본문을 읽지 않고 버린다', async () => {
  let cancelled = false
  const body = new ReadableStream({
    cancel() {
      cancelled = true
    },
  })
  const coupang = fakeCoupang(
    () =>
      new Response(body, {
        status: 302,
        headers: {
          location:
            'https://www.coupang.com/vp/products/7334523?itemId=12&vendorItemId=34&traceid=abc&q=%ED%8E%9C',
        },
      }),
  )
  const resolve = createShortLinkResolver({ fetcher: coupang.fetch, clock })
  assert.deepEqual(await resolve(SHORT), {
    code: 'ok',
    product: {
      url: 'https://www.coupang.com/vp/products/7334523?itemId=12&vendorItemId=34',
      itemId: '12',
      vendorItemId: '34',
    },
  })
  assert.equal(coupang.calls.length, 1)
  assert.equal(coupang.calls[0]!.url, SHORT)
  assert.equal(coupang.calls[0]!.init?.redirect, 'manual')
  assert.ok(coupang.calls[0]!.init?.signal)
  assert.equal(cancelled, true)
})

test('단축 링크: 301·303·307·308도 같은 한 번의 이동으로 본다', async () => {
  for (const status of [301, 303, 307, 308]) {
    const coupang = fakeCoupang(() => redirect('https://www.coupang.com/vp/products/1', status))
    const resolve = createShortLinkResolver({ fetcher: coupang.fetch, clock })
    assert.equal((await resolve(SHORT)).code, 'ok', String(status))
  }
})

test('단축 링크: Location이 데스크탑 쿠팡 상품 주소가 아니면 bad_location이고 그 주소를 부르지 않는다', async () => {
  for (const location of [
    'https://evil.test/vp/products/1',
    'https://www.coupang.com.evil.test/vp/products/1',
    'https://www.coupang.com./vp/products/1',
    'https://user:pass@www.coupang.com/vp/products/1',
    'https://www.coupang.com@evil.test/vp/products/1',
    'https://www.coupang.com:8443/vp/products/1',
    'http://www.coupang.com/vp/products/1',
    'https://m.coupang.com/vm/products/1',
    'https://xn--coupng-9ua.com/vp/products/1',
    'https://www.coupang.com/np/search?q=%ED%8E%9C',
    '//evil.test/vp/products/1',
    '/vp/products/1',
    'vp/products/1',
    // 다중 홉: 다시 단축 링크로 보내도 따라가지 않는다.
    'https://link.coupang.com/a/other',
    'javascript:alert(1)',
    '',
  ]) {
    const coupang = fakeCoupang(() => redirect(location))
    const resolve = createShortLinkResolver({ fetcher: coupang.fetch, clock })
    const expected = location === '' ? 'no_location' : 'bad_location'
    assert.deepEqual(await resolve(SHORT), { code: expected }, location)
    assert.equal(coupang.calls.length, 1, location)
  }
})

test('단축 링크: Location이 없거나 이동이 아니면 부르지 않고 실패 코드다', async () => {
  for (const [response, code] of [
    [() => redirect(null), 'no_location'],
    [() => new Response('<html>', { status: 200 }), 'bad_status'],
    [() => new Response(null, { status: 404 }), 'bad_status'],
    [() => redirect('https://www.coupang.com/vp/products/1', 304), 'bad_status'],
  ] as const) {
    const coupang = fakeCoupang(response)
    const resolve = createShortLinkResolver({ fetcher: coupang.fetch, clock })
    assert.deepEqual(await resolve(SHORT), { code })
  }
})

test('단축 링크 시간 제한: 응답이 늦으면 끊고 timeout, 연결 실패는 network다', async () => {
  const slow = fakeCoupang(
    signal =>
      new Promise<Response>((_resolve, reject) =>
        signal.addEventListener('abort', () => reject(signal.reason as Error)),
      ),
  )
  // AbortSignal.timeout의 타이머는 프로세스를 붙잡지 않아, 기다리는 동안 시험이 먼저 끝나지 않게 붙잡아 둔다.
  const keepAlive = setTimeout(() => {}, 5000)
  const resolveSlow = createShortLinkResolver({ fetcher: slow.fetch, clock, timeoutMs: 20 })
  assert.deepEqual(await resolveSlow(SHORT), { code: 'timeout' })
  clearTimeout(keepAlive)
  const broken = fakeCoupang(() => Promise.reject(new TypeError('secret network detail')))
  const resolveBroken = createShortLinkResolver({ fetcher: broken.fetch, clock })
  assert.deepEqual(await resolveBroken(SHORT), { code: 'network' })
})

test('단축 링크: 단축 링크 모양이 아니면 부르지 않는다', async () => {
  const coupang = fakeCoupang(() => redirect('https://www.coupang.com/vp/products/1'))
  const resolve = createShortLinkResolver({ fetcher: coupang.fetch, clock })
  for (const url of ['https://evil.test/a/x', 'http://link.coupang.com/a/x', 'https://coupa.ng/x'])
    assert.deepEqual(await resolve(url), { code: 'not_short' }, url)
  assert.equal(coupang.calls.length, 0)
})

test('단축 링크 캐시: 풀린 것은 10분 두고 같은 코드가 동시에 오면 한 번만 부른다. 실패는 두지 않는다', async () => {
  const now = { value: new Date('2026-06-01T03:00:00Z') }
  let fail = true
  const coupang = fakeCoupang(() =>
    fail ? new Response(null, { status: 500 }) : redirect('https://www.coupang.com/vp/products/1'),
  )
  const resolve = createShortLinkResolver({ fetcher: coupang.fetch, clock: () => now.value })
  assert.equal((await resolve(SHORT)).code, 'bad_status')
  fail = false
  const [first, second] = await Promise.all([resolve(SHORT), resolve(`${SHORT}?lptag=x`)])
  assert.equal(first.code, 'ok')
  assert.deepEqual(second, first)
  assert.equal(coupang.calls.length, 2)
  now.value = new Date('2026-06-01T03:09:59Z')
  assert.equal((await resolve(SHORT)).code, 'ok')
  assert.equal(coupang.calls.length, 2)
  now.value = new Date('2026-06-01T03:10:00Z')
  assert.equal((await resolve(SHORT)).code, 'ok')
  assert.equal(coupang.calls.length, 3)
})
