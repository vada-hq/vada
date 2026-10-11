import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { PurchaseReviewResponse } from '@vada/contracts'
import { link, setupPurchases } from './test-setup.js'

const review = '/purchase-review'

test('구매 검토 목록: 재정부와 회장단만 보고, 대기는 제출 순, 살 품목은 받을 날짜 순이다', async () => {
  const { pg, request, ok, submitted, as } = await setupPurchases()
  try {
    const [first] = await submitted([link(1)])
    as('q')
    const later = await submitted([link(2), link(3)])
    for (const userId of ['p', 'n', 'x']) {
      as(userId)
      assert.equal((await request('GET', review)).status, 403, userId)
    }
    as(null); assert.equal((await request('GET', review)).status, 401)
    as('l')
    const list = await ok<PurchaseReviewResponse>(request('GET', review))
    assert.deepEqual(list.pending.map(item => item.id), [first!.id, ...later.map(item => item.id)])
    assert.deepEqual(list.pending.map(item => [item.requester.name, item.departmentName, item.event.name]),
      [['기획', '기획부', '체육대회'], ['기획2', '기획부', '체육대회'], ['기획2', '기획부', '체육대회']])
    assert.equal(list.truncated, false)
    const all = [first!, ...later]
    await ok(request('POST', `${review}/decisions`, { decisions: all.map(item => ({ id: item.id, version: item.version, decision: 'approved' })) }))
    await pg.exec(`UPDATE purchase_items SET needed_by = '2026-10-20' WHERE id = '${first!.id}';
      UPDATE purchase_items SET needed_by = '2026-10-10' WHERE id = '${later[1]!.id}';`)
    const approved = await ok<PurchaseReviewResponse>(request('GET', review))
    assert.deepEqual(approved.pending, [])
    // 받을 날짜가 이른 순서이고, 날짜가 없으면 뒤다.
    assert.deepEqual(approved.approved.map(item => item.id), [later[1]!.id, first!.id, later[0]!.id])
  } finally { await pg.close() }
})

test('결정: 품목마다 승인·반려하고, 반려는 사유가 필요하며, 본인 승인도 기록한다', async () => {
  const { pg, request, ok, submitted, drafts, as } = await setupPurchases()
  try {
    const [keep, drop] = await submitted([link(1), link(2)])
    const decide = (decisions: unknown[]) => request('POST', `${review}/decisions`, { decisions })
    assert.equal((await decide([{ id: keep!.id, version: keep!.version, decision: 'approved' }])).status, 403)
    as('f')
    for (const decision of [{ decision: 'rejected' }, { decision: 'rejected', reason: '  ' }]) {
      assert.equal((await decide([{ id: drop!.id, version: drop!.version, ...decision }])).status, 400)
    }
    const decided = (await ok(decide([{ id: keep!.id, version: keep!.version, decision: 'approved' },
      { id: drop!.id, version: drop!.version, decision: 'rejected', reason: ' 규격 확인 ' }]))).items
    const byId = (id: string) => decided.find(item => item.id === id)!
    assert.deepEqual([byId(keep!.id).status, byId(keep!.id).decidedBy, byId(keep!.id).mine], ['approved', { id: 'f', name: '재정' }, false])
    assert.deepEqual([byId(drop!.id).status, byId(drop!.id).decisionReason], ['rejected', '규격 확인'])
    assert.equal((await pg.query("SELECT DISTINCT batch_id FROM purchase_item_events WHERE action IN ('approved','rejected')")).rows.length, 1)
    const again = await decide([{ id: keep!.id, version: byId(keep!.id).version, decision: 'rejected', reason: '다시' }])
    assert.equal(again.status, 409)
    assert.deepEqual(await again.json(), { error: 'INVALID_STATE' })
    // 재정부 본인의 품목도 결정할 수 있다(2026-10-08 결정). 요청자와 결정한 사람이 같다.
    const [own] = await submitted([link(3)])
    const self = (await ok(decide([{ id: own!.id, version: own!.version, decision: 'approved' }]))).items[0]!
    assert.deepEqual([self.requester.id, self.decidedBy?.id, self.mine], ['f', 'f', true])
    // 버전이 하나라도 다르면 한 품목도 바꾸지 않는다.
    as('p')
    const [a, b] = await submitted([link(4), link(5)])
    as('f')
    const stale = await decide([{ id: a!.id, version: a!.version, decision: 'approved' }, { id: b!.id, version: b!.version + 1, decision: 'approved' }])
    assert.equal(stale.status, 409)
    assert.deepEqual(await stale.json(), { error: 'VERSION_CONFLICT' })
    assert.deepEqual((await pg.query('SELECT DISTINCT status FROM purchase_items WHERE id IN ($1, $2)', [a!.id, b!.id])).rows, [{ status: 'pending' }])
    // 남의 작성 중 품목은 없는 것으로 보고, 다른 학생회 사용자는 막는다.
    as('p')
    const [secret] = await drafts([link(6)])
    as('f')
    assert.equal((await decide([{ id: secret!.id, version: 1, decision: 'approved' }])).status, 404)
    as('x')
    assert.equal((await decide([{ id: a!.id, version: a!.version, decision: 'approved' }])).status, 403)
  } finally { await pg.close() }
})

test('승인 취소와 구매함 표시: 구매 전에만 승인을 취소하고, 송장이 연결되면 구매 표시도 되돌릴 수 없다', async () => {
  const { pg, request, ok, submitted, as } = await setupPurchases()
  try {
    const items = await submitted([link(1), link(2)])
    as('f')
    const approved = (await ok(request('POST', `${review}/decisions`, { decisions: items.map(item => ({ id: item.id, version: item.version, decision: 'approved' })) }))).items
    const one = approved.find(item => item.id === items[0]!.id)!
    const two = approved.find(item => item.id === items[1]!.id)!
    const revoked = (await ok(request('POST', `${review}/${one.id}/revoke`, { version: one.version }))).items[0]!
    assert.deepEqual([revoked.status, revoked.decidedBy, revoked.decidedAt], ['pending', null, null])
    const bought = (await ok(request('POST', `${review}/${two.id}/purchased`, { version: two.version, purchased: true }))).items[0]!
    assert.ok(bought.purchasedAt)
    assert.equal((await request('POST', `${review}/${two.id}/purchased`, { version: bought.version, purchased: true })).status, 409)
    const cannotRevoke = await request('POST', `${review}/${two.id}/revoke`, { version: bought.version })
    assert.deepEqual([cannotRevoke.status, await cannotRevoke.json()], [409, { error: 'INVALID_STATE' }])
    await pg.exec(`INSERT INTO shipments (id, organization_id, carrier_id, tracking_number, created_by) VALUES ('s1', 'a', 'kr.cjlogistics', '123', 'f');
      INSERT INTO shipment_items (id, shipment_id, purchase_item_id, organization_id, linked_by) VALUES ('l1', 's1', '${two.id}', 'a', 'f');`)
    const shipped = await request('POST', `${review}/${two.id}/purchased`, { version: bought.version, purchased: false })
    assert.deepEqual([shipped.status, await shipped.json()], [409, { error: 'ALREADY_SHIPPED' }])
    await pg.exec("UPDATE shipment_items SET unlinked_at = now(), unlinked_by = 'f' WHERE id = 'l1'")
    const undone = (await ok(request('POST', `${review}/${two.id}/purchased`, { version: bought.version, purchased: false }))).items[0]!
    assert.equal(undone.purchasedAt, null)
    assert.deepEqual((await pg.query<{ action: string }>('SELECT action FROM purchase_item_events WHERE item_id = $1 ORDER BY created_at, id', [two.id])).rows
      .map(row => row.action), ['submitted', 'approved', 'purchased', 'purchase_undone'])
    as('p')
    assert.equal((await request('POST', `${review}/${one.id}/revoke`, { version: revoked.version })).status, 403)
  } finally { await pg.close() }
})

test('구매 검토의 대기·살 품목은 완료한 행사의 품목을 뺀다', async () => {
  const env = await setupPurchases()
  try {
    const [approvedId] = await env.approved([link(1)])
    env.as('p')
    await env.submitted([link(2)], 'e2')
    await env.pg.exec(`INSERT INTO event_finances(event_id, organization_id, settled_at, settled_by) VALUES ('e','a', now(), 'f');
      UPDATE events SET completed_at = now(), completed_by = 'l' WHERE id = 'e';`)
    env.as('f')
    const list = await env.ok<PurchaseReviewResponse>(env.request('GET', review))
    assert.ok(!list.approved.some(item => item.id === approvedId))
    assert.deepEqual(list.pending.map(item => item.event.id), ['e2'])
  } finally { await env.pg.close() }
})
