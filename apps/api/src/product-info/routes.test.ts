import assert from 'node:assert/strict'
import { test, type TestContext } from 'node:test'
import { PURCHASE_ITEM_LINK_MAX, type ProductInfoResponse } from '@vada/contracts'
import { createApp } from '../app.js'
import { createTestDb, type TestDb } from '../db/test-db.js'
import { seedCouncil } from '../test-support/council.js'
import { caller, ORIGIN, testSession } from '../test-support/http.js'
import { fakeReef, reefItem, reefProduct } from '../test-support/reef.js'
import { createReefLookup } from './reef.js'
import { createProductInfoRoutes } from './routes.js'

const MINUTE = 60_000
const KEY = 'reef-secret-key'
const PRODUCT = 'https://www.coupang.com/vp/products/7334523?itemId=12&q=펜&searchId=abc'
const NORMALIZED = 'https://www.coupang.com/vp/products/7334523?itemId=12'

type Respond = Parameters<typeof fakeReef>[0]

// 시험마다 새 앱(캐시와 속도 제한이 새것)이다. 시계는 시험이 미룬다.
async function setup(testDb: TestDb, respond: Respond, { withKey = true } = {}) {
  const seeded = await seedCouncil(testDb.db, testDb.pg)
  const other = await seedCouncil(testDb.db, testDb.pg, 'o')
  const reef = fakeReef(respond)
  const clock = { now: new Date('2026-06-01T03:00:00Z') }
  const app = createApp({
    auth: { handler: async () => new Response() },
    trustedOrigin: ORIGIN,
    productInfo: createProductInfoRoutes(testDb.db, testSession, {
      clock: () => clock.now,
      lookup: withKey ? createReefLookup({ apiKey: KEY, fetcher: reef.fetch }) : undefined,
    }),
  })
  const api = caller(app)
  const path = `/api/organizations/${seeded.councilId}/product-info`
  const ask = async (url: string, userId = seeded.people.planningMember.userId) => {
    const response = await api.post(path, { url }, userId)
    return { status: response.status, body: (await response.json()) as ProductInfoResponse }
  }
  return { seeded, other, reef, clock, api, path, ask }
}

// 서버가 남긴 로그 줄을 모은다(log와 warn).
function captureLogs(t: TestContext) {
  const lines: { level: string; line: string }[] = []
  for (const level of ['log', 'warn'] as const)
    t.mock.method(console, level, (line: unknown) => lines.push({ level, line: String(line) }))
  return lines
}

const twoItems = () =>
  reefProduct({
    item: reefItem({ item_id: '11', name: '펜 검정' }),
    items: [
      reefItem({ item_id: '11', name: '펜 검정', price: 1000 }),
      reefItem({ item_id: '12', name: '펜 빨강', price: 1100, list_price: 1500 }),
    ],
  })

test('상품 정보: 쿠팡 상품 주소면 product가 오고, ReefAPI는 정규화한 주소 하나와 키만 받는다', async t => {
  const testDb = await createTestDb()
  try {
    const logs = captureLogs(t)
    const { reef, ask } = await setup(testDb, () => Response.json(twoItems()))
    const { status, body } = await ask(PRODUCT)
    assert.equal(status, 200)
    assert.equal(body.reason, null)
    assert.equal(body.product?.selectedItemId, '12')
    assert.equal(body.product?.name, '펜 빨강')
    assert.deepEqual(body.product?.items[1], {
      itemId: '12',
      name: '펜 빨강',
      price: 1100,
      listPrice: 1500,
    })
    assert.equal(reef.calls.length, 1)
    assert.deepEqual(JSON.parse(reef.calls[0]!.body), { product_id: NORMALIZED })
    assert.equal(reef.calls[0]!.headers.get('x-api-key'), KEY)
    // 로그는 결과 종류와 진단 숫자뿐이다. 주소, 키, 학생회, 사람은 없다.
    assert.deepEqual(logs, [
      {
        level: 'log',
        line: JSON.stringify({ event: 'product_info', outcome: 'ok', status: 200, attempts: 1 }),
      },
    ])
    assert.ok(!JSON.stringify(body).includes(KEY))
  } finally {
    await testDb.close()
  }
})

test('상품 정보: 단축 주소·다른 쇼핑몰은 부르지 않고 unsupported(200)다', async t => {
  const testDb = await createTestDb()
  try {
    const logs = captureLogs(t)
    const { reef, ask } = await setup(testDb, () => Response.json(twoItems()))
    for (const url of [
      'https://link.coupang.com/a/bXyZ12',
      'https://coupa.ng/abc',
      'https://smartstore.naver.com/shop/products/123',
    ]) {
      assert.deepEqual(await ask(url), {
        status: 200,
        body: { product: null, reason: 'unsupported' },
      })
    }
    assert.equal(reef.calls.length, 0)
    assert.deepEqual(logs, [])
  } finally {
    await testDb.close()
  }
})

test('상품 정보: NOT_FOUND는 not_found, 그 밖의 실패·모양이 다른 응답은 unavailable이고 모두 200이다. 일시 오류만 한 번 다시 부른다', async t => {
  const logs = captureLogs(t)
  type Case = [Respond, string, string, { code: string; status: number | null; attempts: number }]
  const cases: Case[] = [
    [
      () => Response.json({ ok: false, error: { code: 'NOT_FOUND' } }, { status: 404 }),
      'not_found',
      'not_found',
      { code: 'NOT_FOUND', status: 404, attempts: 1 },
    ],
    [
      () => Response.json({ ok: false, error: { code: 'TARGET_BLOCKED' } }, { status: 502 }),
      'unavailable',
      'blocked',
      { code: 'TARGET_BLOCKED', status: 502, attempts: 2 },
    ],
    [
      () => Response.json({ ok: false, error: { code: 'QUOTA_EXCEEDED' } }, { status: 402 }),
      'unavailable',
      'quota',
      { code: 'QUOTA_EXCEEDED', status: 402, attempts: 1 },
    ],
    [
      () => Response.json({ ok: false, error: { code: 'AUTH_FAILED' } }, { status: 401 }),
      'unavailable',
      'auth',
      { code: 'AUTH_FAILED', status: 401, attempts: 1 },
    ],
    [
      () => new Response('<html></html>'),
      'unavailable',
      'other',
      { code: 'non_json', status: 200, attempts: 1 },
    ],
    [
      () => Promise.reject(new TypeError('fetch failed')),
      'unavailable',
      'other',
      { code: 'network', status: null, attempts: 1 },
    ],
  ]
  for (const [respond, reason, outcome, diag] of cases) {
    const testDb = await createTestDb()
    try {
      logs.length = 0
      const { reef, ask } = await setup(testDb, respond)
      assert.deepEqual(
        await ask(PRODUCT),
        { status: 200, body: { product: null, reason } },
        outcome,
      )
      assert.equal(reef.calls.length, diag.attempts, outcome)
      // 크레딧과 키는 사람이 손볼 일이라 경고 단계다.
      const level = outcome === 'quota' || outcome === 'auth' ? 'warn' : 'log'
      assert.deepEqual(logs, [
        { level, line: JSON.stringify({ event: 'product_info', outcome, ...diag }) },
      ])
    } finally {
      await testDb.close()
    }
  }
})

test('상품 정보 캐시: 같은 주소(쿼리만 다른 것 포함)는 10분 안에 다시 부르지 않고, 10분이 지나면 다시 부른다', async t => {
  const testDb = await createTestDb()
  try {
    const logs = captureLogs(t)
    const { reef, clock, ask } = await setup(testDb, () => Response.json(twoItems()))
    const first = await ask(PRODUCT)
    clock.now = new Date(clock.now.getTime() + 10 * MINUTE - 1)
    const again = await ask(
      'https://m.coupang.com/vm/products/7334523?itemId=12&q=다른검색&traceId=t',
    )
    assert.deepEqual(again, first)
    assert.equal(reef.calls.length, 1)
    assert.equal(logs.at(-1)?.line, JSON.stringify({ event: 'product_info', outcome: 'cached' }))
    // 고른 판매 단위가 다르면 다른 주소다.
    await ask('https://www.coupang.com/vp/products/7334523?itemId=11')
    assert.equal(reef.calls.length, 2)
    clock.now = new Date(clock.now.getTime() + 2)
    await ask(PRODUCT)
    assert.equal(reef.calls.length, 3)
  } finally {
    await testDb.close()
  }
})

test('상품 정보 캐시: not_found도 10분 두고, unavailable은 두지 않아 다음에 다시 부른다', async () => {
  const testDb = await createTestDb()
  try {
    let next = () => Response.json({ ok: false, error: { code: 'NOT_FOUND' } }, { status: 404 })
    const { reef, ask } = await setup(testDb, () => next())
    assert.equal((await ask(PRODUCT)).body.reason, 'not_found')
    assert.equal((await ask(PRODUCT)).body.reason, 'not_found')
    assert.equal(reef.calls.length, 1)
    next = () => Response.json({ ok: false, error: { code: 'TARGET_BLOCKED' } }, { status: 502 })
    const other = 'https://www.coupang.com/vp/products/999'
    assert.equal((await ask(other)).body.reason, 'unavailable')
    // TARGET_BLOCKED는 한 번 다시 불러 2번이다.
    assert.equal(reef.calls.length, 3)
    next = () => Response.json(twoItems())
    assert.equal((await ask(other)).body.reason, null)
    assert.equal(reef.calls.length, 4)
  } finally {
    await testDb.close()
  }
})

test('상품 정보: 키가 없으면 부르지 않고 unavailable(200)이다. 쿠팡 주소가 아니면 그대로 unsupported다', async () => {
  const testDb = await createTestDb()
  try {
    const { reef, ask } = await setup(testDb, () => Response.json(twoItems()), { withKey: false })
    assert.deepEqual(await ask(PRODUCT), {
      status: 200,
      body: { product: null, reason: 'unavailable' },
    })
    assert.equal((await ask('https://coupa.ng/abc')).body.reason, 'unsupported')
    assert.equal(reef.calls.length, 0)
  } finally {
    await testDb.close()
  }
})

test('상품 정보 속도 제한: 계정마다 1분에 20번이고 21번째는 429다. 1분이 지나거나 다른 계정이면 된다', async () => {
  const testDb = await createTestDb()
  try {
    const { seeded, clock, ask } = await setup(testDb, () => Response.json(twoItems()))
    for (let index = 0; index < 20; index++)
      assert.equal((await ask('https://coupa.ng/abc')).status, 200, String(index))
    assert.equal((await ask('https://coupa.ng/abc')).status, 429)
    assert.equal((await ask('https://coupa.ng/abc', seeded.people.president.userId)).status, 200)
    clock.now = new Date(clock.now.getTime() + MINUTE)
    assert.equal((await ask('https://coupa.ng/abc')).status, 200)
  } finally {
    await testDb.close()
  }
})

test('상품 정보 경계: 다른 학생회는 403, 끝난 소속은 403, 미인증은 401, 형식이 틀리면 400이고 ReefAPI를 부르지 않는다', async () => {
  const testDb = await createTestDb()
  try {
    const { seeded, other, reef, api, path, ask } = await setup(testDb, () =>
      Response.json(twoItems()),
    )
    assert.equal((await ask(PRODUCT, other.people.president.userId)).status, 403)
    assert.equal((await ask(PRODUCT, seeded.people.ended.userId)).status, 403)
    assert.equal((await api.post(path, { url: PRODUCT })).status, 401)
    const member = seeded.people.planningMember.userId
    const tooLong = `https://www.coupang.com/vp/products/1?q=${'a'.repeat(PURCHASE_ITEM_LINK_MAX)}`
    for (const body of [
      {},
      { url: '' },
      { url: '   ' },
      { url: 'javascript:alert(1)' },
      { url: tooLong.slice(0, PURCHASE_ITEM_LINK_MAX + 1) },
      // 상한은 코드 포인트로 센다(DB char_length와 같다). 이모지로 상한+1
      {
        url: `https://a.test/${'😀'.repeat(PURCHASE_ITEM_LINK_MAX + 1 - 'https://a.test/'.length)}`,
      },
      { url: 'https://www.coupang.com/vp/products/1\u0000' },
      { url: 'https://www.coupang.com/vp/products/1\uD800' },
      { url: PRODUCT, councilId: other.councilId },
    ]) {
      const response = await api.post(path, body, member)
      assert.equal(response.status, 400, JSON.stringify(body).slice(0, 80))
    }
    assert.equal(
      (await api.post('/api/organizations/not-a-uuid/product-info', { url: PRODUCT }, member))
        .status,
      403,
    )
    assert.equal(reef.calls.length, 0)
  } finally {
    await testDb.close()
  }
})
