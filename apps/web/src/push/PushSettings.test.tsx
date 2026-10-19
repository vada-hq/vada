// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { deferredResponse, json, mockApi } from '@/test-support/mock-api'
import type { BrowserPushManager, BrowserSubscription, PushBrowser } from './push-client'
import PushSettingsButton, { PushSettingsBody } from './PushSettings'
import type { PushEnvironment } from './usePush'

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks() })

const KEY = 'BAECAw' // [4, 1, 2, 3]
const keyBytes = Uint8Array.from([4, 1, 2, 3])

function subscriptionOf(key: Uint8Array, endpoint = 'https://fcm.googleapis.com/fcm/send/abc') {
  return {
    endpoint,
    options: { applicationServerKey: key.slice().buffer },
    toJSON: () => ({ endpoint, expirationTime: null, keys: { p256dh: 'p'.repeat(87), auth: 'a'.repeat(22) } }),
    unsubscribe: vi.fn(async () => true),
  } satisfies BrowserSubscription
}

type Options = { device?: PushEnvironment['device']; homeScreenApp?: boolean; supported?: boolean; permission?: NotificationPermission
  existing?: BrowserSubscription | null; subscribe?: () => Promise<BrowserSubscription>; manager?: () => Promise<BrowserPushManager> }

function environment(options: Options = {}) {
  let permission = options.permission ?? 'default'
  const subscribe = vi.fn(options.subscribe ?? (async () => { permission = 'granted'; return subscriptionOf(keyBytes) }))
  const browser: PushBrowser = {
    supported: options.supported ?? true,
    permission: () => permission,
    pushManager: options.manager ?? (async () => ({ getSubscription: async () => options.existing ?? null, subscribe })),
  }
  const env: PushEnvironment = { browser, device: options.device ?? 'android', homeScreenApp: options.homeScreenApp ?? false }
  return { env, subscribe }
}

function serverWithKey() {
  const api = mockApi()
  api.on('GET', '/api/me/push', () => json({ publicKey: KEY }))
  return api
}

test('아이폰 사파리에서는 홈 화면에 추가하는 법을 보여 주고 서버를 부르지 않는다', () => {
  const api = mockApi()
  render(<PushSettingsBody environment={environment({ device: 'ios' }).env} />)
  expect(screen.getByText('아이폰은 홈 화면에 추가해야 알림을 받아요.')).toBeTruthy()
  expect(screen.getByText('로그인한 채로 추가하면 다시 로그인하지 않아도 돼요.')).toBeTruthy()
  expect(api.calls).toEqual([])
})

test('알림 API가 없는 브라우저는 받을 수 없다고 알린다', () => {
  mockApi()
  render(<PushSettingsBody environment={environment({ supported: false }).env} />)
  expect(screen.getByText('이 브라우저는 알림을 받을 수 없어요. Chrome이나 삼성 인터넷으로 열어 주세요.')).toBeTruthy()
})

test('서버에 알림 열쇠가 없으면 아직 쓸 수 없다고 알린다', async () => {
  const api = mockApi()
  api.on('GET', '/api/me/push', () => json({ error: 'NOT_FOUND' }, 404))
  render(<PushSettingsBody environment={environment().env} />)
  expect(await screen.findByText('아직 알림을 쓸 수 없어요.')).toBeTruthy()
  api.assertNoUnexpectedRequests()
})

test('서비스 워커가 준비되지 않으면 불러오지 못했다고 알리고 다시 시도할 수 있다', async () => {
  serverWithKey()
  let attempts = 0
  const { env } = environment({ manager: async () => { attempts++; throw new Error('Timed out') } })
  render(<PushSettingsBody environment={env} />)
  expect(await screen.findByText('알림 설정을 불러오지 못했어요.')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: '다시 시도' }))
  await waitFor(() => expect(attempts).toBe(2))
})

test('알림 켜기는 누른 동작 안에서 기다림 없이 구독하고, 켜지면 시험 알림 버튼을 보여 준다', async () => {
  serverWithKey()
  const { env, subscribe } = environment()
  render(<PushSettingsBody environment={env} />)
  fireEvent.click(await screen.findByRole('button', { name: '알림 켜기' }))
  expect(subscribe).toHaveBeenCalledTimes(1)
  expect(subscribe).toHaveBeenCalledWith({ userVisibleOnly: true, applicationServerKey: keyBytes })
  expect(await screen.findByText('이 기기에서 알림을 받아요.')).toBeTruthy()
})

test('허락 창을 닫아 구독이 실패하면 다시 누를 수 있게 알린다', async () => {
  serverWithKey()
  const { env } = environment({ subscribe: async () => { throw new DOMException('dismissed', 'NotAllowedError') } })
  render(<PushSettingsBody environment={env} />)
  fireEvent.click(await screen.findByRole('button', { name: '알림 켜기' }))
  expect(await screen.findByText('알림을 켜지 못했어요. 다시 눌러 주세요.')).toBeTruthy()
  expect(screen.getByRole('button', { name: '알림 켜기' })).toBeTruthy()
})

test('거절했으면 기기별로 다시 켜는 곳을 알려 준다', async () => {
  serverWithKey()
  render(<PushSettingsBody environment={environment({ device: 'ios', homeScreenApp: true, permission: 'denied' }).env} />)
  expect(await screen.findByText('알림이 꺼져 있어요. 설정 → 알림 → VADA에서 켜 주세요.')).toBeTruthy()
})

test('서버 열쇠가 바뀐 옛 구독은 켜기 전으로 보고, 켜면 지운 뒤 다시 구독한다', async () => {
  serverWithKey()
  const old = subscriptionOf(Uint8Array.from([4, 9, 9, 9]))
  const { env, subscribe } = environment({ permission: 'granted', existing: old })
  render(<PushSettingsBody environment={env} />)
  fireEvent.click(await screen.findByRole('button', { name: '알림 켜기' }))
  await waitFor(() => expect(subscribe).toHaveBeenCalledTimes(1))
  expect(old.unsubscribe).toHaveBeenCalled()
  expect(await screen.findByText('이 기기에서 알림을 받아요.')).toBeTruthy()
})

test('시험 알림은 구독을 보내고, 보내는 동안 버튼을 막아 한 번만 보낸다', async () => {
  const api = serverWithKey()
  const pending = deferredResponse()
  api.on('POST', '/api/me/push/test', () => pending.promise)
  const existing = subscriptionOf(keyBytes)
  render(<PushSettingsBody environment={environment({ permission: 'granted', existing }).env} />)
  const button = await screen.findByRole('button', { name: '시험 알림 보내기' })
  fireEvent.click(button)
  fireEvent.click(button)
  expect(await screen.findByText('5초 뒤에 알림이 와요. 화면을 끄거나 홈으로 나가 기다려 보세요.')).toBeTruthy()
  expect((screen.getByRole('button', { name: '시험 알림 보내기' }) as HTMLButtonElement).disabled).toBe(true)
  pending.resolve(json({ result: 'sent' }))
  expect(await screen.findByText('보냈어요. 알림이 왔는지 확인해 주세요.')).toBeTruthy()
  const posts = api.calls.filter(call => call.method === 'POST')
  expect(posts).toHaveLength(1)
  expect(posts[0]!.body).toEqual(existing.toJSON())
})

test('구독이 끝났으면 지우고 다시 켜게 한다', async () => {
  const api = serverWithKey()
  api.on('POST', '/api/me/push/test', () => json({ result: 'expired' }))
  const existing = subscriptionOf(keyBytes)
  render(<PushSettingsBody environment={environment({ permission: 'granted', existing }).env} />)
  fireEvent.click(await screen.findByRole('button', { name: '시험 알림 보내기' }))
  expect(await screen.findByText('이 기기의 알림 등록이 끝났어요. 알림을 다시 켜 주세요.')).toBeTruthy()
  expect(existing.unsubscribe).toHaveBeenCalled()
  expect(screen.getByRole('button', { name: '알림 켜기' })).toBeTruthy()
})

test('알림 서버가 받지 않으면 그렇게 알린다', async () => {
  const api = serverWithKey()
  api.on('POST', '/api/me/push/test', () => json({ result: 'rejected' }))
  render(<PushSettingsBody environment={environment({ permission: 'granted', existing: subscriptionOf(keyBytes) }).env} />)
  fireEvent.click(await screen.findByRole('button', { name: '시험 알림 보내기' }))
  expect(await screen.findByText('알림 서버가 받지 않았어요.')).toBeTruthy()
})

test('서버가 모르는 알림 서버면 그 호스트를 보여 준다', async () => {
  const api = serverWithKey()
  api.on('POST', '/api/me/push/test', () => json({ error: 'PUSH_SERVICE_UNSUPPORTED' }, 400))
  const existing = subscriptionOf(keyBytes, 'https://push.samsung.example/abc')
  render(<PushSettingsBody environment={environment({ permission: 'granted', existing }).env} />)
  fireEvent.click(await screen.findByRole('button', { name: '시험 알림 보내기' }))
  expect(await screen.findByText('이 브라우저의 알림 서버(push.samsung.example)는 아직 받지 않아요.')).toBeTruthy()
})

test('기다리는 동안 화면을 꺼서 요청이 끊기면 실패 대신 모른다고 알린다', async () => {
  const api = serverWithKey()
  const pending = deferredResponse()
  api.on('POST', '/api/me/push/test', () => pending.promise.then(() => { throw new TypeError('Load failed') }))
  render(<PushSettingsBody environment={environment({ permission: 'granted', existing: subscriptionOf(keyBytes) }).env} />)
  fireEvent.click(await screen.findByRole('button', { name: '시험 알림 보내기' }))
  const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
  document.dispatchEvent(new Event('visibilitychange'))
  visibility.mockReturnValue('visible')
  pending.resolve(json({}))
  expect(await screen.findByText('결과를 받지 못했어요. 알림이 왔다면 잘 된 거예요.')).toBeTruthy()
})

test('화면을 끄지 않았는데 요청이 실패하면 연결을 확인하라고 한다', async () => {
  const api = serverWithKey()
  api.on('POST', '/api/me/push/test', () => json({ error: 'Internal server error' }, 500))
  render(<PushSettingsBody environment={environment({ permission: 'granted', existing: subscriptionOf(keyBytes) }).env} />)
  fireEvent.click(await screen.findByRole('button', { name: '시험 알림 보내기' }))
  expect(await screen.findByText('시험 알림을 보내지 못했어요. 연결을 확인해 주세요.')).toBeTruthy()
})

test('종 버튼을 눌러야 대화상자를 열고, 그 전에는 서버를 부르지 않는다', async () => {
  const api = mockApi()
  render(<PushSettingsButton />)
  expect(api.calls).toEqual([])
  fireEvent.click(screen.getByRole('button', { name: '휴대폰 알림' }))
  expect(await screen.findByRole('dialog', { name: '휴대폰 알림' })).toBeTruthy()
  api.assertNoUnexpectedRequests()
})
