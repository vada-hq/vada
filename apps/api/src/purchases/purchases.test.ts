import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { EventPurchaseItemsResponse, PurchaseItemDetail } from '@vada/contracts'
import type { CoupangItem } from '../db/schema.js'
import { DUPLICATE_WARNING, OTHER_REQUEST_WARNING } from './service.js'
import { generated, link, lookedUp, setupPurchases } from './test-setup.js'

const base = '/events/e/purchase-items'

test('후보 담기: 후보마다 작성 중 품목을 만들고, 같은 키로 다시 보내면 새로 만들지 않는다', async () => {
  const { pg, request, ok, state, share, candidateOf } = await setupPurchases()
  try {
    await share(`${link(1)}\n${link(2)}`)
    const candidateIds = [await candidateOf(link(1)), await candidateOf(link(2))]
    const body = { idempotencyKey: 'key-1', candidateIds }
    const created = (await ok(request('POST', `${base}/drafts`, body), 201)).items
    assert.deepEqual(created.map(item => item.productUrl), [link(1), link(2)])
    assert.deepEqual(created.map(item => [item.status, item.version, item.mine, item.submissionId, item.requester]),
      [['draft', 1, true, null, { id: 'p', name: '기획' }], ['draft', 1, true, null, { id: 'p', name: '기획' }]])
    assert.deepEqual([created[0]!.note, created[0]!.estimatedUnitPrice, created[0]!.event], ['부스 설치', 11590, { id: 'e', name: '체육대회' }])
    const replay = (await ok(request('POST', `${base}/drafts`, body))).items
    assert.deepEqual(replay.map(item => item.id), created.map(item => item.id))
    assert.equal(state.calls, 1)
    const conflict = await request('POST', `${base}/drafts`, { ...body, candidateIds: [candidateIds[0]] })
    assert.equal(conflict.status, 409)
    assert.deepEqual(await conflict.json(), { error: 'IDEMPOTENCY_CONFLICT' })
    assert.equal(state.calls, 1)
    assert.deepEqual((await pg.query('SELECT message_id FROM purchase_item_sources WHERE item_id = $1', [created[0]!.id])).rows, [{ message_id: 'm' }])
    assert.deepEqual((await pg.query<{ candidate_id: string }>('SELECT candidate_id FROM purchase_items ORDER BY created_at DESC')).rows
      .map(row => row.candidate_id), candidateIds)
  } finally { await pg.close() }
})

test('후보 담기: 없는 후보·다른 행사의 후보·권한·실패는 품목을 남기지 않는다', async () => {
  const { pg, request, state, as, share, candidateOf } = await setupPurchases()
  try {
    await share(link(1))
    await share(link(2), 'e2')
    const mine = await candidateOf(link(1))
    const elsewhere = await candidateOf(link(2), 'e2')
    const post = (candidateIds: string[], path = `${base}/drafts`) => request('POST', path, { idempotencyKey: crypto.randomUUID(), candidateIds })
    assert.equal((await post([elsewhere])).status, 404)
    assert.equal((await post(['missing'])).status, 404)
    assert.deepEqual(await (await post([mine, mine])).json(), { error: 'INVALID_INPUT' })
    assert.equal((await post([mine], '/events/missing/purchase-items/drafts')).status, 404)
    assert.equal((await post([mine], '/events/ex/purchase-items/drafts')).status, 404)
    as(null); assert.equal((await post([mine])).status, 401)
    as('x'); assert.equal((await post([mine])).status, 403)
    as('p')
    assert.equal(state.calls, 0)
    state.generate = async () => { throw new Error('secret-provider-error') }
    const failed = await post([mine])
    assert.equal(failed.status, 502)
    assert.ok(!(await failed.text()).includes('secret'))
    // 다른 행사방의 메시지를 근거로 대면 저장하지 않는다.
    state.generate = async input => ({ items: input.links.map(url => generated(url, { sourceMessageIds: ['m2'] })) })
    assert.equal((await post([mine])).status, 502)
    assert.equal((await pg.query('SELECT id FROM purchase_items')).rows.length, 0)
    assert.equal((await pg.query('SELECT id FROM purchase_generations')).rows.length, 0)
  } finally { await pg.close() }
})

test('후보 담기: 같은 사람의 동시 생성은 한 건만 받는다', async () => {
  const { pg, request, state, share, candidateOf } = await setupPurchases()
  try {
    await share(`${link(1)} ${link(2)}`)
    let release!: () => void
    const blocked = new Promise<void>(resolve => { release = resolve })
    let started!: () => void
    const running = new Promise<void>(resolve => { started = resolve })
    state.generate = async input => { started(); await blocked; return { items: input.links.map(url => generated(url)) } }
    const first = request('POST', `${base}/drafts`, { idempotencyKey: 'one', candidateIds: [await candidateOf(link(1))] })
    await running
    const second = await request('POST', `${base}/drafts`, { idempotencyKey: 'two', candidateIds: [await candidateOf(link(2))] })
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

test('후보 담기: 저장된 조회 결과는 다시 조회하지 않고, 조회 전·실패한 상품만 그 자리에서 조회하며, 숨긴 후보도 담는다', async () => {
  const { pg, request, ok, state, share, ready, candidateOf } = await setupPurchases()
  try {
    // 실제 생성기처럼 받은 조회 결과를 품목에 쓴다.
    state.generate = async input => ({ items: input.links.map((url, index) => {
      const product = input.products[index]!
      return generated(url, { productName: product.name, estimatedUnitPrice: product.price, warnings: product.warning ? [product.warning] : [] })
    }) })
    await share(`${link(1)} ${link(2)}`)
    await ready('1001', [{ itemId: '2001', vendorItemId: '3001', name: '저장된 테이블', price: 9000, listPrice: null, discountPercent: null,
      inStock: true, deliveryEta: null, imageUrl: null }])
    const one = await candidateOf(link(1))
    const two = await candidateOf(link(2))
    await pg.query("UPDATE purchase_candidates SET hidden_by = 'q', hidden_at = now() WHERE id = $1", [two])
    state.fetch = async () => ({ ok: false, code: 'TIMEOUT', retryable: true })
    const created = (await ok(request('POST', `${base}/drafts`, { idempotencyKey: 'k', candidateIds: [one, two] }), 201)).items
    assert.equal(state.lookups, 1)
    assert.deepEqual(created.map(item => [item.productName, item.estimatedUnitPrice]), [['저장된 테이블', 9000], [null, null]])
    assert.ok(created[1]!.warnings.includes('상품 정보를 가져오지 못했어요. 상품명·옵션·가격을 직접 확인해 주세요.'))
  } finally { await pg.close() }
})

test('다른 구성원이 이미 제출한 후보를 담으면 경고하고 허용한다', async () => {
  const { pg, request, ok, drafts, as } = await setupPurchases()
  try {
    as('q')
    const [theirs] = await drafts([link(1)])
    await ok(request('POST', `${base}/submit`, { items: [{ id: theirs!.id, version: theirs!.version }] }))
    as('p')
    const [mine] = await drafts([link(1)])
    assert.ok(mine!.warnings.includes(OTHER_REQUEST_WARNING))
    assert.ok(!mine!.warnings.includes(DUPLICATE_WARNING))
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

test('제출: 하루 지난 조회 가격만 다시 조회해 새 가격으로 제출하고, 처리 기록에 이전·이후 가격을 남긴다', async () => {
  const { pg, request, ok, drafts, state } = await setupPurchases()
  try {
    const [stale, fresh, manual, noPrice, failing] = await drafts([link(1), link(2), link(3), link(4), link(5)])
    // 담을 때의 조회 시각은 가짜 생성기 기본값(2026-09-29)이다. fresh만 방금 조회한 것으로 바꾼다.
    await pg.query('UPDATE purchase_items SET product_fetched_at = now() WHERE id = $1', [fresh!.id])
    const edited = (await ok(request('PATCH', `${base}/${manual!.id}`, { version: manual!.version, estimatedUnitPrice: 5000 }))).items[0]!
    state.lookups = 0
    state.fetch = async productId => productId === '1005' ? { ok: false, code: 'TIMEOUT', retryable: true }
      : productId === '1004' ? { ok: true, items: [{ ...(lookedUp(productId) as { ok: true; items: CoupangItem[] }).items[0]!, price: null }] }
        : lookedUp(productId, 12000)
    const refs = [stale!, fresh!, edited, noPrice!, failing!].map(item => ({ id: item.id, version: item.version }))
    const submitted = (await ok(request('POST', `${base}/submit`, { items: refs }))).items
    const price = (id: string) => submitted.find(item => item.id === id)!.estimatedUnitPrice
    // 직접 고친 가격과 가격 없는 조회 결과, 실패한 조회는 원래 가격을 지킨다(Review Focus 4).
    assert.deepEqual([price(stale!.id), price(fresh!.id), price(manual!.id), price(noPrice!.id), price(failing!.id)], [12000, 11590, 5000, 11590, 11590])
    assert.equal(state.lookups, 3)
    const events = (await pg.query<{ item_id: string; changes: unknown }>("SELECT item_id, changes FROM purchase_item_events WHERE action = 'submitted'")).rows
    assert.deepEqual(events.find(row => row.item_id === stale!.id)!.changes, { estimatedUnitPrice: { from: 11590, to: 12000 } })
    assert.deepEqual(events.find(row => row.item_id === fresh!.id)!.changes, {})
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
    const candidates = (await pg.query<{ candidate_id: string | null }>('SELECT candidate_id FROM purchase_items WHERE id IN ($1, $2)',
      [cancelled.id, copy.id])).rows
    assert.equal(new Set(candidates.map(row => row.candidate_id)).size, 1)
    assert.ok(candidates[0]!.candidate_id)
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
