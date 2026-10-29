import assert from 'node:assert/strict'
import { test, type TestContext } from 'node:test'
import type { ProductInfo } from '@vada/contracts'
import { createTestDb, type TestDb } from '../db/test-db.js'
import type { Db } from '../db/types.js'
import type { CoupangProduct } from './coupang-url.js'
import type { LookupResult, ProductLookup } from './reef.js'
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
const T0 = new Date('2026-06-01T03:00:00Z')

function fakeLookup(result: () => LookupResult = () => ({ outcome: 'ok', product })) {
  const asked: string[] = []
  const lookup = async (wanted: CoupangProduct): Promise<LookupResult> => {
    asked.push(wanted.url)
    return result()
  }
  return { asked, lookup }
}

function quiet(t: TestContext) {
  const lines: string[] = []
  for (const level of ['log', 'warn'] as const)
    t.mock.method(console, level, (line: unknown) => lines.push(`${level} ${String(line)}`))
  return lines
}

// 시험마다 새 DB다. 같은 DB로 서비스를 다시 만들면 서버를 다시 시작한 것과 같다.
async function dbOf(t: TestContext): Promise<TestDb> {
  const testDb = await createTestDb()
  t.after(() => testDb.close())
  return testDb
}

async function storedRows(testDb: TestDb) {
  return (
    await testDb.pg.query<{ url: string; outcome: string; fetched_at: Date }>(
      'SELECT url, outcome, fetched_at FROM product_info ORDER BY url',
    )
  ).rows.map(row => ({ ...row, fetched_at: new Date(row.fetched_at).toISOString() }))
}

function service(
  testDb: TestDb,
  lookup: ProductLookup | undefined,
  clock: { now: Date },
  resolveShortLink?: ShortLinkResolver,
) {
  return createProductInfo({ db: testDb.db, lookup, resolveShortLink, clock: () => clock.now })
}

test('처음 읽으면 ReefAPI를 불러 저장하고, 그 뒤로는 1년이 지나도 저장값을 그대로 준다', async t => {
  const lines = quiet(t)
  const testDb = await dbOf(t)
  const clock = { now: T0 }
  const { asked, lookup } = fakeLookup()
  const productInfo = service(testDb, lookup, clock)
  const first = await productInfo(`${urlOf(1)}?q=검색어`)
  assert.deepEqual(first, { product: { ...product, fetchedAt: T0.toISOString() }, reason: null })
  assert.deepEqual(await storedRows(testDb), [
    { url: urlOf(1), outcome: 'ok', fetched_at: T0.toISOString() },
  ])
  clock.now = new Date('2027-06-01T03:00:00Z')
  assert.deepEqual(await productInfo(urlOf(1)), first)
  assert.deepEqual(asked, [urlOf(1)])
  assert.deepEqual(lines, [
    `log ${JSON.stringify({ event: 'product_info', outcome: 'ok' })}`,
    `log ${JSON.stringify({ event: 'product_info', outcome: 'stored' })}`,
  ])
})

test('서버를 다시 시작해도(새 서비스, 같은 DB) 저장값을 쓰고 ReefAPI를 부르지 않는다', async t => {
  quiet(t)
  const testDb = await dbOf(t)
  const clock = { now: T0 }
  const before = fakeLookup()
  const first = await service(testDb, before.lookup, clock)(urlOf(1))
  clock.now = new Date('2026-06-01T04:00:00Z')
  const after = fakeLookup()
  assert.deepEqual(await service(testDb, after.lookup, clock)(urlOf(1)), first)
  assert.equal(after.asked.length, 0)
})

test('itemId가 다르면 다른 상품으로 저장한다(고른 판매 단위가 주소의 itemId로 정해진다)', async t => {
  quiet(t)
  const testDb = await dbOf(t)
  const { asked, lookup } = fakeLookup()
  const productInfo = service(testDb, lookup, { now: T0 })
  await productInfo(`${urlOf(1)}?itemId=11`)
  await productInfo(`${urlOf(1)}?itemId=12`)
  await productInfo(`${urlOf(1)}?itemId=11&q=x`)
  assert.deepEqual(asked, [`${urlOf(1)}?itemId=11`, `${urlOf(1)}?itemId=12`])
  assert.equal((await storedRows(testDb)).length, 2)
})

test('not_found는 저장하고 다시 부르지 않는다. unavailable은 저장하지 않고 다음에 다시 부른다', async t => {
  quiet(t)
  const testDb = await dbOf(t)
  let outcome: LookupResult['outcome'] = 'not_found'
  const { asked, lookup } = fakeLookup(() =>
    outcome === 'ok' ? { outcome, product } : { outcome },
  )
  const productInfo = service(testDb, lookup, { now: T0 })
  assert.deepEqual(await productInfo(urlOf(1)), { product: null, reason: 'not_found' })
  assert.deepEqual(await productInfo(urlOf(1)), { product: null, reason: 'not_found' })
  assert.equal(asked.length, 1)
  outcome = 'blocked'
  assert.deepEqual(await productInfo(urlOf(2)), { product: null, reason: 'unavailable' })
  assert.deepEqual(await storedRows(testDb), [
    { url: urlOf(1), outcome: 'not_found', fetched_at: T0.toISOString() },
  ])
  outcome = 'ok'
  assert.equal((await productInfo(urlOf(2))).reason, null)
  assert.equal(asked.length, 3)
})

test('새로고침은 ReefAPI를 다시 불러 저장값과 가져온 시각을 덮어쓴다', async t => {
  const lines = quiet(t)
  const testDb = await dbOf(t)
  const clock = { now: T0 }
  let name = '펜'
  const { asked, lookup } = fakeLookup(() => ({ outcome: 'ok', product: { ...product, name } }))
  const productInfo = service(testDb, lookup, clock)
  await productInfo(urlOf(1))
  clock.now = new Date('2026-06-03T03:00:00Z')
  name = '새 펜'
  const refreshed = await productInfo(urlOf(1), { refresh: true })
  assert.deepEqual(refreshed, {
    product: { ...product, name: '새 펜', fetchedAt: clock.now.toISOString() },
    reason: null,
  })
  assert.equal(asked.length, 2)
  clock.now = new Date('2026-06-04T03:00:00Z')
  assert.deepEqual(await productInfo(urlOf(1)), refreshed)
  assert.equal(asked.length, 2)
  assert.equal(
    lines[1],
    `log ${JSON.stringify({ event: 'product_info', outcome: 'ok', refresh: true })}`,
  )
})

test('새로고침이 실패하면 저장값을 그대로 두고 그 값과 refreshFailed를 준다. 저장값이 없으면 unavailable이다', async t => {
  quiet(t)
  const testDb = await dbOf(t)
  const clock = { now: T0 }
  let outcome: LookupResult['outcome'] = 'ok'
  const { lookup } = fakeLookup(() => (outcome === 'ok' ? { outcome, product } : { outcome }))
  const productInfo = service(testDb, lookup, clock)
  const first = await productInfo(urlOf(1))
  const rows = await storedRows(testDb)
  clock.now = new Date('2026-06-03T03:00:00Z')
  outcome = 'timeout'
  assert.deepEqual(await productInfo(urlOf(1), { refresh: true }), {
    ...first,
    refreshFailed: true,
  })
  assert.deepEqual(await storedRows(testDb), rows)
  assert.deepEqual(await productInfo(urlOf(1)), first)
  assert.deepEqual(await productInfo(urlOf(2), { refresh: true }), {
    product: null,
    reason: 'unavailable',
    refreshFailed: true,
  })
  // 새로고침에서 쿠팡이 없다고 하면 실패가 아니라 결과다. not_found로 덮어쓴다.
  outcome = 'not_found'
  assert.deepEqual(await productInfo(urlOf(1), { refresh: true }), {
    product: null,
    reason: 'not_found',
  })
  assert.deepEqual(await productInfo(urlOf(1)), { product: null, reason: 'not_found' })
})

test('키가 없으면 저장값도 읽지 않고 unavailable이다(REEF_API_KEY를 빼면 불러오기가 꺼진다)', async t => {
  quiet(t)
  const testDb = await dbOf(t)
  const clock = { now: T0 }
  await service(testDb, fakeLookup().lookup, clock)(urlOf(1))
  const keyless = service(testDb, undefined, clock)
  assert.deepEqual(await keyless(urlOf(1)), { product: null, reason: 'unavailable' })
  assert.deepEqual(await keyless(urlOf(1), { refresh: true }), {
    product: null,
    reason: 'unavailable',
    refreshFailed: true,
  })
})

test('저장 크기 상한을 넘는 상품은 고른 판매 단위를 남기고 판매 단위를 줄여 저장한다. 다시 부르지 않는다', async t => {
  quiet(t)
  const testDb = await dbOf(t)
  const huge: ProductInfo = {
    ...product,
    selectedItemId: '399',
    items: Array.from({ length: 400 }, (_, i) => ({
      itemId: String(i),
      name: '가'.repeat(100),
      price: 1000,
      listPrice: null,
    })),
  }
  const { asked, lookup } = fakeLookup(() => ({ outcome: 'ok', product: huge }))
  const productInfo = service(testDb, lookup, { now: T0 })
  const response = await productInfo(urlOf(1))
  const items = response.product?.items ?? []
  assert.ok(items.length > 1 && items.length < 400, String(items.length))
  assert.equal(items[0]?.itemId, '399')
  assert.ok(Buffer.byteLength(JSON.stringify(response.product)) <= 32_768)
  assert.equal((await storedRows(testDb)).length, 1)
  assert.deepEqual(await productInfo(urlOf(1)), response)
  assert.equal(asked.length, 1)
})

test('DB가 받지 않는 글자(NUL, 홀로 쓰인 서러게이트)와 아주 긴 글은 다듬어 저장한다. 다시 부르지 않는다', async t => {
  quiet(t)
  const testDb = await dbOf(t)
  // 제어 문자는 JSON에서 6바이트씩이라, 고른 판매 단위 하나만으로도 32KB를 넘길 수 있었다.
  const controls = String.fromCharCode(1).repeat(5000)
  const odd: ProductInfo = {
    ...product,
    name: 'a\u0000b\uD800c',
    items: [{ itemId: '11', name: controls, price: 1000, listPrice: null }],
    shipping: '가'.repeat(5000),
    deliveryEta: controls,
    imageUrl: controls,
  }
  const { asked, lookup } = fakeLookup(() => ({ outcome: 'ok', product: odd }))
  const productInfo = service(testDb, lookup, { now: T0 })
  const response = await productInfo(urlOf(1))
  assert.equal(response.product?.name, `a b${String.fromCharCode(0xfffd)}c`)
  assert.equal(response.product?.shipping?.length, 1000)
  assert.equal(response.product?.deliveryEta, ' '.repeat(1000))
  assert.equal(response.product?.items[0]?.name, ' '.repeat(1000))
  assert.equal((await storedRows(testDb)).length, 1)
  assert.deepEqual(await productInfo(urlOf(1)), response)
  assert.equal(asked.length, 1)
})

// firstLate번째부터의 select는 바로 실행하되(그때의 DB를 읽음) 결과는 gate가 열린 뒤에 준다.
function lateReads(db: Db, gate: Promise<void>, firstLate = 2): Db {
  let count = 0
  const late = (query: object) => {
    const then = (query as PromiseLike<unknown>).then.bind(query)
    return Object.assign(query, {
      // oxlint-disable-next-line unicorn/no-thenable -- drizzle 질의는 then으로 실행된다. 결과만 늦추려고 바꿔 끼운다.
      then: (ok: (value: unknown) => unknown, fail: (error: unknown) => unknown) =>
        then(value => gate.then(() => ok(value)), fail),
    })
  }
  return new Proxy(db, {
    get(target, prop, receiver) {
      if (prop !== 'select') return Reflect.get(target, prop, receiver) as unknown
      return (...args: Parameters<Db['select']>) => {
        const builder = target.select(...args)
        if (++count < firstLate) return builder
        const from = builder.from.bind(builder)
        return Object.assign(builder, {
          from: (...table: Parameters<typeof from>) => late(from(...table)),
        })
      }
    },
  })
}

test('단축 링크 새로고침이 남은 몫 안에 저장값 읽기가 끝나지 않으면 새로 부르지 않고 실패를 알린다(두 번 부르지 않음)', async t => {
  quiet(t)
  const testDb = await dbOf(t)
  let openGate: () => void = () => {}
  const gate = new Promise<void>(resolve => (openGate = resolve))
  const clock = { now: T0 }
  const { asked, lookup } = fakeLookup()
  const resolveShortLink: ShortLinkResolver = async () => {
    clock.now = new Date('2026-06-01T03:00:09.900Z')
    return { code: 'ok', product: { url: urlOf(7), itemId: null, vendorItemId: null } }
  }
  const productInfo = createProductInfo({
    db: lateReads(testDb.db, gate, 1),
    lookup,
    resolveShortLink,
    clock: () => clock.now,
  })
  // 늦게 오는 DB 읽기(빈 결과)를 기다리는 읽기
  const reading = productInfo(urlOf(7))
  await new Promise(resolve => setTimeout(resolve, 20))
  const refreshing = productInfo(SHORT, { refresh: true })
  await new Promise(resolve => setTimeout(resolve, 500))
  openGate()
  assert.equal((await reading).reason, null)
  assert.deepEqual(await refreshing, { product: null, reason: 'unavailable', refreshFailed: true })
  assert.equal(asked.length, 1)
})

test('저장값 읽기가 늦게 와도, 그 사이 같은 상품의 다른 조회가 불러 저장했으면 다시 부르지 않는다', async t => {
  quiet(t)
  const testDb = await dbOf(t)
  let openGate: () => void = () => {}
  const gate = new Promise<void>(resolve => (openGate = resolve))
  let release: (result: LookupResult) => void = () => {}
  const asked: string[] = []
  const lookup = (wanted: CoupangProduct) => {
    asked.push(wanted.url)
    return new Promise<LookupResult>(resolve => (release = resolve))
  }
  const productInfo = createProductInfo({
    db: lateReads(testDb.db, gate),
    lookup,
    clock: () => T0,
  })
  const first = productInfo(urlOf(1))
  while (asked.length === 0) await new Promise(resolve => setImmediate(resolve))
  const second = productInfo(urlOf(1))
  await new Promise(resolve => setTimeout(resolve, 50))
  release({ outcome: 'ok', product })
  assert.equal((await first).reason, null)
  openGate()
  assert.equal((await second).reason, null)
  assert.equal(asked.length, 1)
})

test('부르는 중인 새로고침에 합류한 읽기는 새로고침이 실패하면 저장값을 받는다', async t => {
  quiet(t)
  const testDb = await dbOf(t)
  let release: (result: LookupResult) => void = () => {}
  let pending = false
  const lookup = () => {
    pending = true
    return new Promise<LookupResult>(resolve => (release = resolve))
  }
  const productInfo = service(testDb, lookup, { now: T0 })
  const first = productInfo(urlOf(1))
  while (!pending) await new Promise(resolve => setImmediate(resolve))
  release({ outcome: 'ok', product })
  const stored = await first
  pending = false
  const refreshing = productInfo(urlOf(1), { refresh: true })
  while (!pending) await new Promise(resolve => setImmediate(resolve))
  const reading = productInfo(urlOf(1))
  await new Promise(resolve => setTimeout(resolve, 20))
  release({ outcome: 'timeout' })
  assert.deepEqual(await refreshing, { ...stored, refreshFailed: true })
  assert.deepEqual(await reading, stored)
})

test('상품 조회 로그는 진단 코드·HTTP 상태·시도 횟수만 더하고 주소는 남기지 않는다', async t => {
  const lines = quiet(t)
  const testDb = await dbOf(t)
  const diag = { code: 'PARSE_ERROR', status: 502, attempts: 2 }
  const lookup = async (): Promise<LookupResult> => ({ outcome: 'other', diag })
  const url = urlOf(1)
  await service(testDb, lookup, { now: T0 })(url)
  assert.deepEqual(lines, [
    `log ${JSON.stringify({ event: 'product_info', outcome: 'other', ...diag })}`,
  ])
  assert.ok(!lines.join('\n').includes('coupang'))
})

test('같은 주소가 동시에 오면 ReefAPI를 한 번만 부르고, 끝난 뒤 실패였으면 다음에 다시 부른다. 새로고침도 합류한다', async t => {
  quiet(t)
  const testDb = await dbOf(t)
  let release: (result: LookupResult) => void = () => {}
  const asked: string[] = []
  const lookup = (wanted: CoupangProduct) => {
    asked.push(wanted.url)
    return new Promise<LookupResult>(resolve => (release = resolve))
  }
  const productInfo = service(testDb, lookup, { now: T0 })
  const first = productInfo(`${urlOf(1)}?q=a`)
  const second = productInfo(`${urlOf(1)}?q=b`)
  const third = productInfo(urlOf(1), { refresh: true })
  // DB를 읽은 뒤에 진행 조회를 보므로 모두 그 자리에 닿을 때까지 기다린다.
  while (asked.length === 0) await new Promise(resolve => setImmediate(resolve))
  await new Promise(resolve => setTimeout(resolve, 50))
  release({ outcome: 'blocked' })
  assert.deepEqual(await Promise.all([first, second]), [
    { product: null, reason: 'unavailable' },
    { product: null, reason: 'unavailable' },
  ])
  assert.deepEqual(await third, { product: null, reason: 'unavailable', refreshFailed: true })
  assert.equal(asked.length, 1)
  const fourth = productInfo(urlOf(1))
  while (asked.length === 1) await new Promise(resolve => setImmediate(resolve))
  release({ outcome: 'ok', product })
  assert.equal((await fourth).reason, null)
  assert.equal(asked.length, 2)
})

test('하루 상한: 한국 날짜마다 실제로 부른 150번까지만 부르고(새로고침 포함), 151번째는 unavailable이다. 다음 날 다시 된다', async t => {
  const lines = quiet(t)
  const testDb = await dbOf(t)
  const clock = { now: new Date('2026-06-01T14:59:00Z') } // 한국 6월 1일 23:59
  const { asked, lookup } = fakeLookup()
  const productInfo = service(testDb, lookup, clock)
  for (let id = 1; id <= 149; id++) assert.equal((await productInfo(urlOf(id))).reason, null)
  assert.equal((await productInfo(urlOf(1), { refresh: true })).reason, null)
  // 저장값과 쿠팡 아닌 주소는 세지 않는다.
  assert.equal((await productInfo(urlOf(1))).reason, null)
  assert.equal((await productInfo('https://coupa.ng/abc')).reason, 'unsupported')
  assert.equal(asked.length, 150)
  assert.deepEqual(await productInfo(urlOf(151)), { product: null, reason: 'unavailable' })
  assert.deepEqual(await productInfo(urlOf(1), { refresh: true }), {
    ...(await productInfo(urlOf(1))),
    refreshFailed: true,
  })
  assert.equal(asked.length, 150)
  assert.ok(
    lines.includes(`warn ${JSON.stringify({ event: 'product_info', outcome: 'daily_cap' })}`),
  )
  clock.now = new Date('2026-06-01T15:00:00Z') // 한국 6월 2일 0:00
  assert.equal((await productInfo(urlOf(151))).reason, null)
  assert.equal(asked.length, 151)
})

const SHORT = 'https://link.coupang.com/a/bXyZ12'

test('단축 링크: 풀린 상품 주소로 ReefAPI를 부르고 저장 열쇠도 그 상품이다. 쓴 시간을 넘기고 로그에는 short 코드만 더한다', async t => {
  const lines = quiet(t)
  const testDb = await dbOf(t)
  const clock = { now: T0 }
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
  const productInfo = service(testDb, lookup, clock, resolveShortLink)
  assert.equal((await productInfo(SHORT)).reason, null)
  assert.deepEqual(asked, [{ url: urlOf(7), spentMs: 2500 }])
  // 같은 상품을 긴 주소로 열면 저장값이다.
  assert.equal((await productInfo(urlOf(7))).reason, null)
  assert.equal(asked.length, 1)
  assert.deepEqual(resolved, [SHORT])
  assert.deepEqual(lines, [
    `log ${JSON.stringify({ event: 'product_info', outcome: 'ok', status: 200, attempts: 1, short: 'ok' })}`,
    `log ${JSON.stringify({ event: 'product_info', outcome: 'stored' })}`,
  ])
  assert.ok(!lines.join('\n').includes('bXyZ12'))
})

test('단축 링크를 못 풀면 ReefAPI를 부르지 않는다: 이동할 곳이 틀리면 unsupported, 시간 초과·연결 실패는 unavailable', async t => {
  const lines = quiet(t)
  const testDb = await dbOf(t)
  for (const [code, reason] of [
    ['bad_location', 'unsupported'],
    ['no_location', 'unsupported'],
    ['bad_status', 'unsupported'],
    ['timeout', 'unavailable'],
    ['network', 'unavailable'],
  ] as const) {
    const { asked, lookup } = fakeLookup()
    const productInfo = service(testDb, lookup, { now: T0 }, async () => ({ code }))
    assert.deepEqual(await productInfo(SHORT), { product: null, reason }, code)
    assert.equal(asked.length, 0)
    assert.equal(
      lines.at(-1),
      `log ${JSON.stringify({ event: 'product_info', outcome: 'short_failed', short: code })}`,
    )
  }
})

test('단축 링크: 키가 없으면 풀지 않고 unavailable, 푸는 함수가 없으면 unsupported다', async t => {
  const testDb = await dbOf(t)
  let resolved = 0
  const resolveShortLink: ShortLinkResolver = async () => {
    resolved++
    return { code: 'network' }
  }
  const clock = { now: T0 }
  assert.deepEqual(await service(testDb, undefined, clock, resolveShortLink)(SHORT), {
    product: null,
    reason: 'unavailable',
  })
  assert.equal(resolved, 0)
  assert.deepEqual(await service(testDb, fakeLookup().lookup, clock)(SHORT), {
    product: null,
    reason: 'unsupported',
  })
})

test('단축 링크가 다른 요청이 부르는 중인 같은 상품에 합류하면 10초 예산의 남은 몫까지만 기다리고 unavailable이다', async t => {
  quiet(t)
  const testDb = await dbOf(t)
  const clock = { now: T0 }
  let release: (result: LookupResult) => void = () => {}
  let called = false
  const lookup = () => {
    called = true
    return new Promise<LookupResult>(resolve => (release = resolve))
  }
  const resolveShortLink: ShortLinkResolver = async () => {
    clock.now = new Date('2026-06-01T03:00:09.900Z')
    return { code: 'ok', product: { url: urlOf(7), itemId: null, vendorItemId: null } }
  }
  const productInfo = service(testDb, lookup, clock, resolveShortLink)
  const direct = productInfo(urlOf(7))
  while (!called) await new Promise(resolve => setImmediate(resolve))
  const started = Date.now()
  // 남은 몫은 100ms다. 부르는 중인 조회는 끝나지 않았으므로 그 뒤에 unavailable이다.
  assert.deepEqual(await productInfo(SHORT), { product: null, reason: 'unavailable' })
  assert.ok(Date.now() - started < 5_000)
  release({ outcome: 'ok', product })
  assert.equal((await direct).reason, null)
})
