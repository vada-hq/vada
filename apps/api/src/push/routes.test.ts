import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createApp } from '../app.js'
import { setErrorReporter } from '../http/on-error.js'
import { createPushRoutes, TEST_DELAY_MS, TEST_MESSAGE } from './routes.js'
import type { PushSender } from './sender.js'

const origin = 'http://127.0.0.1:5180'
const subscription = {
  endpoint: 'https://fcm.googleapis.com/fcm/send/abc',
  expirationTime: null,
  keys: { p256dh: 'p'.repeat(87), auth: 'a'.repeat(22) },
}

function setup(outcome: Awaited<ReturnType<PushSender>> = { result: 'sent' }) {
  let userId: string | null = 'u1'
  const sent: Parameters<PushSender>[] = []
  const waits: number[] = []
  const push = createPushRoutes(async () => (userId ? { user: { id: userId } } : null), {
    publicKey: 'PUBLIC',
    send: async (...args) => {
      sent.push(args)
      return outcome
    },
    wait: async ms => {
      waits.push(ms)
    },
  })
  const app = createApp({
    auth: { handler: async () => new Response() },
    trustedOrigin: origin,
    push,
  })
  const post = (body: unknown) =>
    app.request('/api/me/push/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: origin },
      body: JSON.stringify(body),
    })
  return {
    app,
    post,
    sent,
    waits,
    logout: () => {
      userId = null
    },
  }
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
  assert.deepEqual(sent, [
    [{ endpoint: subscription.endpoint, keys: subscription.keys }, TEST_MESSAGE],
  ])
})

test('보내기 결과 expired·rejected를 그대로 돌려준다', async t => {
  t.mock.method(console, 'warn', () => {})
  for (const result of ['expired', 'rejected'] as const) {
    const { post } = setup({ result })
    assert.deepEqual(await (await post(subscription)).json(), { result })
  }
})

test('알림 서버가 거절하면 상태 번호를 로그에 남기고, 구독 주소는 로그와 응답에 넣지 않는다', async t => {
  const logged: string[] = []
  t.mock.method(console, 'warn', (line: string) => {
    logged.push(line)
  })
  const { post } = setup({ result: 'rejected', status: 403 })
  const response = await post(subscription)
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { result: 'rejected' })
  assert.equal(logged.length, 1)
  assert.ok(logged[0]!.includes('"status":403'))
  assert.ok(!logged[0]!.includes(subscription.endpoint))
  assert.deepEqual(JSON.parse(logged[0]!), {
    event: 'push_test_failed',
    result: 'rejected',
    status: 403,
  })
})

test('보내지 못한 시험 알림은 결과 종류에 상태 번호나 연결 오류 코드가 있을 때만 더해 한 줄 남기고, 보냈으면 남기지 않는다', async t => {
  const logged: string[] = []
  t.mock.method(console, 'warn', (line: string) => {
    logged.push(line)
  })
  const cases = [
    [
      { result: 'expired', status: 410 },
      { event: 'push_test_failed', result: 'expired', status: 410 },
    ],
    [
      { result: 'rejected', code: 'ECONNRESET' },
      { event: 'push_test_failed', result: 'rejected', code: 'ECONNRESET' },
    ],
    [{ result: 'rejected' }, { event: 'push_test_failed', result: 'rejected' }],
  ] as const
  for (const [outcome, line] of cases) {
    logged.length = 0
    const response = await setup(outcome).post(subscription)
    assert.deepEqual(await response.json(), { result: outcome.result })
    assert.equal(logged.length, 1)
    assert.deepEqual(JSON.parse(logged[0]!), line)
  }
  logged.length = 0
  assert.deepEqual(await (await setup({ result: 'sent' }).post(subscription)).json(), {
    result: 'sent',
  })
  assert.deepEqual(logged, [])
})

test('끝난 구독의 기기 지우기가 실패해도 시험 알림 결과는 그대로 돌려주고, 실패는 구독 주소 없이 로그와 오류 수집기에 남긴다', async t => {
  const logged: string[] = []
  t.mock.method(console, 'warn', (line: string) => {
    logged.push(line)
  })
  const errored: string[] = []
  t.mock.method(console, 'error', (line: string) => {
    errored.push(line)
  })
  const reported: { error: Error; fields: Record<string, unknown> }[] = []
  setErrorReporter((error, fields) => {
    reported.push({ error, fields })
  })
  t.after(() => setErrorReporter(undefined))
  // 드라이버 오류는 메시지에 질의 값(구독 주소)을 담고, SQLSTATE는 cause에 있다.
  const failure = Object.assign(
    new Error(`delete from push_device where endpoint = ${subscription.endpoint}`),
    { cause: { code: '57P01' } },
  )
  const push = createPushRoutes(async () => ({ user: { id: 'u1' } }), {
    publicKey: 'PUBLIC',
    send: async () => ({ result: 'expired', status: 410 }),
    wait: async () => {},
    forget: async () => {
      throw failure
    },
  })
  const app = createApp({
    auth: { handler: async () => new Response() },
    trustedOrigin: origin,
    push,
  })
  const response = await app.request('/api/me/push/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: origin },
    body: JSON.stringify(subscription),
  })
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { result: 'expired' })
  // 시험 알림 결과를 먼저 남기고, 지우기 실패는 그다음에 SQLSTATE만 남긴다.
  assert.deepEqual(
    logged.map((line): unknown => JSON.parse(line)),
    [
      { event: 'push_test_failed', result: 'expired', status: 410 },
      { event: 'push_device_forget_failed', sqlState: '57P01' },
    ],
  )
  // 서버 쪽 실패라 오류 수집기(Sentry)에도 간다. 같은 정제된 필드만 넘기고 구독 주소는 어디에도 없다.
  assert.equal(reported.length, 1)
  assert.equal(reported[0]!.error, failure)
  assert.deepEqual(reported[0]!.fields, {
    event: 'request_failed',
    method: 'POST',
    route: '/api/me/push/test',
    error: 'Error',
    sqlState: '57P01',
  })
  assert.equal(errored.length, 1)
  assert.ok(
    [...logged, ...errored, JSON.stringify(reported[0]!.fields)].every(
      line => !line.includes(subscription.endpoint),
    ),
  )
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
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: origin },
    body: JSON.stringify(subscription),
  })
  assert.equal(response.status, 404)
})
