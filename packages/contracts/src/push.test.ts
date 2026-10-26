import assert from 'node:assert/strict'
import { test } from 'node:test'
import { parseAppPath } from './paths.js'
import {
  chatReplyTag,
  chatReplyUrl,
  chatRoomFromPath,
  chatRoomUrl,
  purchaseRequestFromPath,
  purchaseRequestUrl,
  PUSH_ENDPOINT_MAX,
  PushSubscriptionSchema,
  RemovePushDeviceSchema,
  taskFromPath,
  taskTag,
  taskUrl,
} from './push.js'

const C = '0199d1a0-0000-7000-8000-00000000000a'
const R = '0199d1a0-0000-7000-8000-00000000000b'

test('옛 알림 주소 셋은 영구히 같은 꼴이고 같은 값으로 읽힌다', () => {
  assert.equal(chatRoomUrl(C, R), `/chat/${C}/${R}`)
  assert.equal(taskUrl(C, R), `/tasks/${C}/${R}`)
  assert.equal(purchaseRequestUrl(C, R), `/purchases/${C}/${R}`)
  assert.deepEqual(chatRoomFromPath(`/chat/${C}/${R}`), { councilId: C, roomId: R })
  assert.deepEqual(taskFromPath(`/tasks/${C}/${R}`), { councilId: C, taskId: R })
  assert.deepEqual(purchaseRequestFromPath(`/purchases/${C}/${R}`), {
    councilId: C,
    requestId: R,
  })
  assert.equal(taskTag(R), `task:${R}`)
})

test('답글 알림 주소는 그 방 주소에 원글을 붙이고, 화면은 방과 원글로 읽는다', () => {
  const M = '0199d1a0-0000-7000-8000-00000000000c'
  assert.equal(chatReplyUrl(C, R, M), `/chat/${C}/${R}?reply=${M}`)
  assert.deepEqual(chatRoomFromPath(chatReplyUrl(C, R, M)), { councilId: C, roomId: R })
  const location = parseAppPath(chatReplyUrl(C, R, M))
  assert.deepEqual(location?.query, { reply: M })
  // uuid가 아닌 원글은 버린다(방만 열린다).
  assert.deepEqual(parseAppPath(`/chat/${C}/${R}?reply=x`)?.query, {})
  assert.equal(chatReplyTag(M), `reply:${M}`)
})

test('알림 주소 읽기: 다른 종류, uuid가 아닌 칸, 다른 모양은 읽지 않는다', () => {
  const readers = [
    ['chat', chatRoomFromPath],
    ['tasks', taskFromPath],
    ['purchases', purchaseRequestFromPath],
  ] as const
  for (const [kind, read] of readers) {
    for (const path of [
      '/',
      `/${kind}`,
      `/${kind}/${C}`,
      `/${kind}/${C}/`,
      `/${kind}//${R}`,
      `/${kind}/${C}/${R}/x/`,
      `/${kind}/c-1/r-1`,
      `/${kind}/${C}/r-1`,
      `/${kind}/%E0%A4%A/${R}`,
      `/join/${C}/${R}`,
      `/${kind === 'chat' ? 'tasks' : 'chat'}/${C}/${R}`,
    ])
      assert.equal(read(path), null, path)
    assert.notEqual(read(`/${kind}/${C}/${R}/`), null)
  }
})

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
