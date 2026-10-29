import assert from 'node:assert/strict'
import { test } from 'node:test'
import { menuPath, parseAppPath } from './paths.js'
import { PurchaseRequestListQuerySchema } from './purchases.js'
import { purchaseProgressOf, purchaseStageOf } from './purchase-progress.js'

test('구매 범위는 none·UUID만 받고 주소에서 보기·보드와 함께 왕복한다', () => {
  const council = '0199d1a0-0000-7000-8000-000000000001'
  const event = '0199d1a0-0000-7000-8000-000000000002'
  for (const scope of ['none', event]) {
    assert.equal(
      PurchaseRequestListQuerySchema.safeParse({ view: 'all', event: scope }).success,
      true,
    )
    const query = { view: 'mine', scope, board: 'items' }
    assert.deepEqual(parseAppPath(menuPath('purchases', council, query)), {
      type: 'menu',
      menu: 'purchases',
      councilId: council,
      query,
    })
  }
  for (const event of ['', 'NONE', 'other', 'none\0'])
    assert.equal(PurchaseRequestListQuerySchema.safeParse({ view: 'all', event }).success, false)
})

test('목록·상세의 결제 판정은 같고 미결재·일부 결제를 완료로 세지 않는다', () => {
  const facts = { decided: false, paid: false, partlyPaid: false, hasShipment: false }
  const item = { status: 'approved' as const, paid: true }
  assert.deepEqual(
    purchaseProgressOf({ items: [item, { status: 'pending', paid: false }], shipments: [] }),
    {
      ...facts,
      partlyPaid: true,
    },
  )
  assert.equal(
    purchaseStageOf({ status: 'pending', progress: { ...facts, partlyPaid: true } }),
    'pending',
  )
  assert.equal(
    purchaseStageOf({
      status: 'approved',
      progress: { ...facts, decided: true, partlyPaid: true },
    }),
    'unpaid',
  )
  assert.equal(
    purchaseStageOf({ status: 'partial', progress: { ...facts, decided: true, paid: true } }),
    'paid',
  )
  for (const status of ['rejected', 'cancelled'] as const)
    assert.equal(purchaseStageOf({ status, progress: facts }), 'closed')
  assert.deepEqual(
    purchaseProgressOf({ items: [item], shipments: [{ cancelledAt: '2026-10-25T03:00:00Z' }] }),
    {
      ...facts,
      decided: true,
      paid: true,
    },
  )
})
