import assert from 'node:assert/strict'
import { test, type TestContext } from 'node:test'
import type { CoupangProduct } from '@vada/contracts'
import type { LookupResult } from './reef.js'
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
