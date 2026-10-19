import assert from 'node:assert/strict'
import { test } from 'node:test'
import webpush from 'web-push'
import { createPushSender } from './sender.js'

const keys = webpush.generateVAPIDKeys()
const config = { publicKey: keys.publicKey, privateKey: keys.privateKey, subject: 'mailto:team@vada.test' }
const target = { endpoint: 'https://fcm.googleapis.com/fcm/send/abc', keys: { p256dh: 'p', auth: 'a' } }
const message = { title: 'VADA', body: '시험', url: '/' }

test('정한 설정으로 한 번 보내고 sent를 돌려준다', async () => {
  const calls: unknown[][] = []
  const send = createPushSender(config, async (...args) => { calls.push(args) })
  assert.equal(await send(target, message), 'sent')
  assert.deepEqual(calls, [[target, JSON.stringify(message), {
    vapidDetails: { subject: config.subject, publicKey: config.publicKey, privateKey: config.privateKey },
    TTL: 60, urgency: 'high', timeout: 10_000,
  }]])
})

test('404·410은 expired, 그 밖의 실패는 rejected다', async () => {
  for (const [statusCode, expected] of [[404, 'expired'], [410, 'expired'], [400, 'rejected'], [403, 'rejected'], [429, 'rejected'], [500, 'rejected']] as const) {
    const send = createPushSender(config, async () => { throw Object.assign(new Error('push failed'), { statusCode }) })
    assert.equal(await send(target, message), expected, String(statusCode))
  }
  const offline = createPushSender(config, async () => { throw new Error('ECONNRESET') })
  assert.equal(await offline(target, message), 'rejected')
})

test('알려지지 않은 서버는 rejected를 돌려주고 send를 호출하지 않는다', async () => {
  const calls: unknown[][] = []
  const send = createPushSender(config, async (...args) => { calls.push(args) })
  const unknownTarget = { endpoint: 'https://127.0.0.1/x', keys: { p256dh: 'p', auth: 'a' } }
  assert.equal(await send(unknownTarget, message), 'rejected')
  assert.deepEqual(calls, [])
})
