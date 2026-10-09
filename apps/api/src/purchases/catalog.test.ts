import assert from 'node:assert/strict'
import { test } from 'node:test'
import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import { migrate } from 'drizzle-orm/pglite/migrator'
import { migrationsFolder } from '../db/test-migrations.js'
import { createProductCatalog } from './catalog.js'
import { createLookupRunner } from './lookup-runner.js'
import type { FetchResult } from './products.js'

const item = (vendorItemId: string, price = 1000) => ({ itemId: '1', vendorItemId, name: '상품', price, listPrice: null, discountPercent: null,
  inStock: true, deliveryEta: null, imageUrl: null })
async function setup() {
  const pg = new PGlite()
  const db = drizzle(pg)
  await migrate(db, { migrationsFolder })
  const rows = async () => (await pg.query<{ id: string; status: string; attempts: number; error_code: string | null; locked: boolean; wait: number }>(
    `SELECT id, status, attempts, error_code, locked_until IS NOT NULL AS locked,
      round(extract(epoch FROM next_attempt_at - now()) / 60)::int AS wait FROM coupang_products ORDER BY id`)).rows
  return { pg, db, rows }
}

test('대기열은 시도할 때가 된 상품만 잠가 가져가고, 잠금이 풀리기 전에는 다시 가져가지 않는다', async () => {
  const { pg, db } = await setup()
  try {
    await pg.exec("INSERT INTO coupang_products (id) VALUES ('1'),('2'); INSERT INTO coupang_products (id, next_attempt_at) VALUES ('3', now() + interval '1 hour')")
    const catalog = createProductCatalog(db, async () => ({ ok: true, items: [item('9')] }))
    assert.deepEqual((await catalog.claim(5)).map(row => row.id).sort(), ['1', '2'])
    assert.deepEqual(await catalog.claim(5), [])
    await pg.exec("UPDATE coupang_products SET locked_until = now() - interval '1 second' WHERE id = '1'")
    assert.deepEqual((await catalog.claim(5)).map(row => row.id), ['1'])
  } finally { await pg.close() }
})

test('성공은 옵션을 저장하고, 실패는 1·5·30분 뒤 다시 시도하다 네 번째에 멈추며, NOT_FOUND는 바로 멈춘다', async () => {
  const { pg, db, rows } = await setup()
  try {
    await pg.exec("INSERT INTO coupang_products (id) VALUES ('1'),('2'),('3')")
    const results: Record<string, FetchResult> = {
      '1': { ok: true, items: [item('9')] },
      '2': { ok: false, code: 'RATE_LIMITED', retryable: true },
      '3': { ok: false, code: 'NOT_FOUND', retryable: false },
    }
    const catalog = createProductCatalog(db, async id => results[id]!)
    const runAll = async () => { for (const product of await catalog.claim(5)) await catalog.process(product) }
    await runAll()
    const [ready, waiting, missing] = await rows()
    assert.deepEqual([ready!.status, ready!.attempts, ready!.locked], ['ready', 0, false])
    assert.deepEqual((await catalog.read(['1'])).get('1')!.items, [item('9')])
    assert.deepEqual([waiting!.status, waiting!.attempts, waiting!.error_code, waiting!.wait], ['pending', 1, 'RATE_LIMITED', 1])
    assert.deepEqual([missing!.status, missing!.error_code], ['failed', 'NOT_FOUND'])
    for (const wait of [5, 30]) {
      await pg.exec("UPDATE coupang_products SET next_attempt_at = now() WHERE id = '2'")
      await runAll()
      assert.equal((await rows())[1]!.wait, wait)
    }
    await pg.exec("UPDATE coupang_products SET next_attempt_at = now() WHERE id = '2'")
    await runAll()
    const stopped = (await rows())[1]!
    assert.deepEqual([stopped.status, stopped.attempts], ['failed', 4])
  } finally { await pg.close() }
})

test('바로 조회는 없는 상품 행을 만들고, 이미 받은 정보는 실패해도 지우지 않는다', async () => {
  const { pg, db, rows } = await setup()
  try {
    let next: FetchResult = { ok: true, items: [item('9', 1000)] }
    const catalog = createProductCatalog(db, async () => next)
    assert.equal((await catalog.refresh(['5', '5'])).get('5')!.status, 'ready')
    next = { ok: false, code: 'TIMEOUT', retryable: true }
    const kept = (await catalog.refresh(['5'])).get('5')!
    assert.deepEqual([kept.status, kept.items[0]!.price], ['ready', 1000])
    assert.equal((await catalog.refresh(['6'])).get('6')!.status, 'pending')
    assert.deepEqual((await rows()).map(row => [row.id, row.status, row.attempts]), [['5', 'ready', 0], ['6', 'pending', 1]])
    const unconfigured = (await createProductCatalog(db).refresh(['7'])).get('7')!
    assert.deepEqual([unconfigured.status, unconfigured.errorCode], ['failed', 'NOT_CONFIGURED'])
  } finally { await pg.close() }
})

test('실행기는 대기열을 끝까지 비우고, 동시에 두 개까지만 조회하며, 실행 중 들어온 상품도 처리한다', async () => {
  const { pg, db, rows } = await setup()
  try {
    await pg.exec("INSERT INTO coupang_products (id) VALUES ('1'),('2'),('3'),('4'),('5')")
    let running = 0
    let most = 0
    const catalog = createProductCatalog(db, async () => {
      running++; most = Math.max(most, running)
      await new Promise(resolve => setTimeout(resolve, 5))
      running--
      return { ok: true, items: [item('9')] }
    })
    const runner = createLookupRunner(catalog)
    const first = runner.kick()
    await pg.exec("INSERT INTO coupang_products (id) VALUES ('6')")
    assert.equal(runner.kick(), first)
    await first
    assert.equal(most, 2)
    assert.ok((await rows()).every(row => row.status === 'ready'))
  } finally { await pg.close() }
})

test('실행기의 DB 오류는 원문 없이 알리고, 다음 kick에서 다시 시도한다', async () => {
  let failures = 0
  let claims = 0
  const runner = createLookupRunner({
    claim: async () => { claims++; if (claims === 1) throw new Error('db-secret'); return [] },
    process: async () => {},
  }, { onFailure: () => { failures++ } })
  await runner.kick()
  await runner.kick()
  assert.deepEqual([failures, claims], [1, 2])
})
