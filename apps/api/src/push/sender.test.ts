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
  assert.deepEqual(await send(target, message), { result: 'sent' })
  assert.deepEqual(calls, [[target, JSON.stringify(message), {
    vapidDetails: { subject: config.subject, publicKey: config.publicKey, privateKey: config.privateKey },
    TTL: 60, urgency: 'high', timeout: 10_000,
  }]])
})

test('404·410은 expired, 그 밖의 실패는 rejected이고, 알림 서버의 상태 번호를 함께 돌려준다', async () => {
  for (const [statusCode, result] of [[404, 'expired'], [410, 'expired'], [400, 'rejected'], [403, 'rejected'], [413, 'rejected'], [429, 'rejected'], [500, 'rejected']] as const) {
    const send = createPushSender(config, async () => { throw Object.assign(new Error('push failed'), { statusCode }) })
    assert.deepEqual(await send(target, message), { result, status: statusCode }, String(statusCode))
  }
})

test('연결 오류는 오류 코드를 돌려주고, 메시지는 담지 않는다', async () => {
  for (const code of ['ECONNRESET', 'ETIMEDOUT', 'EAI_AGAIN']) {
    const send = createPushSender(config, async () => { throw Object.assign(new Error(`connect failed ${target.endpoint}`), { code }) })
    assert.deepEqual(await send(target, message), { result: 'rejected', code }, code)
  }
})

test('상태 번호가 있으면 오류 코드는 담지 않는다', async () => {
  const send = createPushSender(config, async () => { throw Object.assign(new Error('push failed'), { statusCode: 403, code: 'ECONNRESET' }) })
  assert.deepEqual(await send(target, message), { result: 'rejected', status: 403 })
})

test('진단으로 쓸 수 없는 오류는 결과만 돌려준다', async () => {
  const thrown: [string, unknown][] = [
    ['던진 null', null], ['던진 undefined', undefined], ['던진 문자열', 'ECONNRESET'], ['던진 숫자', 403],
    ['메시지에만 적힌 ECONNRESET', new Error('ECONNRESET')],
    ['소문자와 공백이 든 code', Object.assign(new Error('x'), { code: 'ERR_SOMETHING lowercase' })],
    ['줄바꿈이 붙은 code', Object.assign(new Error('x'), { code: 'ECONNRESET\n' })],
    ['숫자 code', Object.assign(new Error('x'), { code: 104 })],
    ['배열 code', Object.assign(new Error('x'), { code: ['ECONNRESET'] })],
    ['문자열 statusCode', Object.assign(new Error('x'), { statusCode: '403' })],
    ['NaN statusCode', Object.assign(new Error('x'), { statusCode: Number.NaN })],
  ]
  for (const [name, error] of thrown) {
    const send = createPushSender(config, async () => { throw error })
    assert.deepEqual(await send(target, message), { result: 'rejected' }, name)
  }
})

test('알려지지 않은 서버는 rejected를 돌려주고 send를 호출하지 않는다', async () => {
  const calls: unknown[][] = []
  const send = createPushSender(config, async (...args) => { calls.push(args) })
  const unknownTarget = { endpoint: 'https://127.0.0.1/x', keys: { p256dh: 'p', auth: 'a' } }
  assert.deepEqual(await send(unknownTarget, message), { result: 'rejected' })
  assert.deepEqual(calls, [])
})
