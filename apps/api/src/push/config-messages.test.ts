import assert from 'node:assert/strict'
import { test } from 'node:test'
import webpush from 'web-push'
import { pushConfigFrom } from './config.js'

const keys = webpush.generateVAPIDKeys()
const env = {
  VAPID_PUBLIC_KEY: keys.publicKey,
  VAPID_PRIVATE_KEY: keys.privateKey,
  VAPID_SUBJECT: 'mailto:team@vada.test',
}
const messageOf = (value: NodeJS.ProcessEnv) => {
  try {
    pushConfigFrom(value)
  } catch (error) {
    return (error as Error).message
  }
  return null
}

test('실수마다 정해진 메시지로 막는다', () => {
  const partial = '알림 열쇠 설정(VAPID) 세 값을 모두 넣거나 모두 빼세요.'
  const format = '알림 열쇠(VAPID) 형식을 확인하세요.'
  assert.equal(messageOf({ VAPID_PUBLIC_KEY: keys.publicKey }), partial)
  assert.equal(messageOf({ ...env, VAPID_SUBJECT: ' ' }), partial)
  assert.equal(messageOf({ ...env, VAPID_PUBLIC_KEY: keys.privateKey }), format)
  assert.equal(messageOf({ ...env, VAPID_PUBLIC_KEY: `${keys.publicKey}=` }), format)
  assert.equal(messageOf({ ...env, VAPID_PRIVATE_KEY: keys.publicKey }), format)
  assert.equal(messageOf({ ...env, VAPID_PRIVATE_KEY: `${keys.privateKey}!` }), format)
  const point = Buffer.from(keys.publicKey, 'base64url')
  point[0] = 2
  assert.equal(messageOf({ ...env, VAPID_PUBLIC_KEY: point.toString('base64url') }), format)
  const subject = 'VAPID_SUBJECT는 mailto: 또는 https: 주소여야 합니다.'
  for (const value of ['team@vada.test', 'http://vada.test', 'mailto:a', 'https://']) {
    assert.equal(messageOf({ ...env, VAPID_SUBJECT: value }), subject, value)
  }
  assert.equal(messageOf({ ...env, VAPID_SUBJECT: 'mailto:a@b' }), null)
})
