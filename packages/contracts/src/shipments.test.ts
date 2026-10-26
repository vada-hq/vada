import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ShipmentSchema, CancelShipmentSchema, TRACKING_NUMBER_MAX } from './shipments.js'

const item = '019e0000-0000-7000-8000-000000000001'
const valid = { carrierId: 'kr.coupangls', trackingNumber: '123-456', lineItemIds: [item] }

test('송장은 정한 택배사, 숫자·하이픈 번호, 겹치지 않는 품목을 받는다', () => {
  assert.equal(ShipmentSchema.safeParse(valid).success, true)
  for (const patch of [
    { carrierId: 'unknown' },
    { trackingNumber: '' },
    { trackingNumber: ' ' },
    { trackingNumber: '1'.repeat(TRACKING_NUMBER_MAX + 1) },
    { trackingNumber: '😀'.repeat(TRACKING_NUMBER_MAX + 1) },
    { trackingNumber: '123a' },
    { trackingNumber: '123\u0000' },
    { trackingNumber: '\ud800' },
    { trackingNumber: '---' },
    { lineItemIds: [] },
    { lineItemIds: [item, item] },
    { lineItemIds: Array.from({ length: 21 }, () => item) },
    { unknown: true },
  ])
    assert.equal(ShipmentSchema.safeParse({ ...valid, ...patch }).success, false)
  for (const field of Object.keys(valid)) {
    const input: Record<string, unknown> = { ...valid }
    delete input[field]
    assert.equal(ShipmentSchema.safeParse(input).success, false)
  }
})

test('송장 취소는 사유가 필수이고 모르는 키·비정상 문자열을 받지 않는다', () => {
  assert.equal(CancelShipmentSchema.safeParse({ reason: '주문 취소' }).success, true)
  for (const input of [
    {},
    { reason: '' },
    { reason: ' ' },
    { reason: '\u0000' },
    { reason: '\ud800' },
    { reason: '😀'.repeat(501) },
    { reason: '취소', extra: true },
  ])
    assert.equal(CancelShipmentSchema.safeParse(input).success, false)
})
