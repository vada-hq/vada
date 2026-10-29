import assert from 'node:assert/strict'
import { test, type TestContext } from 'node:test'
import type { CoupangProduct } from './coupang-url.js'
import type { LookupResult } from './reef.js'
import type { ShortLinkResolver } from './short-link.js'
import { createProductInfo } from './service.js'

const product = {
  name: '펜',
  items: [{ itemId: '11', name: '펜', price: 1000, listPrice: null }],
  selectedItemId: '11',
  shipping: null,
  deliveryEta: null,
  rocket: false,
}
const urlOf = (id: number) => `https://www.coupang.com/vp/products/${id}`

function fakeLookup() {
  const asked: string[] = []
  const lookup = async (wanted: CoupangProduct): Promise<LookupResult> => {
    asked.push(wanted.url)
    return { outcome: 'ok', product }
  }
  return { asked, lookup }
}

function quiet(t: TestContext) {
  const lines: string[] = []
  for (const level of ['log', 'warn'] as const)
    t.mock.method(console, level, (line: unknown) => lines.push(`${level} ${String(line)}`))
  return lines
}

test('상품 조회 로그는 진단 코드·HTTP 상태·시도 횟수만 더하고 주소는 남기지 않는다', async t => {
  const lines = quiet(t)
  const diag = { code: 'PARSE_ERROR', status: 502, attempts: 2 }
  const lookup = async (): Promise<LookupResult> => ({ outcome: 'other', diag })
  const productInfo = createProductInfo({ lookup, clock: () => new Date('2026-06-01T03:00:00Z') })
  const url = urlOf(1)
  await productInfo(url)
  assert.deepEqual(lines, [
    `log ${JSON.stringify({ event: 'product_info', outcome: 'other', ...diag })}`,
  ])
  assert.ok(!lines.join('\n').includes(url))
  assert.ok(!lines.join('\n').includes('coupang'))
})

test('성공 로그에는 상태와 시도 횟수를 넣고 캐시 로그는 결과 종류만 남긴다', async t => {
  const lines = quiet(t)
  const lookup = async (): Promise<LookupResult> => ({
    outcome: 'ok',
    product,
    diag: { status: 200, attempts: 2 },
  })
  const productInfo = createProductInfo({ lookup, clock: () => new Date('2026-06-01T03:00:00Z') })
  await productInfo(urlOf(1))
  await productInfo(urlOf(1))
  assert.deepEqual(lines, [
    `log ${JSON.stringify({ event: 'product_info', outcome: 'ok', status: 200, attempts: 2 })}`,
    `log ${JSON.stringify({ event: 'product_info', outcome: 'cached' })}`,
  ])
})

test('같은 주소가 동시에 오면 ReefAPI를 한 번만 부르고, 끝난 뒤 실패였으면 다음에 다시 부른다', async t => {
  quiet(t)
  let release: (result: LookupResult) => void = () => {}
  const asked: string[] = []
  const lookup = (wanted: CoupangProduct) => {
    asked.push(wanted.url)
    return new Promise<LookupResult>(resolve => (release = resolve))
  }
  const productInfo = createProductInfo({ lookup, clock: () => new Date('2026-06-01T03:00:00Z') })
  const first = productInfo(`${urlOf(1)}?q=a`)
  const second = productInfo(`${urlOf(1)}?q=b`)
  release({ outcome: 'blocked' })
  assert.deepEqual(await Promise.all([first, second]), [
    { product: null, reason: 'unavailable' },
    { product: null, reason: 'unavailable' },
  ])
  assert.equal(asked.length, 1)
  const third = productInfo(urlOf(1))
  release({ outcome: 'ok', product })
  assert.equal((await third).reason, null)
  assert.equal(asked.length, 2)
})

test('하루 상한: 한국 날짜마다 실제로 부른 150번까지만 부르고, 151번째는 부르지 않고 unavailable이다. 다음 날 다시 된다', async t => {
  const lines = quiet(t)
  const clock = { now: new Date('2026-06-01T14:59:00Z') } // 한국 6월 1일 23:59
  const { asked, lookup } = fakeLookup()
  const productInfo = createProductInfo({ lookup, clock: () => clock.now })
  for (let id = 1; id <= 150; id++) assert.equal((await productInfo(urlOf(id))).reason, null)
  // 캐시 적중과 쿠팡 아닌 주소는 세지 않는다.
  assert.equal((await productInfo(urlOf(1))).reason, null)
  assert.equal((await productInfo('https://coupa.ng/abc')).reason, 'unsupported')
  assert.equal(asked.length, 150)
  assert.deepEqual(await productInfo(urlOf(151)), { product: null, reason: 'unavailable' })
  assert.equal(asked.length, 150)
  assert.equal(
    lines.at(-1),
    `warn ${JSON.stringify({ event: 'product_info', outcome: 'daily_cap' })}`,
  )
  // 상한으로 막힌 것은 캐시에 두지 않는다.
  clock.now = new Date('2026-06-01T15:00:00Z') // 한국 6월 2일 0:00
  assert.equal((await productInfo(urlOf(151))).reason, null)
  assert.equal(asked.length, 151)
})

const SHORT = 'https://link.coupang.com/a/bXyZ12'

test('단축 링크: 풀린 상품 주소로 ReefAPI를 부르고 캐시 열쇠도 그 상품이다. 쓴 시간을 넘기고 로그에는 short 코드만 더한다', async t => {
  const lines = quiet(t)
  const clock = { now: new Date('2026-06-01T03:00:00Z') }
  const resolved: string[] = []
  const resolveShortLink: ShortLinkResolver = async url => {
    resolved.push(url)
    clock.now = new Date('2026-06-01T03:00:02.500Z')
    return { code: 'ok', product: { url: urlOf(7), itemId: null, vendorItemId: null } }
  }
  const asked: { url: string; spentMs: number | undefined }[] = []
  const lookup = async (wanted: CoupangProduct, spentMs?: number): Promise<LookupResult> => {
    asked.push({ url: wanted.url, spentMs })
    return { outcome: 'ok', product, diag: { status: 200, attempts: 1 } }
  }
  const productInfo = createProductInfo({ lookup, resolveShortLink, clock: () => clock.now })
  assert.equal((await productInfo(SHORT)).reason, null)
  assert.deepEqual(asked, [{ url: urlOf(7), spentMs: 2500 }])
  // 같은 상품을 긴 주소로 열면 캐시다.
  assert.equal((await productInfo(urlOf(7))).reason, null)
  assert.equal(asked.length, 1)
  assert.deepEqual(resolved, [SHORT])
  assert.deepEqual(lines, [
    `log ${JSON.stringify({ event: 'product_info', outcome: 'ok', status: 200, attempts: 1, short: 'ok' })}`,
    `log ${JSON.stringify({ event: 'product_info', outcome: 'cached' })}`,
  ])
  assert.ok(!lines.join('\n').includes('bXyZ12'))
})

test('단축 링크를 못 풀면 ReefAPI를 부르지 않는다: 이동할 곳이 틀리면 unsupported, 시간 초과·연결 실패는 unavailable', async t => {
  const lines = quiet(t)
  for (const [code, reason] of [
    ['bad_location', 'unsupported'],
    ['no_location', 'unsupported'],
    ['bad_status', 'unsupported'],
    ['timeout', 'unavailable'],
    ['network', 'unavailable'],
  ] as const) {
    const { asked, lookup } = fakeLookup()
    const productInfo = createProductInfo({
      lookup,
      resolveShortLink: async () => ({ code }),
      clock: () => new Date('2026-06-01T03:00:00Z'),
    })
    assert.deepEqual(await productInfo(SHORT), { product: null, reason }, code)
    assert.equal(asked.length, 0)
    assert.equal(
      lines.at(-1),
      `log ${JSON.stringify({ event: 'product_info', outcome: 'short_failed', short: code })}`,
    )
  }
})

test('단축 링크: 키가 없으면 풀지 않고 unavailable, 푸는 함수가 없으면 unsupported다', async () => {
  let resolved = 0
  const resolveShortLink: ShortLinkResolver = async () => {
    resolved++
    return { code: 'network' }
  }
  const clock = () => new Date('2026-06-01T03:00:00Z')
  const keyless = createProductInfo({ lookup: undefined, resolveShortLink, clock })
  assert.deepEqual(await keyless(SHORT), { product: null, reason: 'unavailable' })
  assert.equal(resolved, 0)
  const { lookup } = fakeLookup()
  assert.deepEqual(await createProductInfo({ lookup, clock })(SHORT), {
    product: null,
    reason: 'unsupported',
  })
})

test('단축 링크가 다른 요청이 부르는 중인 같은 상품에 합류하면 10초 예산의 남은 몫까지만 기다리고 unavailable이다', async t => {
  quiet(t)
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const clock = { now: new Date('2026-06-01T03:00:00Z') }
  let release: (result: LookupResult) => void = () => {}
  const lookup = () => new Promise<LookupResult>(resolve => (release = resolve))
  const resolveShortLink: ShortLinkResolver = async () => {
    clock.now = new Date('2026-06-01T03:00:09Z')
    return { code: 'ok', product: { url: urlOf(7), itemId: null, vendorItemId: null } }
  }
  const productInfo = createProductInfo({ lookup, resolveShortLink, clock: () => clock.now })
  const direct = productInfo(urlOf(7))
  const viaShort = productInfo(SHORT)
  let settled = false
  void viaShort.then(() => (settled = true))
  const settle = () => new Promise(resolve => setImmediate(resolve))
  await settle()
  t.mock.timers.tick(999)
  await settle()
  assert.equal(settled, false)
  t.mock.timers.tick(1)
  assert.deepEqual(await viaShort, { product: null, reason: 'unavailable' })
  release({ outcome: 'ok', product })
  assert.equal((await direct).reason, null)
})
