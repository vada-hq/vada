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

test('작성 중 품목 고치기·지우기: 본인 작성 중 품목만, 버전이 맞을 때만', async () => {
  const { pg, request, ok, drafts, as } = await setupPurchases()
  try {
    const [item] = await drafts([link(1)])
    const path = `${base}/${item!.id}`
    const updated = (await ok(request('PATCH', path, { version: 1, quantity: 5, note: '  계주 바통  ', selectedOption: null }))).items[0]!
    assert.deepEqual([updated.quantity, updated.note, updated.selectedOption, updated.version], [5, '계주 바통', null, 2])
    const stale = await request('PATCH', path, { version: 1, quantity: 6 })
    assert.equal(stale.status, 409)
    assert.deepEqual(await stale.json(), { error: 'VERSION_CONFLICT' })
    for (const body of [{ version: 2 }, { version: 2, status: 'approved' }, { version: 2, note: '😀'.repeat(201) }, { version: 2, note: 'a\u0000' },
      { version: 2, quantity: 0 }, { version: 2, neededBy: '2026-10-10' }]) {
      assert.equal((await request('PATCH', path, body)).status, 400, JSON.stringify(body))
    }
    as('q')
    assert.equal((await request('PATCH', path, { version: 2, quantity: 1 })).status, 404)
    assert.equal((await request('POST', `${path}/delete`, { version: 2 })).status, 404)
    as('p')
    assert.deepEqual(await ok(request('POST', `${path}/delete`, { version: 2 })), { items: [] })
    assert.equal((await pg.query('SELECT id FROM purchase_items')).rows.length, 0)
    assert.equal((await pg.query('SELECT item_id FROM purchase_item_sources')).rows.length, 0)
  } finally { await pg.close() }
})

test('제출: 고른 작성 중 품목을 한 묶음으로 제출하고 부서와 기록을 남긴다', async () => {
  const { pg, request, ok, drafts, as } = await setupPurchases()
  try {
    const [first, second] = await drafts([link(1), link(2)])
    await ok(request('PATCH', `${base}/${second!.id}`, { version: 1, quantity: null }))
    const incomplete = await request('POST', `${base}/submit`, { items: [{ id: first!.id, version: 1 }, { id: second!.id, version: 2 }] })
    assert.equal(incomplete.status, 400)
    assert.deepEqual(await incomplete.json(), { error: 'SUBMISSION_INCOMPLETE' })
    assert.deepEqual((await pg.query('SELECT DISTINCT status FROM purchase_items')).rows, [{ status: 'draft' }])
    await ok(request('PATCH', `${base}/${second!.id}`, { version: 2, quantity: 3 }))
    const result = (await ok(request('POST', `${base}/submit`, { items: [{ id: first!.id, version: 1 }, { id: second!.id, version: 3 }] }))).items
    assert.deepEqual(result.map(item => item.status), ['pending', 'pending'])
    assert.equal(new Set(result.map(item => item.submissionId)).size, 1)
    assert.ok(result.every(item => item.departmentName === '기획부' && item.submittedAt))
    const events = (await pg.query<{ action: string; batch_id: string }>('SELECT action, batch_id FROM purchase_item_events')).rows
    assert.deepEqual(events.map(row => [row.action, row.batch_id]), result.map(item => ['submitted', item.submissionId]))
    const again = await request('POST', `${base}/submit`, { items: [{ id: first!.id, version: 2 }] })
    assert.equal(again.status, 409)
    assert.deepEqual(await again.json(), { error: 'INVALID_STATE' })
    // 미배정 구성원도 제출한다. 요청 부서는 비어 있다.
    as('n')
    const [unassigned] = await drafts([link(3)])
    const submitted = (await ok(request('POST', `${base}/submit`, { items: [{ id: unassigned!.id, version: 1 }] }))).items[0]!
    assert.equal(submitted.departmentName, null)
    // 제출된 품목은 학생회 누구나 본다.
    as('q')
    assert.equal((await ok<EventPurchaseItemsResponse>(request('GET', base))).items.length, 3)
  } finally { await pg.close() }
})

test('받을 날짜: 작성 중에는 기록 없이, 제출 뒤에는 기록하고 날짜 바뀜을 표시한다', async () => {
  const { pg, request, ok, drafts, submitted } = await setupPurchases()
  try {
    const [draft] = await drafts([link(1)])
    const changed = (await ok(request('POST', `${base}/needed-by`, { items: [{ id: draft!.id, version: 1 }], neededBy: '2026-10-20' }))).items[0]!
    assert.deepEqual([changed.neededBy, changed.neededByChanged], ['2026-10-20', false])
    const [pending] = await submitted([link(2)])
    const moved = (await ok(request('POST', `${base}/needed-by`, { items: [{ id: pending!.id, version: pending!.version }], neededBy: '2026-10-25' }))).items[0]!
    assert.deepEqual([moved.neededBy, moved.neededByChanged], ['2026-10-25', true])
    assert.deepEqual((await pg.query("SELECT changes FROM purchase_item_events WHERE action = 'needed_by_changed'")).rows,
      [{ changes: { from: null, to: '2026-10-25' } }])
    await pg.exec(`UPDATE purchase_items SET status = 'approved', decided_by = 'f', decided_at = now(), purchased_by = 'f', purchased_at = now() WHERE id = '${pending!.id}'`)
    assert.equal((await request('POST', `${base}/needed-by`, { items: [{ id: pending!.id, version: moved.version }], neededBy: '2026-11-01' })).status, 409)
    for (const neededBy of ['2026-02-30', '2026-1-1']) {
      assert.equal((await request('POST', `${base}/needed-by`, { items: [{ id: draft!.id, version: 2 }], neededBy })).status, 400, neededBy)
    }
  } finally { await pg.close() }
})

test('요청 취소와 다시 담기: 원래 품목은 남기고 같은 내용의 작성 중 품목을 만든다', async () => {
  const { pg, request, ok, submitted, as } = await setupPurchases()
  try {
    const [item] = await submitted([link(1)])
    as('q')
    assert.equal((await request('POST', `${base}/${item!.id}/cancel`, { version: item!.version })).status, 404)
    as('p')
    const cancelled = (await ok(request('POST', `${base}/${item!.id}/cancel`, { version: item!.version }))).items[0]!
    assert.equal(cancelled.status, 'cancelled')
    assert.equal((await request('POST', `${base}/${item!.id}/cancel`, { version: cancelled.version })).status, 409)
    await pg.exec(`UPDATE purchase_items SET needed_by = '2020-01-01' WHERE id = '${item!.id}'`)
    const result = (await ok(request('POST', `${base}/${item!.id}/re-add`, { version: cancelled.version }))).items
    const original = result.find(row => row.id === item!.id)!
    const copy = result.find(row => row.id !== item!.id)!
    assert.deepEqual([original.status, original.version], ['cancelled', cancelled.version + 1])
    assert.deepEqual([copy.status, copy.productUrl, copy.quantity, copy.note, copy.neededBy, copy.submissionId], ['draft', link(1), 2, '부스 설치', null, null])
    assert.deepEqual((await pg.query('SELECT message_id FROM purchase_item_sources WHERE item_id = $1', [copy.id])).rows, [{ message_id: 'm' }])
    assert.deepEqual((await pg.query<{ action: string }>('SELECT action FROM purchase_item_events WHERE item_id = $1 ORDER BY created_at, id', [item!.id])).rows
      .map(row => row.action), ['submitted', 'cancelled', 're_added'])
    assert.equal((await request('POST', `${base}/${copy.id}/re-add`, { version: 1 })).status, 409)
  } finally { await pg.close() }
})

test('수령 확인: 구매함 표시된 품목에 학생회 누구나 하고, 누가 했는지 남긴다', async () => {
  const { pg, request, ok, submitted, as } = await setupPurchases()
  try {
    const [item] = await submitted([link(1)])
    const path = `${base}/${item!.id}/received`
    assert.equal((await request('POST', path, { version: item!.version, received: true })).status, 409)
    await pg.exec(`UPDATE purchase_items SET status = 'approved', decided_by = 'f', decided_at = now(), purchased_by = 'f', purchased_at = now() WHERE id = '${item!.id}'`)
    as('q')
    const received = (await ok(request('POST', path, { version: item!.version, received: true }))).items[0]!
    assert.deepEqual([received.receivedBy, Boolean(received.receivedAt)], [{ id: 'q', name: '기획2' }, true])
    assert.equal((await request('POST', path, { version: received.version, received: true })).status, 409)
    const undone = (await ok(request('POST', path, { version: received.version, received: false }))).items[0]!
    assert.deepEqual([undone.receivedAt, undone.receivedBy], [null, null])
    assert.deepEqual((await pg.query("SELECT action, actor_id FROM purchase_item_events WHERE item_id = $1 AND action LIKE 'rec%' ORDER BY created_at, id", [item!.id])).rows,
      [{ action: 'received', actor_id: 'q' }, { action: 'receipt_undone', actor_id: 'q' }])
    as('x'); assert.equal((await request('POST', path, { version: undone.version, received: true })).status, 403)
  } finally { await pg.close() }
})

test('행사 목록의 송장번호는 재정부에게만 전부 보인다', async () => {
  const { pg, request, ok, submitted, as } = await setupPurchases()
  try {
    const [item] = await submitted([link(1)])
    await pg.exec(`
      UPDATE purchase_items SET status = 'approved', decided_by = 'f', decided_at = now(), purchased_by = 'f', purchased_at = now() WHERE id = '${item!.id}';
      INSERT INTO shipments (id, organization_id, carrier_id, tracking_number, created_by, status) VALUES ('s1', 'a', 'kr.cjlogistics', '000123456789', 'f', 'in_transit');
      INSERT INTO shipment_items (id, shipment_id, purchase_item_id, organization_id, linked_by) VALUES ('l1', 's1', '${item!.id}', 'a', 'f');
    `)
    const seen = async () => (await ok<EventPurchaseItemsResponse>(request('GET', base))).items[0]!.shipments
    assert.deepEqual((await seen()).map(shipment => [shipment.trackingNumber, shipment.trackingNumberMasked, shipment.status]),
      [['********6789', true, 'in_transit']])
    as('f')
    assert.deepEqual((await seen()).map(shipment => shipment.trackingNumber), ['000123456789'])
  } finally { await pg.close() }
})
