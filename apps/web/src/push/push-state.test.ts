import { expect, test } from 'vitest'
import { pushStateOf, type PushFacts } from './push-state'

const base: PushFacts = { device: 'android', homeScreenApp: false, supported: true, server: 'ready', permission: 'default', subscribed: false }

test('기기, 브라우저, 서버, 허락, 구독으로 한 가지 상태를 정한다', () => {
  expect(pushStateOf({ ...base, device: 'ios' })).toBe('needs-home-screen')
  expect(pushStateOf({ ...base, device: 'ios', homeScreenApp: true })).toBe('ask')
  expect(pushStateOf({ ...base, supported: false })).toBe('unsupported')
  expect(pushStateOf({ ...base, device: 'ios', supported: false })).toBe('needs-home-screen')
  expect(pushStateOf({ ...base, server: 'loading' })).toBe('loading')
  expect(pushStateOf({ ...base, server: 'failed' })).toBe('failed')
  expect(pushStateOf({ ...base, server: 'off' })).toBe('server-off')
  expect(pushStateOf({ ...base, permission: 'denied' })).toBe('denied')
  expect(pushStateOf({ ...base, permission: 'granted' })).toBe('ask')
  expect(pushStateOf({ ...base, permission: 'granted', subscribed: true })).toBe('on')
  expect(pushStateOf({ ...base, permission: 'default', subscribed: true })).toBe('ask')
})
