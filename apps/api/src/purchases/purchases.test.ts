import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { EventPurchaseItemsResponse, PurchaseItemDetail } from '@vada/contracts'
import { DUPLICATE_WARNING } from './service.js'
import { generated, link, setupPurchases } from './test-setup.js'

const base = '/events/e/purchase-items'

test('끼룩이 담기: 링크마다 작성 중 품목을 만들고, 같은 키로 다시 보내면 새로 만들지 않는다', async () => {
  const { pg, request, ok, state } = await setupPurchases()
  try {
    const body = { idempotencyKey: 'key-1', links: [link(1), link(2)] }
    const created = (await ok(request('POST', `${base}/drafts`, body), 201)).items
    assert.deepEqual(created.map(item => item.productUrl), [link(1), link(2)])
    assert.deepEqual(created.map(item => [item.status, item.version, item.mine, item.submissionId, item.requester]),
      [['draft', 1, true, null, { id: 'p', name: '기획' }], ['draft', 1, true, null, { id: 'p', name: '기획' }]])
    assert.deepEqual([created[0]!.note, created[0]!.estimatedUnitPrice, created[0]!.event], ['부스 설치', 11590, { id: 'e', name: '체육대회' }])
    const replay = (await ok(request('POST', `${base}/drafts`, body))).items
    assert.deepEqual(replay.map(item => item.id), created.map(item => item.id))
    assert.equal(state.calls, 1)
    const conflict = await request('POST', `${base}/drafts`, { ...body, links: [link(3)] })
    assert.equal(conflict.status, 409)
    assert.deepEqual(await conflict.json(), { error: 'IDEMPOTENCY_CONFLICT' })
    assert.equal(state.calls, 1)
    assert.deepEqual((await pg.query('SELECT message_id FROM purchase_item_sources WHERE item_id = $1', [created[0]!.id])).rows, [{ message_id: 'm' }])
  } finally { await pg.close() }
})

test('끼룩이 담기: 잘못된 링크·권한·실패는 품목을 남기지 않는다', async () => {
  const { pg, request, state, as } = await setupPurchases()
  try {
    const post = (links: string[], path = `${base}/drafts`) => request('POST', path, { idempotencyKey: crypto.randomUUID(), links })
    const invalid = await post(['https://example.test/vp/products/1'])
    assert.equal(invalid.status, 400)
    assert.deepEqual(await invalid.json(), { error: 'INVALID_PRODUCT_LINK' })
    assert.deepEqual(await (await post([link(1), link(1)])).json(), { error: 'DUPLICATE_LINK' })
    assert.equal((await post([link(1)], '/events/missing/purchase-items/drafts')).status, 404)
    assert.equal((await post([link(1)], '/events/ex/purchase-items/drafts')).status, 404)
    as(null); assert.equal((await post([link(1)])).status, 401)
    as('x'); assert.equal((await post([link(1)])).status, 403)
    as('p')
    assert.equal(state.calls, 0)
    state.generate = async () => { throw new Error('secret-provider-error') }
    const failed = await post([link(1)])
    assert.equal(failed.status, 502)
    assert.ok(!(await failed.text()).includes('secret'))
    // 다른 행사방의 메시지를 근거로 대면 저장하지 않는다.
    state.generate = async input => ({ items: input.links.map(url => generated(url, { sourceMessageIds: ['m2'] })) })
    assert.equal((await post([link(1)])).status, 502)
    assert.equal((await pg.query('SELECT id FROM purchase_items')).rows.length, 0)
    assert.equal((await pg.query('SELECT id FROM purchase_generations')).rows.length, 0)
  } finally { await pg.close() }
})

test('끼룩이 담기: 같은 사람의 동시 생성은 한 건만 받는다', async () => {
  const { pg, request, state } = await setupPurchases()
  try {
    let release!: () => void
    const blocked = new Promise<void>(resolve => { release = resolve })
    let started!: () => void
    const running = new Promise<void>(resolve => { started = resolve })
    state.generate = async input => { started(); await blocked; return { items: input.links.map(url => generated(url)) } }
    const first = request('POST', `${base}/drafts`, { idempotencyKey: 'one', links: [link(1)] })
    await running
    const second = await request('POST', `${base}/drafts`, { idempotencyKey: 'two', links: [link(2)] })
    assert.equal(second.status, 409)
    assert.deepEqual(await second.json(), { error: 'GENERATION_IN_PROGRESS' })
    release()
    assert.equal((await first).status, 201)
  } finally { await pg.close() }
})

test('같은 행사에서 이미 담은 상품을 또 담으면 확인할 점을 붙인다', async () => {
  const { pg, drafts, state } = await setupPurchases()
  try {
    const [first] = await drafts([link(1)])
    assert.deepEqual(first!.warnings, [])
    const [again] = await drafts([link(1)])
    assert.ok(again!.warnings.includes(DUPLICATE_WARNING))
    // 다른 행사방에는 e의 메시지가 없으므로 근거 없이 만든다.
    state.generate = async input => ({ items: input.links.map(url => generated(url, { sourceMessageIds: [] })) })
    const [other] = await drafts([link(1)], 'e2')
    assert.deepEqual(other!.warnings, [])
  } finally { await pg.close() }
})

test('목록과 상세: 작성 중 품목은 본인만 보고, 남의 작성 중 품목은 없는 것으로 본다', async () => {
  const { pg, request, ok, drafts, as } = await setupPurchases()
  try {
    const [mine] = await drafts([link(1)])
    as('q')
    assert.deepEqual(await ok<EventPurchaseItemsResponse>(request('GET', base)), { items: [], truncated: false })
    assert.equal((await request('GET', `${base}/${mine!.id}`)).status, 404)
    as('p')
    const own = await ok<EventPurchaseItemsResponse>(request('GET', base))
    assert.deepEqual(own.items.map(item => item.id), [mine!.id])
    const { item } = await ok<{ item: PurchaseItemDetail }>(request('GET', `${base}/${mine!.id}`))
    assert.deepEqual(item.sources.map(source => [source.id, source.authorName]), [['m', '기획']])
    assert.deepEqual(item.history, [])
    assert.equal((await request('GET', `/events/e2/purchase-items/${mine!.id}`)).status, 404)
    for (const id of ['%00', 'x'.repeat(65)]) assert.equal((await request('GET', `${base}/${id}`)).status, 404, id)
    as('x'); assert.equal((await request('GET', base)).status, 403)
  } finally { await pg.close() }
})

test('목록은 최근 300개까지만 주고 잘렸다고 알린다', async () => {
  const { pg, request, ok } = await setupPurchases()
  try {
    await pg.exec(`INSERT INTO purchase_items (id, organization_id, event_id, requester_id, product_url)
      SELECT 'bulk-' || n, 'a', 'e', 'p', 'https://www.coupang.com/vp/products/' || n FROM generate_series(1, 301) AS n`)
    const list = await ok<EventPurchaseItemsResponse>(request('GET', base))
    assert.equal(list.items.length, 300)
    assert.equal(list.truncated, true)
  } finally { await pg.close() }
})
