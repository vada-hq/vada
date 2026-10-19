import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createApp } from '../app.js'
import { createPushRoutes, TEST_DELAY_MS, TEST_MESSAGE } from './routes.js'
import type { PushSender } from './sender.js'

const origin = 'http://127.0.0.1:5180'
const subscription = {
  endpoint: 'https://fcm.googleapis.com/fcm/send/abc',
  expirationTime: null,
  keys: { p256dh: 'p'.repeat(87), auth: 'a'.repeat(22) },
}

function setup(result: Awaited<ReturnType<PushSender>> = 'sent') {
  let userId: string | null = 'u1'
  const sent: Parameters<PushSender>[] = []
  const waits: number[] = []
  const push = createPushRoutes(async () => userId ? { user: { id: userId } } : null, 'PUBLIC',
    async (...args) => { sent.push(args); return result }, async ms => { waits.push(ms) })
  const app = createApp({ auth: { handler: async () => new Response() }, trustedOrigin: origin, push })
  const post = (body: unknown) => app.request('/api/me/push/test', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin }, body: JSON.stringify(body),
  })
  return { app, post, sent, waits, logout: () => { userId = null } }
}

test('공개 열쇠는 로그인한 사람에게만 준다', async () => {
  const { app, logout } = setup()
  const response = await app.request('/api/me/push')
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { publicKey: 'PUBLIC' })
  assert.equal(response.headers.get('Cache-Control'), 'no-store')
  logout()
  assert.equal((await app.request('/api/me/push')).status, 401)
})

test('시험 알림은 5초 기다린 뒤 정한 문구로 그 구독에만 보낸다', async () => {
  const { post, sent, waits } = setup()
  const response = await post(subscription)
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { result: 'sent' })
  assert.deepEqual(waits, [TEST_DELAY_MS])
  assert.deepEqual(sent, [[{ endpoint: subscription.endpoint, keys: subscription.keys }, TEST_MESSAGE]])
})

test('보내기 결과 expired·rejected를 그대로 돌려준다', async () => {
  for (const result of ['expired', 'rejected'] as const) {
    const { post } = setup(result)
    assert.deepEqual(await (await post(subscription)).json(), { result })
  }
})

test('모르는 알림 서버면 기다리지도 보내지도 않고 400이다', async () => {
  const { post, sent, waits } = setup()
  const response = await post({ ...subscription, endpoint: 'https://evil.test/push' })
  assert.equal(response.status, 400)
  assert.deepEqual(await response.json(), { error: 'PUSH_SERVICE_UNSUPPORTED' })
  assert.deepEqual(sent, [])
  assert.deepEqual(waits, [])
})

test('로그인하지 않으면 401이고 보내지 않는다', async () => {
  const { post, sent, logout } = setup()
  logout()
  assert.equal((await post(subscription)).status, 401)
  assert.deepEqual(sent, [])
})

test('알림 열쇠가 없어 경로를 만들지 않으면 404다', async () => {
  const app = createApp({ auth: { handler: async () => new Response() }, trustedOrigin: origin })
  assert.equal((await app.request('/api/me/push')).status, 404)
  const response = await app.request('/api/me/push/test', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin }, body: JSON.stringify(subscription),
  })
  assert.equal(response.status, 404)
})
