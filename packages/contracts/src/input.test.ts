import assert from 'node:assert/strict'
import { test } from 'node:test'
import fc from 'fast-check'
import { z } from 'zod'
import { codePoints, isStrictObject, text, token } from './input.js'
import { CreateEventSchema, EVENT_NAME_MAX } from './events.js'
import { CreateMessageSchema, MESSAGE_CONTENT_MAX } from './chat.js'
import { DeliveryLookupSchema, RegisterShipmentSchema, UnlinkShipmentSchema } from './deliveries.js'

// 홀로 쓰인 서러게이트까지 만들도록 UTF-16 코드 단위를 직접 뽑는다.
const anyText = fc.string({ unit: fc.integer({ min: 0, max: 0xffff }).map(n => String.fromCharCode(n)), maxLength: 120 })

test('text: 앞뒤 공백 제거 후 1..max 코드 포인트, NUL·홀로 쓰인 서러게이트 없음일 때만 통과한다', () => {
  const schema = text(50)
  fc.assert(fc.property(anyText, value => {
    const trimmed = value.trim()
    const expected = trimmed.length > 0 && codePoints(trimmed) <= 50 && !/[\u0000\uD800-\uDFFF]/u.test(value)
    const result = schema.safeParse(value)
    assert.equal(result.success, expected)
    if (result.success) assert.equal(result.data, trimmed)
  }))
})

test('token: 원문 max 이하, 제어 문자 없음, 공백 제거 후 1자 이상일 때만 통과한다', () => {
  const schema = token(40)
  fc.assert(fc.property(anyText, value => {
    const expected = value.length <= 40 && !/[\u0000-\u001f\u007f\uD800-\uDFFF]/u.test(value) && value.trim().length > 0
    const result = schema.safeParse(value)
    assert.equal(result.success, expected)
    if (result.success) assert.equal(result.data, value.trim())
  }))
})

test('문자열이 아닌 값은 거부한다', () => {
  for (const value of [null, undefined, 1, true, [], {}]) {
    assert.equal(text(10).safeParse(value).success, false)
    assert.equal(token(10).safeParse(value).success, false)
  }
})

test('행사 이름: 이모지도 코드 포인트로 세어 100개까지 통과한다', () => {
  assert.equal(CreateEventSchema.safeParse({ name: '😀'.repeat(EVENT_NAME_MAX) }).success, true)
  assert.equal(CreateEventSchema.safeParse({ name: '😀'.repeat(EVENT_NAME_MAX + 1) }).success, false)
  assert.deepEqual(CreateEventSchema.parse({ name: '  축제  ' }), { name: '축제' })
})

test('채팅 본문: 2000 코드 포인트까지, 줄바꿈은 허용한다', () => {
  assert.equal(CreateMessageSchema.safeParse({ content: '😀'.repeat(MESSAGE_CONTENT_MAX) }).success, true)
  assert.equal(CreateMessageSchema.safeParse({ content: 'a'.repeat(MESSAGE_CONTENT_MAX + 1) }).success, false)
  assert.equal(CreateMessageSchema.parse({ content: '첫 줄\n둘째 줄' }).content, '첫 줄\n둘째 줄')
})

test('모르는 키가 하나라도 있으면 거부한다', () => {
  const key = fc.string({ minLength: 1, maxLength: 20 })
  fc.assert(fc.property(key.filter(k => k !== 'name'), k => !CreateEventSchema.safeParse(JSON.parse(JSON.stringify({ name: 'a', [k]: 1 }))).success))
  fc.assert(fc.property(key.filter(k => k !== 'content'), k => !CreateMessageSchema.safeParse(JSON.parse(JSON.stringify({ content: 'a', [k]: 1 }))).success))
})

test('배송 스키마는 기존 수동 검사와 같은 규칙을 지킨다', () => {
  assert.deepEqual(DeliveryLookupSchema.parse({ carrierId: ' kr.cjlogistics ', trackingNumber: '1234-5' }), { carrierId: 'kr.cjlogistics', trackingNumber: '1234-5' })
  for (const body of [{ carrierId: 'kr cj', trackingNumber: '1' }, { carrierId: 'kr.cj', trackingNumber: '1 2' }, { carrierId: 'kr.cj', trackingNumber: '1', extra: 1 }, { carrierId: 'kr.cj' }]) {
    assert.equal(DeliveryLookupSchema.safeParse(body).success, false)
  }
  const register = { carrierId: 'kr.cj', trackingNumber: '1', purchaseItemIds: ['b', 'a'], idempotencyKey: 'k' }
  assert.deepEqual(RegisterShipmentSchema.parse(register).purchaseItemIds, ['a', 'b'])
  for (const ids of [[], ['a', 'a'], Array.from({ length: 51 }, (_, i) => `i${i}`), ['a\u0001']]) {
    assert.equal(RegisterShipmentSchema.safeParse({ ...register, purchaseItemIds: ids }).success, false)
  }
  assert.equal(RegisterShipmentSchema.safeParse({ ...register, idempotencyKey: 'k'.repeat(129) }).success, false)
  assert.deepEqual(UnlinkShipmentSchema.parse({ linkIds: ['z', 'y'] }), { linkIds: ['y', 'z'] })
  assert.equal(UnlinkShipmentSchema.safeParse({ linkIds: ['y'], extra: 1 }).success, false)
})

test('isStrictObject: 모르는 키를 거부하는 z.strictObject만 참이다', () => {
  assert.equal(isStrictObject(z.strictObject({ a: z.string() })), true)
  for (const schema of [z.object({ a: z.string() }), z.looseObject({ a: z.string() }), z.string(), null, {}]) {
    assert.equal(isStrictObject(schema), false)
  }
})
