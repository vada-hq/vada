import assert from 'node:assert/strict'
import { test } from 'node:test'
import { WON_MAX } from './budget.js'
import {
  CreatePurchaseRequestSchema,
  PURCHASE_QUANTITY_MAX,
  purchaseEstimateOf,
  purchaseEstimatesOf,
} from './purchases.js'

const input = (item: object) => ({
  title: '새터 준비',
  items: [{ name: '음료', quantity: 2, ...item }],
})

test('예상 금액은 0과 미확인, 배송비를 구분한다', () => {
  assert.deepEqual(purchaseEstimateOf({ quantity: 2 }), { subtotal: null, total: null })
  assert.deepEqual(purchaseEstimateOf({ quantity: 2, estimatedUnitPrice: 100 }), {
    subtotal: 200,
    total: null,
  })
  assert.deepEqual(
    purchaseEstimateOf({ quantity: 2, estimatedUnitPrice: 0, estimatedShippingFee: 0 }),
    { subtotal: 0, total: 0 },
  )
  assert.deepEqual(
    purchaseEstimateOf({ quantity: 2, estimatedUnitPrice: 100, estimatedShippingFee: 30 }),
    { subtotal: 200, total: 230 },
  )
  assert.deepEqual(
    purchaseEstimateOf({
      quantity: 999,
      estimatedUnitPrice: Number.MAX_SAFE_INTEGER,
      estimatedShippingFee: 1,
    }),
    { subtotal: null, total: null },
  )
})

test('예상 단가와 배송비는 선택이며 원단위 상한과 품목 합계를 검사한다', () => {
  assert.ok(CreatePurchaseRequestSchema.safeParse(input({})).success)
  assert.ok(
    CreatePurchaseRequestSchema.safeParse(
      input({ estimatedUnitPrice: null, estimatedShippingFee: null }),
    ).success,
  )
  assert.ok(
    CreatePurchaseRequestSchema.safeParse(
      input({ quantity: 1, estimatedUnitPrice: WON_MAX, estimatedShippingFee: 0 }),
    ).success,
  )
  for (const key of ['estimatedUnitPrice', 'estimatedShippingFee']) {
    for (const value of [-1, 0.1, WON_MAX + 1, Number.MAX_SAFE_INTEGER, '100'])
      assert.equal(CreatePurchaseRequestSchema.safeParse(input({ [key]: value })).success, false)
  }
  assert.equal(
    CreatePurchaseRequestSchema.safeParse(input({ estimatedUnitPrice: WON_MAX })).success,
    false,
  )
  assert.equal(
    CreatePurchaseRequestSchema.safeParse(
      input({ quantity: 1, estimatedUnitPrice: WON_MAX, estimatedShippingFee: 1 }),
    ).success,
    false,
  )
})

test('전체 예상금액은 모든 품목의 가격과 배송비를 알 때만 합계를 낸다', () => {
  const item = { quantity: 1, estimatedUnitPrice: WON_MAX, estimatedShippingFee: 0 }
  assert.deepEqual(purchaseEstimatesOf(Array.from({ length: 20 }, () => item)), {
    subtotal: 20 * WON_MAX,
    total: 20 * WON_MAX,
  })
  assert.deepEqual(purchaseEstimatesOf([item, { quantity: 1, estimatedUnitPrice: 100 }]), {
    subtotal: WON_MAX + 100,
    total: null,
  })
  assert.deepEqual(purchaseEstimatesOf([item, { quantity: 1 }]), { subtotal: null, total: null })
})

test('수량 상한은 99,999이고 단가 × 수량이 금액 상한을 넘으면 받지 않는다', () => {
  const body = (item: object) => ({ title: 'a', items: [{ name: 'a', ...item }] })
  const parsed = (item: object) => CreatePurchaseRequestSchema.safeParse(body(item)).success
  assert.equal(PURCHASE_QUANTITY_MAX, 99_999)
  assert.equal(parsed({ quantity: 99_999 }), true)
  assert.equal(parsed({ quantity: 100_000 }), false)
  assert.equal(parsed({ quantity: 99_999, estimatedUnitPrice: 10_000 }), true)
  assert.equal(parsed({ quantity: 99_999, estimatedUnitPrice: 10_001 }), false)
})
