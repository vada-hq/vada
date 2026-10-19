import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createApp } from '../app.js'
import { createTestDb, type TestDb } from '../db/test-db.js'
import { addUser } from '../test-support/council.js'
import { caller, ORIGIN, testSession } from '../test-support/http.js'
import { createPushDeviceRoutes, forgetPushDevice } from './devices.js'
import { createPushRoutes } from './routes.js'

const subscription = { endpoint: 'https://fcm.googleapis.com/fcm/send/abc', expirationTime: null, keys: { p256dh: 'p'.repeat(87), auth: 'a'.repeat(22) } }

async function setup(testDb: TestDb) {
  for (const user of ['u1', 'u2']) await addUser(testDb.pg, user)
  return caller(createApp({ auth: { handler: async () => new Response() }, trustedOrigin: ORIGIN, pushDevices: createPushDeviceRoutes(testDb.db, testSession) }))
}
// 만료 시각은 밀리초로 꺼낸다. 글자로 꺼내면 DB 세션의 시간대에 따라 모양이 달라진다.
const devicesOf = (testDb: TestDb) => testDb.pg.query<{ user_id: string; endpoint: string; p256dh: string; auth: string; expiration_ms: number | null }>(
  'SELECT user_id, endpoint, p256dh, auth, (extract(epoch FROM expiration_time) * 1000)::float8 AS expiration_ms FROM push_device ORDER BY endpoint')

test('알림 받을 기기를 로그인 계정에 저장하고, 같은 구독 주소면 열쇠를 갱신한다', async () => {
  const testDb = await createTestDb()
  try {
    const api = await setup(testDb)
    const saved = await api.post('/api/me/push/devices', subscription, 'u1')
    assert.equal(saved.status, 204)
    assert.equal(await saved.text(), '')
    assert.deepEqual((await devicesOf(testDb)).rows, [{ user_id: 'u1', endpoint: subscription.endpoint, p256dh: 'p'.repeat(87), auth: 'a'.repeat(22),
      expiration_ms: null }])
    await api.post('/api/me/push/devices', { ...subscription, expirationTime: 1_798_761_600_000, keys: { p256dh: 'q'.repeat(87), auth: 'b'.repeat(22) } }, 'u1')
    assert.deepEqual((await devicesOf(testDb)).rows.map(row => [row.p256dh[0], row.auth[0], row.expiration_ms]), [['q', 'b', 1_798_761_600_000]])
    // 한 브라우저에서 다른 계정으로 켜면 그 계정의 기기가 된다.
    await api.post('/api/me/push/devices', subscription, 'u2')
    assert.deepEqual((await devicesOf(testDb)).rows.map(row => row.user_id), ['u2'])
  } finally {
    await testDb.close()
  }
})

test('지우기는 내 기기만 지우고, 없으면 그냥 204다. 로그인 계정을 지우면 기기도 지워진다', async () => {
  const testDb = await createTestDb()
  try {
    const api = await setup(testDb)
    await api.post('/api/me/push/devices', subscription, 'u1')
    const other = { ...subscription, endpoint: 'https://web.push.apple.com/other' }
    await api.post('/api/me/push/devices', other, 'u2')
    assert.equal((await api.post('/api/me/push/devices/remove', { endpoint: other.endpoint }, 'u1')).status, 204)
    assert.equal((await devicesOf(testDb)).rows.length, 2)
    assert.equal((await api.post('/api/me/push/devices/remove', { endpoint: subscription.endpoint }, 'u1')).status, 204)
    assert.equal((await api.post('/api/me/push/devices/remove', { endpoint: subscription.endpoint }, 'u1')).status, 204)
    assert.deepEqual((await devicesOf(testDb)).rows.map(row => row.endpoint), [other.endpoint])
    await testDb.pg.query("DELETE FROM users WHERE id = 'u2'")
    assert.equal((await devicesOf(testDb)).rows.length, 0)
  } finally {
    await testDb.close()
  }
})

test('모르는 알림 서버는 400 PUSH_SERVICE_UNSUPPORTED, 틀린 본문은 400, 로그인하지 않으면 401이고 저장하지 않는다', async () => {
  const testDb = await createTestDb()
  try {
    const api = await setup(testDb)
    const unknown = await api.post('/api/me/push/devices', { ...subscription, endpoint: 'https://evil.test/push' }, 'u1')
    assert.equal(unknown.status, 400)
    assert.deepEqual(await unknown.json(), { error: 'PUSH_SERVICE_UNSUPPORTED' })
    for (const bad of [{}, { ...subscription, keys: undefined }, { ...subscription, endpoint: 'http://fcm.googleapis.com/x' }, { ...subscription, extra: 1 },
      { ...subscription, keys: { ...subscription.keys, auth: '' } }, { ...subscription, keys: { ...subscription.keys, p256dh: 'p\u0000' } },
      { ...subscription, endpoint: `https://fcm.googleapis.com/${'a'.repeat(1024)}` }, { ...subscription, expirationTime: Number.MAX_SAFE_INTEGER }]) {
      assert.equal((await api.post('/api/me/push/devices', bad, 'u1')).status, 400, JSON.stringify(bad).slice(0, 80))
    }
    assert.equal((await api.post('/api/me/push/devices/remove', { endpoint: subscription.endpoint, extra: 1 }, 'u1')).status, 400)
    assert.equal((await api.post('/api/me/push/devices', subscription)).status, 401)
    assert.equal((await api.post('/api/me/push/devices/remove', { endpoint: subscription.endpoint })).status, 401)
    assert.equal((await devicesOf(testDb)).rows.length, 0)
  } finally {
    await testDb.close()
  }
})

test('시험 알림이 끝난 구독(expired)이면 보낸 사람의 그 기기 줄도 지운다. 보냈거나 거절된 알림이면 남기고, 다른 사람의 기기는 두고 간다', async (t) => {
  // 보내지 못한 시험 알림은 결과를 로그에 남긴다(덩어리 1). 이 시험에서는 조용히 둔다.
  t.mock.method(console, 'warn', () => {})
  const testDb = await createTestDb()
  try {
    for (const user of ['u1', 'u2']) await addUser(testDb.pg, user)
    let result: 'sent' | 'rejected' | 'expired' = 'sent'
    const api = caller(createApp({ auth: { handler: async () => new Response() }, trustedOrigin: ORIGIN,
      pushDevices: createPushDeviceRoutes(testDb.db, testSession),
      push: createPushRoutes(testSession, 'PUBLIC', async () => ({ result }), async () => {}, (userId, endpoint) => forgetPushDevice(testDb.db, userId, endpoint)) }))
    const other = { ...subscription, endpoint: 'https://web.push.apple.com/other' }
    await api.post('/api/me/push/devices', subscription, 'u1')
    await api.post('/api/me/push/devices', other, 'u2')
    assert.deepEqual(await (await api.post('/api/me/push/test', subscription, 'u1')).json(), { result: 'sent' })
    assert.equal((await devicesOf(testDb)).rows.length, 2)
    // 알림 서버가 받지 않은 것(rejected)은 끝난 구독이 아니다. 기기 줄을 남긴다.
    result = 'rejected'
    assert.deepEqual(await (await api.post('/api/me/push/test', subscription, 'u1')).json(), { result: 'rejected' })
    assert.equal((await devicesOf(testDb)).rows.length, 2)
    result = 'expired'
    await api.post('/api/me/push/test', other, 'u1')
    assert.equal((await devicesOf(testDb)).rows.length, 2)
    assert.deepEqual(await (await api.post('/api/me/push/test', subscription, 'u1')).json(), { result: 'expired' })
    assert.deepEqual((await devicesOf(testDb)).rows.map(row => [row.user_id, row.endpoint]), [['u2', other.endpoint]])
  } finally {
    await testDb.close()
  }
})
