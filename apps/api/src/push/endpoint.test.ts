import assert from 'node:assert/strict'
import { test } from 'node:test'
import { isKnownPushService } from './endpoint.js'

test('알려진 브라우저 알림 서버로만 보낸다', () => {
  for (const known of [
    'https://fcm.googleapis.com/fcm/send/abc',
    'https://web.push.apple.com/QGx',
    'https://updates.push.services.mozilla.com/wpush/v2/x',
    'https://wns2-par02p.notify.windows.com/w/?token=x',
    'https://FCM.googleapis.com/fcm/send/abc',
    'https://fcm.googleapis.com:443/fcm/send/abc',
    'https://db5p.notify.windows.com/?token=abc',
  ])
    assert.equal(isKnownPushService(known), true, known)
  for (const unknown of [
    'http://fcm.googleapis.com/fcm/send/abc',
    'https://fcm.googleapis.com.evil.test/x',
    'https://evil.test/fcm.googleapis.com',
    'https://notify.windows.com/x',
    'https://evilnotify.windows.com/x',
    'https://127.0.0.1/x',
    'https://localhost/x',
    'https://user:pass@fcm.googleapis.com/x',
    'https://fcm.googleapis.com:8443/x',
    'not a url',
    '',
    'https://127.0.0.1;.notify.windows.com/x',
    'https://localhost;.notify.windows.com/x',
    "https://127.0.0.1'.notify.windows.com/x",
    'https://127.0.0.1{.notify.windows.com/x',
    'https://127.0.0.1%2Enotify.windows.com/x',
    'https://fcm%2egoogleapis.com/x',
    'https:fcm.googleapis.com/fcm/send/abc',
    'https:/fcm.googleapis.com/fcm/send/abc',
    'https://.notify.windows.com/x',
    'https://fcm.googleapis.com./x',
  ])
    assert.equal(isKnownPushService(unknown), false, unknown)
})
