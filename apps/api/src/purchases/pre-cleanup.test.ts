import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { PurchaseItemsResponse, PurchaseReviewResponse } from '@vada/contracts'
import { createApp } from '../app.js'
import { migrationsBefore } from '../db/test-migrations.js'
import { createDeliveryRoutes } from '../deliveries/routes.js'
import { link, origin, setupPurchases } from './test-setup.js'

// 새 코드를 먼저 배포하고 0013은 나중에 적용한다. 그 사이 DB에는 옛 표와 request_id 칸이 남아 있다.
test('0013을 적용하기 전(0012까지) DB에서도 담기·제출·승인·송장 연결이 된다', async () => {
  const previous = migrationsBefore('0013_purchase_cleanup')
  const { pg, db, request, ok, submitted, as } = await setupPurchases(previous.folder)
  try {
    assert.notEqual((await pg.query<{ table: string | null }>("SELECT to_regclass('public.purchase_requests') AS table")).rows[0]?.table, null)
    const [item] = await submitted([link(1)])
    as('f')
    await ok<PurchaseItemsResponse>(request('POST', '/purchase-review/decisions', { decisions: [{ id: item!.id, version: item!.version, decision: 'approved' }] }))
    const provider = {
      carriers: async () => ({ carriers: [], nextCursor: null }),
      lookup: async () => ({ status: 'in_transit' as const, providerStatus: 'IN_TRANSIT', lastEventAt: null, checkedAt: '2026-10-09T00:00:00.000Z' }),
    }
    const deliveries = createApp({ auth: { handler: async () => new Response() }, trustedOrigin: origin,
      deliveries: createDeliveryRoutes(db, async () => ({ user: { id: 'f' } }), provider) })
    const registered = await deliveries.request('/api/organizations/a/shipments', { method: 'POST',
      headers: { Origin: origin, 'Content-Type': 'application/json' },
      body: JSON.stringify({ carrierId: 'kr.coupangls', trackingNumber: '000123456789', purchaseItemIds: [item!.id], idempotencyKey: crypto.randomUUID() }) })
    assert.equal(registered.status, 201)
    const review = await ok<PurchaseReviewResponse>(request('GET', '/purchase-review'))
    assert.equal(review.approved.length, 1)
    assert.ok(review.approved[0]!.purchasedAt)
    assert.equal(review.approved[0]!.shipments.length, 1)
    assert.deepEqual((await pg.query('SELECT request_id FROM shipment_items')).rows, [{ request_id: null }])
  } finally {
    await pg.close()
    previous.remove()
  }
})
