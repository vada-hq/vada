import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createDraftGenerator } from './generation.js'

const link = 'https://www.coupang.com/vp/products/1?itemId=2&vendorItemId=3'
const found = { name: '테이블, 화이트', price: 11590, snapshot: { provider: 'reef', price: 11590 }, fetchedAt: new Date('2026-09-29T00:00:00Z'), warning: null }
const input = { eventName: '행사', links: [link], products: [found], messages: [{ id: 'm', content: '접수용 2개', createdAt: '2026-09-29T00:00:00Z' }] }
const item = { productUrl: link, productName: '테이블', selectedOption: '화이트', optionRequired: true, quantity: 2, packagingUnit: null,
  note: '접수용', neededBy: '2026-10-09', sourceMessageIds: ['m'], warnings: [] }
const output = () => ({ items: [item] })
const json = (value: unknown) => new Response(JSON.stringify(value), { headers: { 'Content-Type': 'application/json' } })

test('generation uses structured output, does not store at provider, and takes the price only from the lookup', async () => {
  const fetcher: typeof fetch = async (url, init) => {
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
  const generate = createDraftGenerator({ apiKey: 'test-key', model: 'test-model' }, fetcher)
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

test('조회하지 못한 상품은 모델이 가격을 지어낼 수 없고 조회 경고가 품목에 붙는다', async () => {
  const failed = { name: null, price: null, snapshot: null, fetchedAt: null, warning: '상품 정보를 가져오지 못했어요. 상품명·옵션·가격을 직접 확인해 주세요.' }
  const draft = await createDraftGenerator({ apiKey: 'test-key', model: 'test-model' }, async () => json({
    status: 'completed', output: [{ content: [{ type: 'output_text', text: JSON.stringify(output()) }] }],
  }))({ ...input, products: [failed] })
  assert.equal(draft.items[0]?.estimatedUnitPrice, null)
  assert.equal(draft.items[0]?.productSnapshot, null)
  assert.ok(draft.items[0]!.warnings.includes(failed.warning))
})

test('unresolved options are visibly flagged on the item, not silently presented as complete', async () => {
  const draft = await createDraftGenerator({ apiKey: 'test-key', model: 'test-model' }, async () => json({
    status: 'completed', output: [{ content: [{ type: 'output_text', text: JSON.stringify({ items: [{ ...item, selectedOption: null, optionRequired: null }] }) }] }],
  }))(input)
  assert.equal(draft.items[0]?.selectedOption, null)
  assert.ok(draft.items[0]!.warnings.some(warning => warning.includes('옵션이 확인되지')))
})
