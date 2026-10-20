// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { json, mockApi } from '@/test-support/mock-api'
import type { BrowserSubscription, PushBrowser } from './push-client'
import PushOffBand from './PushOffBand'
import type { PushEnvironment } from './usePush'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const KEY = 'BAECAw'
const keyBytes = Uint8Array.from([4, 1, 2, 3])
const subscription = {
  endpoint: 'https://fcm.googleapis.com/fcm/send/abc',
  options: { applicationServerKey: keyBytes.slice().buffer },
  toJSON: () => ({
    endpoint: 'https://fcm.googleapis.com/fcm/send/abc',
    expirationTime: null,
    keys: { p256dh: 'p'.repeat(87), auth: 'a'.repeat(22) },
  }),
  unsubscribe: vi.fn(async () => true),
} satisfies BrowserSubscription

function environment(
  options: {
    permission?: NotificationPermission
    existing?: BrowserSubscription | null
    supported?: boolean
    device?: PushEnvironment['device']
    homeScreenApp?: boolean
  } = {},
): PushEnvironment {
  const browser: PushBrowser = {
    supported: options.supported ?? true,
    permission: () => options.permission ?? 'default',
    pushManager: async () => ({
      getSubscription: async () => options.existing ?? null,
      subscribe: async () => subscription,
    }),
  }
  return {
    browser,
    device: options.device ?? 'android',
    homeScreenApp: options.homeScreenApp ?? false,
  }
}

function server() {
  const api = mockApi()
  api.on('GET', '/api/me/push', () => json({ publicKey: KEY }))
  api.on('POST', '/api/me/push/devices', () => new Response(null, { status: 204 }))
  return api
}

test('알림을 켜지 않았으면 띠가 보이고, 누르면 알림 대화상자가 열린다', async () => {
  server()
  render(<PushOffBand visible environment={environment()} />)
  fireEvent.click(await screen.findByRole('button', { name: '알림 켜기' }))
  expect(await screen.findByRole('dialog', { name: '휴대폰 알림' })).toBeTruthy()
})

test('알림이 꺼져 있다고 알린다(허락을 거절한 기기와 아이폰 사파리도)', async () => {
  server()
  const denied = render(<PushOffBand visible environment={environment({ permission: 'denied' })} />)
  expect(await screen.findByText(/휴대폰 알림이 꺼져 있어요/)).toBeTruthy()
  denied.unmount()
  render(<PushOffBand visible environment={environment({ device: 'ios' })} />)
  expect(await screen.findByText(/휴대폰 알림이 꺼져 있어요/)).toBeTruthy()
})

test('켜져 있으면 띠가 없고, 이미 켠 기기는 지금 계정으로 저장한다', async () => {
  const api = server()
  render(
    <PushOffBand
      visible
      environment={environment({ permission: 'granted', existing: subscription })}
    />,
  )
  await waitFor(() =>
    expect(
      api.calls.some(call => call.method === 'POST' && call.path === '/api/me/push/devices'),
    ).toBe(true),
  )
  expect(screen.queryByText(/휴대폰 알림이 꺼져 있어요/)).toBeNull()
})

test('대화 화면이 아니면 띠를 보이지 않지만 기기는 저장한다', async () => {
  const api = server()
  render(
    <PushOffBand
      visible={false}
      environment={environment({ permission: 'granted', existing: subscription })}
    />,
  )
  await waitFor(() =>
    expect(api.calls.some(call => call.path === '/api/me/push/devices')).toBe(true),
  )
  expect(screen.queryByRole('button', { name: '알림 켜기' })).toBeNull()
})

test('알림을 받을 수 없는 브라우저나 서버에 열쇠가 없을 때는 띠를 보이지 않는다', async () => {
  const api = mockApi()
  api.on('GET', '/api/me/push', () => json({ error: 'NOT_FOUND' }, 404))
  const view = render(<PushOffBand visible environment={environment({ supported: false })} />)
  expect(view.container.textContent).toBe('')
  view.unmount()
  render(<PushOffBand visible environment={environment()} />)
  await waitFor(() => expect(api.calls.length).toBe(1))
  expect(screen.queryByRole('button', { name: '알림 켜기' })).toBeNull()
})
