import assert from 'node:assert/strict'
import { test } from 'node:test'
import webpush from 'web-push'
import { pushConfigFrom } from './config.js'

const keys = webpush.generateVAPIDKeys()
const env = { VAPID_PUBLIC_KEY: keys.publicKey, VAPID_PRIVATE_KEY: keys.privateKey, VAPID_SUBJECT: 'mailto:team@vada.test' }

test('알림 열쇠가 하나도 없으면 알림을 끈다', () => {
  assert.equal(pushConfigFrom({}), null)
  assert.equal(pushConfigFrom({ VAPID_PUBLIC_KEY: ' ', VAPID_PRIVATE_KEY: '', VAPID_SUBJECT: '' }), null)
})

test('셋이 모두 맞으면 알림을 켠다', () => {
  assert.deepEqual(pushConfigFrom(env), { publicKey: keys.publicKey, privateKey: keys.privateKey, subject: 'mailto:team@vada.test' })
  assert.equal(pushConfigFrom({ ...env, VAPID_SUBJECT: ' https://vada.test/contact ' })?.subject, 'https://vada.test/contact')
})

test('일부만 있거나 형식이 틀리면 값을 드러내지 않고 시작을 막는다', () => {
  const broken = [
    { VAPID_PUBLIC_KEY: keys.publicKey },
    { ...env, VAPID_PRIVATE_KEY: '' },
    { ...env, VAPID_SUBJECT: '' },
    { ...env, VAPID_PUBLIC_KEY: keys.privateKey },
    { ...env, VAPID_PRIVATE_KEY: keys.publicKey },
    { ...env, VAPID_PUBLIC_KEY: `${keys.publicKey}=` },
    { ...env, VAPID_SUBJECT: 'team@vada.test' },
    { ...env, VAPID_SUBJECT: 'http://vada.test' },
  ]
  for (const value of broken) {
    assert.throws(() => pushConfigFrom(value), error => {
      assert.ok(error instanceof Error)
      assert.ok(!error.message.includes(keys.privateKey) && !error.message.includes(keys.publicKey))
      return true
    }, JSON.stringify(Object.keys(value)))
  }
})
