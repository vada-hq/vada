import assert from 'node:assert/strict'
import { test } from 'node:test'
import { PUSH_ENDPOINT_MAX, PushSubscriptionSchema, RemovePushDeviceSchema } from './push.js'

const valid = {
  endpoint: 'https://fcm.googleapis.com/fcm/send/abc',
  expirationTime: null,
  keys: { p256dh: 'B'.repeat(87), auth: 'a'.repeat(22) },
}

test('PushSubscriptionSchema: 브라우저 구독(toJSON) 모양을 받는다', () => {
  assert.equal(PushSubscriptionSchema.safeParse(valid).success, true)
  const { expirationTime: _, ...withoutExpiration } = valid
  assert.equal(PushSubscriptionSchema.safeParse(withoutExpiration).success, true)
  assert.equal(
    PushSubscriptionSchema.safeParse({ ...valid, expirationTime: 1_760_000_000_000 }).success,
    true,
  )
})

test('PushSubscriptionSchema: 빠진 값, 빈 값, 상한+1, 제어 문자, 모르는 키, https가 아닌 주소를 거절한다', () => {
  const prefix = 'https://fcm.googleapis.com/'
  const longest = `${prefix}${'a'.repeat(PUSH_ENDPOINT_MAX - prefix.length)}`
  assert.equal(PushSubscriptionSchema.safeParse({ ...valid, endpoint: longest }).success, true)
  const bad: unknown[] = [
    {},
    { ...valid, endpoint: undefined },
    { ...valid, keys: undefined },
    { ...valid, keys: { p256dh: valid.keys.p256dh } },
    { ...valid, endpoint: '' },
    { ...valid, endpoint: '   ' },
    { ...valid, keys: { ...valid.keys, auth: ' ' } },
    { ...valid, endpoint: `${longest}a` },
    { ...valid, endpoint: `${longest}😀` },
    { ...valid, keys: { ...valid.keys, p256dh: 'B'.repeat(201) } },
    { ...valid, keys: { ...valid.keys, auth: 'a'.repeat(101) } },
    { ...valid, endpoint: 'https://fcm.googleapis.com/\u0000' },
    { ...valid, keys: { ...valid.keys, auth: '\uD800' } },
    { ...valid, extra: 1 },
    { ...valid, keys: { ...valid.keys, extra: 'x' } },
    { ...valid, endpoint: 'http://fcm.googleapis.com/fcm/send/abc' },
    { ...valid, endpoint: 'not a url' },
    { ...valid, expirationTime: -1 },
    { ...valid, expirationTime: 1.5 },
    { ...valid, expirationTime: '1' },
  ]
  for (const value of bad)
    assert.equal(PushSubscriptionSchema.safeParse(value).success, false, JSON.stringify(value))
})

test('RemovePushDeviceSchema: 구독 주소 하나만 받는다', () => {
  assert.equal(RemovePushDeviceSchema.safeParse({ endpoint: valid.endpoint }).success, true)
  for (const value of [
    {},
    { endpoint: '' },
    { endpoint: 'http://fcm.googleapis.com/x' },
    { endpoint: valid.endpoint, keys: valid.keys },
    { endpoint: `https://fcm.googleapis.com/${'a'.repeat(PUSH_ENDPOINT_MAX)}` },
  ]) {
    assert.equal(
      RemovePushDeviceSchema.safeParse(value).success,
      false,
      JSON.stringify(value).slice(0, 80),
    )
  }
})
