import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { expect, test, vi } from 'vitest'

const source = readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8')
type Client = { url: string; focus: () => Promise<unknown>; navigate: (url: string) => Promise<unknown> }

// 가짜 서비스 워커 전역(self)에 sw.js를 불러 이벤트를 보낸다.
function load(windows: Client[] = []) {
  const listeners = new Map<string, (event: unknown) => void>()
  const self = {
    location: { origin: 'https://vada.test' },
    addEventListener: (type: string, listener: (event: unknown) => void) => { listeners.set(type, listener) },
    skipWaiting: vi.fn(),
    registration: { showNotification: vi.fn(async (_title: string, _options: unknown) => {}) },
    clients: { claim: vi.fn(async () => {}), matchAll: vi.fn(async () => windows), openWindow: vi.fn(async (_url: string) => null) },
  }
  runInNewContext(source, { self, URL })
  const fire = async (type: string, event: Record<string, unknown>) => {
    let pending: unknown = undefined
    listeners.get(type)!({ ...event, waitUntil: (promise: unknown) => { pending = promise } })
    await pending
  }
  return { self, fire }
}

test('푸시를 받으면 받은 내용으로 알림을 띄운다', async () => {
  const { self, fire } = load()
  await fire('push', { data: { json: () => ({ title: 'VADA', body: '시험 알림이에요.', url: '/' }) } })
  expect(self.registration.showNotification).toHaveBeenCalledWith('VADA',
    { body: '시험 알림이에요.', data: { url: '/' }, icon: '/icons/icon-192.png', lang: 'ko' })
})

test('내용을 못 읽어도 알림은 띄우고, 다른 사이트 주소는 받지 않는다', async () => {
  const { self, fire } = load()
  await fire('push', { data: { json: () => { throw new SyntaxError('bad') } } })
  await fire('push', { data: null })
  await fire('push', { data: { json: () => ({ title: 'x', body: 'y', url: '//evil.test/' }) } })
  await fire('push', { data: { json: () => ({ title: 'x', body: 'y', url: 'https://evil.test/' }) } })
  const calls = self.registration.showNotification.mock.calls
  expect(calls.map(call => call[0])).toEqual(['VADA', 'VADA', 'x', 'x'])
  expect(calls.map(call => (call[1] as { data: { url: string } }).data.url)).toEqual(['/', '/', '/', '/'])
})

test('알림을 누르면 열린 VADA 창을 앞으로 가져와 그 주소로 보낸다', async () => {
  const window: Client = { url: 'https://vada.test/', focus: vi.fn(async () => window), navigate: vi.fn(async () => window) }
  const { self, fire } = load([window])
  const close = vi.fn()
  await fire('notificationclick', { notification: { close, data: { url: '/?from=push' } } })
  expect(close).toHaveBeenCalled()
  expect(window.focus).toHaveBeenCalled()
  expect(window.navigate).toHaveBeenCalledWith('https://vada.test/?from=push')
  expect(self.clients.openWindow).not.toHaveBeenCalled()
})

test('열린 창이 없으면 새로 연다', async () => {
  const { self, fire } = load()
  await fire('notificationclick', { notification: { close: vi.fn(), data: { url: '/' } } })
  expect(self.clients.openWindow).toHaveBeenCalledWith('https://vada.test/')
})

test('새 서비스 워커는 기다리지 않고 바로 맡는다', async () => {
  const { self, fire } = load()
  await fire('install', {})
  await fire('activate', {})
  expect(self.skipWaiting).toHaveBeenCalled()
  expect(self.clients.claim).toHaveBeenCalled()
})
