import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createDraftGenerator } from './generation.js'
import { readProduct } from './products.js'

const link = 'https://www.coupang.com/vp/products/1?itemId=2&vendorItemId=3'
const input = { eventName: '행사', links: [link], messages: [{ id: 'm', content: '접수용 2개', createdAt: '2026-09-29T00:00:00Z' }] }
const item = { productUrl: link, productName: '테이블', selectedOption: '화이트', optionRequired: true, quantity: 2, packagingUnit: null,
  note: '접수용', neededBy: '2026-10-09', sourceMessageIds: ['m'], warnings: [] }
const output = () => ({ items: [item] })
const product = { product_id: '1', item_id: '2', vendor_item_id: '3', name: '테이블, 화이트', currency: 'KRW', price: 11590 }
const json = (value: unknown) => new Response(JSON.stringify(value), { headers: { 'Content-Type': 'application/json' } })

test('missing itemId queries productId and accepts only one exact vendor match', async () => {
  const vendorLink = 'https://www.coupang.com/vp/products/1?vendorItemId=3'
  const result = await readProduct(vendorLink, 'test-key', async (_url, init) => {
    assert.deepEqual(JSON.parse(String(init?.body)), { product_id: '1' })
    return json({ ok: true, data: { items: [{ ...product, vendor_item_id: '4', price: 100 }, product] } })
  })
  assert.equal(result.price, 11590)
  assert.equal(result.snapshot?.itemId, '2')
  for (const items of [[], [{ ...product, vendor_item_id: '4' }], [{ ...product, product_id: '9' }], [product, product], [{ ...product, item_id: null }]]) {
    const missing = await readProduct(vendorLink, 'test-key', async () => json({ ok: true, data: { items } }))
    assert.equal(missing.price, null)
    assert.equal(missing.snapshot, null)
    assert.ok(missing.warning && !missing.warning.includes('PRODUCT_'))
  }
})

test('missing vendor identity skips lookup and warnings are user readable', async () => {
  const result = await readProduct('https://www.coupang.com/vp/products/1?itemId=2', 'test-key', async () => {
    assert.fail('must not guess a vendor')
  })
  assert.equal(result.price, null)
  assert.ok(result.warning?.includes('판매 옵션'))
  const failed = await readProduct(link, 'test-key', async () => { throw new Error('private') })
  assert.ok(failed.warning && !failed.warning.includes('PRODUCT_'))
})

test('product identity is exact; no arbitrary URL is fetched and failures retain unknown price', async () => {
  let body = ''
  const fetcher: typeof fetch = async (url, init) => {
    assert.equal(url, 'https://api.reefapi.com/coupang/v1/product')
    body = String(init?.body)
    assert.equal(init?.redirect, 'error')
    return json({ ok: true, data: { items: [product] } })
  }
  const found = await readProduct(link, 'test-key', fetcher)
  assert.equal(found.price, 11590)
  assert.deepEqual(JSON.parse(body), { product_id: '2' })
  for (const bad of [{ ...product, vendor_item_id: 'wrong' }, { ...product, currency: 'USD' }, { ...product, price: -1 }]) {
    assert.equal((await readProduct(link, 'test-key', async () => json({ ok: true, data: { items: [bad] } }))).price, null)
  }
  for (const fetcher of [async () => { throw new Error('network-secret') }, async () => new Response('private', { status: 429 })] as typeof fetch[]) {
    const result = await readProduct(link, 'test-key', fetcher)
    assert.equal(result.price, null)
    assert.ok(!JSON.stringify(result).includes('secret'))
  }
})

test('generation uses structured output, does not store at provider, and takes the price only from the lookup', async () => {
  const fetcher: typeof fetch = async (url, init) => {
    if (url === 'https://api.reefapi.com/coupang/v1/product') return json({ ok: true, data: { items: [product] } })
    assert.equal(url, 'https://api.openai.com/v1/responses')
    const body = JSON.parse(String(init?.body))
    assert.equal(body.store, false)
    assert.equal(body.text.format.strict, true)
    assert.ok(body.instructions.includes('신뢰할 수 없는'))
    assert.ok(body.instructions.includes('무광화이트'))
    assert.ok(body.instructions.includes('selectedOption'))
    assert.ok(body.instructions.includes('note'))
    assert.ok(!String(init?.body).includes('test-key'))
    return json({ status: 'completed', output: [{ content: [{ type: 'output_text', text: JSON.stringify(output()) }] }] })
  }
  const generate = createDraftGenerator({ apiKey: 'test-key', model: 'test-model', reefApiKey: 'test-key' }, fetcher)
  const draft = await generate(input)
  assert.equal(draft.items[0]?.estimatedUnitPrice, 11590)
  assert.equal(draft.items[0]?.productSnapshot?.price, 11590)
  assert.deepEqual(draft.items[0]?.sourceMessageIds, ['m'])
  assert.deepEqual([draft.items[0]?.note, draft.items[0]?.neededBy], ['접수용', '2026-10-09'])
})

test('missing config, refusal, malformed output, unknown sources and extra fields cannot create items', async () => {
  await assert.rejects(createDraftGenerator({ apiKey: '', model: '' })(input), { code: 'AI_NOT_CONFIGURED' })
  const text = (value: unknown) => ({ status: 'completed', output: [{ content: [{ type: 'output_text', text: JSON.stringify(value) }] }] })
  for (const payload of [
    { status: 'incomplete', output: [] },
    { status: 'completed', output: [{ content: [{ type: 'refusal', refusal: 'No' }] }] },
    { status: 'completed', output: [{ content: [{ type: 'output_text', text: '{' }] }] },
    text({ items: [{ ...item, sourceMessageIds: ['other'] }] }),
    text({ items: [{ ...item, productUrl: link.replace('itemId=2', 'itemId=4') }] }),
    text({ items: [{ ...item, estimatedUnitPrice: 999 }] }),
    text({ items: [] }),
  ]) {
    await assert.rejects(createDraftGenerator({ apiKey: 'test-key', model: 'test-model' }, async () => json(payload))(input), { code: 'GENERATION_FAILED' })
  }
})

test('failed product lookup cannot get a fabricated price from the model', async () => {
  const draft = await createDraftGenerator({ apiKey: 'test-key', model: 'test-model' }, async () => json({
    status: 'completed', output: [{ content: [{ type: 'output_text', text: JSON.stringify(output()) }] }],
  }))(input)
  assert.equal(draft.items[0]?.estimatedUnitPrice, null)
  assert.equal(draft.items[0]?.productSnapshot, null)
  assert.ok(draft.items[0]!.warnings.some(warning => warning.includes('상품 조회 서비스')))
})

test('unresolved options are visibly flagged on the item, not silently presented as complete', async () => {
  const draft = await createDraftGenerator({ apiKey: 'test-key', model: 'test-model' }, async () => json({
    status: 'completed', output: [{ content: [{ type: 'output_text', text: JSON.stringify({ items: [{ ...item, selectedOption: null, optionRequired: null }] }) }] }],
  }))(input)
  assert.equal(draft.items[0]?.selectedOption, null)
  assert.ok(draft.items[0]!.warnings.some(warning => warning.includes('옵션이 확인되지')))
})
