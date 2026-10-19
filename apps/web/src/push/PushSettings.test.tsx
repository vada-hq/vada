// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { deferredResponse, json, mockApi } from '@/test-support/mock-api'
import type { BrowserPushManager, BrowserSubscription, PushBrowser } from './push-client'
import PushSettingsButton, { PushSettingsBody } from './PushSettings'
import type { PushEnvironment } from './usePush'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

const KEY = 'BAECAw' // [4, 1, 2, 3]
const keyBytes = Uint8Array.from([4, 1, 2, 3])

function subscriptionOf(key: Uint8Array, endpoint = 'https://fcm.googleapis.com/fcm/send/abc') {
  return {
    endpoint,
    options: { applicationServerKey: key.slice().buffer },
    toJSON: () => ({
      endpoint,
      expirationTime: null,
      keys: { p256dh: 'p'.repeat(87), auth: 'a'.repeat(22) },
    }),
    unsubscribe: vi.fn(async () => true),
  } satisfies BrowserSubscription
}

// 가짜 브라우저의 바뀔 수 있는 상태. subscribe가 이것을 받아, 허락 창의 결과대로 알림 허락을 바꿀 수 있다.
type FakeBrowserState = { permission: NotificationPermission }
type Options = {
  device?: PushEnvironment['device']
  homeScreenApp?: boolean
  supported?: boolean
  permission?: NotificationPermission
  existing?: BrowserSubscription | null
  subscribe?: (state: FakeBrowserState) => Promise<BrowserSubscription>
  manager?: () => Promise<BrowserPushManager>
}

function environment(options: Options = {}) {
  const state: FakeBrowserState = { permission: options.permission ?? 'default' }
  const subscribe = vi.fn(async () => {
    if (options.subscribe) return options.subscribe(state)
    state.permission = 'granted'
    return subscriptionOf(keyBytes)
  })
  const browser: PushBrowser = {
    supported: options.supported ?? true,
    permission: () => state.permission,
    pushManager:
      options.manager ??
      (async () => ({ getSubscription: async () => options.existing ?? null, subscribe })),
  }
  const env: PushEnvironment = {
    browser,
    device: options.device ?? 'android',
    homeScreenApp: options.homeScreenApp ?? false,
  }
  return { env, subscribe }
}

// 열쇠를 주고 기기 저장·지우기를 받는다. 대화상자를 열 때 이미 켜진 구독은 저장되고 옛 구독은 지워진다(바탕 Task 10).
// 저장 실패를 보는 시험은 이 경로를 다시 등록한다.
function serverWithKey() {
  const api = mockApi()
  api.on('GET', '/api/me/push', () => json({ publicKey: KEY }))
  api.on('POST', '/api/me/push/devices', () => new Response(null, { status: 204 }))
  api.on('POST', '/api/me/push/devices/remove', () => new Response(null, { status: 204 }))
  return api
}

test('아이폰 사파리에서는 홈 화면에 추가하는 법을 보여 주고 서버를 부르지 않는다', () => {
  const api = mockApi()
  render(<PushSettingsBody environment={environment({ device: 'ios' }).env} />)
  expect(screen.getByText('아이폰은 홈 화면에 추가해야 알림을 받아요.')).toBeTruthy()
  expect(screen.getByText('로그인한 채로 추가하면 다시 로그인하지 않아도 돼요.')).toBeTruthy()
  expect(api.calls).toEqual([])
})

test('알림 API가 없는 브라우저는 받을 수 없다고 알리고 서버를 부르지 않는다', () => {
  const api = mockApi()
  render(<PushSettingsBody environment={environment({ supported: false }).env} />)
  expect(
    screen.getByText(
      '이 브라우저는 알림을 받을 수 없어요. Chrome이나 삼성 인터넷으로 열어 주세요.',
    ),
  ).toBeTruthy()
  expect(api.calls).toEqual([])
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
  const { env } = environment({
    manager: async () => {
      attempts++
      throw new Error('Timed out')
    },
  })
  render(<PushSettingsBody environment={env} />)
  expect(await screen.findByText('알림 설정을 불러오지 못했어요.')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: '다시 시도' }))
  await waitFor(() => expect(attempts).toBe(2))
})

test('알림 켜기는 누른 동작 안에서 기다림 없이 구독하고, 기기를 저장한 뒤 시험 알림 버튼을 보여 준다', async () => {
  const api = serverWithKey()
  const { env, subscribe } = environment()
  render(<PushSettingsBody environment={env} />)
  fireEvent.click(await screen.findByRole('button', { name: '알림 켜기' }))
  expect(subscribe).toHaveBeenCalledTimes(1)
  expect(subscribe).toHaveBeenCalledWith({ userVisibleOnly: true, applicationServerKey: keyBytes })
  expect(await screen.findByText('이 기기에서 알림을 받아요.')).toBeTruthy()
  const saved = api.calls.filter(
    call => call.method === 'POST' && call.path === '/api/me/push/devices',
  )
  expect(saved.map(call => call.body)).toEqual([subscriptionOf(keyBytes).toJSON()])
  api.assertNoUnexpectedRequests()
})

test('기기를 저장하지 못하면 구독을 지우고 다시 누르게 한다', async () => {
  const api = serverWithKey()
  api.on('POST', '/api/me/push/devices', () => json({ error: 'Internal server error' }, 500))
  const created = subscriptionOf(keyBytes)
  const { env } = environment({ subscribe: async () => created })
  render(<PushSettingsBody environment={env} />)
  fireEvent.click(await screen.findByRole('button', { name: '알림 켜기' }))
  expect(await screen.findByText('알림을 켜지 못했어요. 다시 눌러 주세요.')).toBeTruthy()
  expect(created.unsubscribe).toHaveBeenCalled()
  expect(screen.getByRole('button', { name: '알림 켜기' })).toBeTruthy()
})

test('허락 창을 닫아 구독이 실패하면 다시 누를 수 있게 알린다', async () => {
  serverWithKey()
  const { env } = environment({
    subscribe: async () => {
      throw new DOMException('dismissed', 'NotAllowedError')
    },
  })
  render(<PushSettingsBody environment={env} />)
  fireEvent.click(await screen.findByRole('button', { name: '알림 켜기' }))
  expect(await screen.findByText('알림을 켜지 못했어요. 다시 눌러 주세요.')).toBeTruthy()
  expect(screen.getByRole('button', { name: '알림 켜기' })).toBeTruthy()
})

test('거절했으면 기기별로 다시 켜는 곳을 알려 준다', async () => {
  serverWithKey()
  render(
    <PushSettingsBody
      environment={environment({ device: 'ios', homeScreenApp: true, permission: 'denied' }).env}
    />,
  )
  expect(
    await screen.findByText('알림이 꺼져 있어요. 설정 → 알림 → VADA에서 켜 주세요.'),
  ).toBeTruthy()
})

test('허락 창에서 거절해 구독이 실패하면 다시 누르게 두지 않고 꺼짐 안내로 바뀐다', async () => {
  serverWithKey()
  const { env } = environment({
    device: 'ios',
    homeScreenApp: true,
    subscribe: async state => {
      state.permission = 'denied'
      throw new DOMException('denied', 'NotAllowedError')
    },
  })
  render(<PushSettingsBody environment={env} />)
  fireEvent.click(await screen.findByRole('button', { name: '알림 켜기' }))
  expect(
    await screen.findByText('알림이 꺼져 있어요. 설정 → 알림 → VADA에서 켜 주세요.'),
  ).toBeTruthy()
  expect(screen.queryByRole('button', { name: '알림 켜기' })).toBeNull()
  expect(screen.queryByText('알림을 켜지 못했어요. 다시 눌러 주세요.')).toBeNull()
})

test('서버 열쇠가 바뀐 옛 구독은 열 때 지우고 서버에서도 지우며, 켜기는 누른 동작 안에서 새 열쇠로 바로 구독한 뒤 기기를 저장한다', async () => {
  const api = serverWithKey()
  const old = subscriptionOf(
    Uint8Array.from([4, 9, 9, 9]),
    'https://fcm.googleapis.com/fcm/send/old',
  )
  const { env, subscribe } = environment({ permission: 'granted', existing: old })
  render(<PushSettingsBody environment={env} />)
  const enable = await screen.findByRole('button', { name: '알림 켜기' })
  expect(old.unsubscribe).toHaveBeenCalledTimes(1)
  expect(subscribe).not.toHaveBeenCalled()
  // 옛 구독은 서버에서도 지운다.
  await waitFor(() =>
    expect(
      api.calls.filter(call => call.path === '/api/me/push/devices/remove').map(call => call.body),
    ).toEqual([{ endpoint: 'https://fcm.googleapis.com/fcm/send/old' }]),
  )
  fireEvent.click(enable)
  // 아이폰은 누른 동작 안에서만 허락을 묻는다. 기다리지 않고 누른 바로 뒤에 확인한다.
  expect(subscribe).toHaveBeenCalledTimes(1)
  expect(subscribe).toHaveBeenCalledWith({ userVisibleOnly: true, applicationServerKey: keyBytes })
  expect(old.unsubscribe).toHaveBeenCalledTimes(1)
  expect(await screen.findByText('이 기기에서 알림을 받아요.')).toBeTruthy()
  expect(
    api.calls.filter(call => call.path === '/api/me/push/devices').map(call => call.body),
  ).toEqual([subscriptionOf(keyBytes).toJSON()])
  api.assertNoUnexpectedRequests()
})

test('옛 구독을 지우지 못해도 켜기 전으로 보여 주고, 켜기는 바로 구독한다', async () => {
  serverWithKey()
  const old = subscriptionOf(Uint8Array.from([4, 9, 9, 9]))
  old.unsubscribe.mockRejectedValue(new DOMException('failed', 'InvalidStateError'))
  const { env, subscribe } = environment({ permission: 'granted', existing: old })
  render(<PushSettingsBody environment={env} />)
  fireEvent.click(await screen.findByRole('button', { name: '알림 켜기' }))
  expect(subscribe).toHaveBeenCalledTimes(1)
  expect(await screen.findByText('이 기기에서 알림을 받아요.')).toBeTruthy()
})

test('이미 켜진 구독은 열 때 서버에 기기를 저장한다(덩어리 1에서 켠 기기도 이 계정의 기기가 된다)', async () => {
  const api = serverWithKey()
  const existing = subscriptionOf(keyBytes)
  render(<PushSettingsBody environment={environment({ permission: 'granted', existing }).env} />)
  expect(await screen.findByText('이 기기에서 알림을 받아요.')).toBeTruthy()
  expect(
    api.calls
      .filter(call => call.method === 'POST' && call.path === '/api/me/push/devices')
      .map(call => call.body),
  ).toEqual([existing.toJSON()])
  expect(existing.unsubscribe).not.toHaveBeenCalled()
  api.assertNoUnexpectedRequests()
})

test('이미 켜진 구독을 열 때 저장하지 못하면 구독은 지우지 않고 꺼진 것으로 보여 주고, 켜기를 누르면 같은 구독을 저장한다', async () => {
  const api = serverWithKey()
  let attempts = 0
  api.on('POST', '/api/me/push/devices', () =>
    ++attempts === 1
      ? json({ error: 'Internal server error' }, 500)
      : new Response(null, { status: 204 }),
  )
  const existing = subscriptionOf(keyBytes)
  // 같은 열쇠로 다시 구독하면 브라우저는 있던 구독을 돌려준다(W3C Push API).
  const { env, subscribe } = environment({
    permission: 'granted',
    existing,
    subscribe: async () => existing,
  })
  render(<PushSettingsBody environment={env} />)
  expect(await screen.findByText('알림을 켜지 못했어요. 다시 눌러 주세요.')).toBeTruthy()
  expect(existing.unsubscribe).not.toHaveBeenCalled()
  expect(screen.queryByText('이 기기에서 알림을 받아요.')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: '알림 켜기' }))
  expect(await screen.findByText('이 기기에서 알림을 받아요.')).toBeTruthy()
  expect(subscribe).toHaveBeenCalledTimes(1)
  expect(existing.unsubscribe).not.toHaveBeenCalled()
  expect(screen.queryByText('알림을 켜지 못했어요. 다시 눌러 주세요.')).toBeNull()
  expect(
    api.calls.filter(call => call.path === '/api/me/push/devices').map(call => call.body),
  ).toEqual([existing.toJSON(), existing.toJSON()])
})

// 닫은 뒤에 응답이 와도 구독을 지우거나 서버를 더 부르지 않는다.
test('저장 응답을 기다리는 중에 대화상자를 닫으면 구독을 지우지 않고 서버를 더 부르지 않는다', async () => {
  const api = serverWithKey()
  const pending = deferredResponse()
  api.on('POST', '/api/me/push/devices', () => pending.promise)
  const existing = subscriptionOf(keyBytes)
  const { unmount } = render(
    <PushSettingsBody environment={environment({ permission: 'granted', existing }).env} />,
  )
  await waitFor(() =>
    expect(api.calls.filter(call => call.path === '/api/me/push/devices')).toHaveLength(1),
  )
  unmount()
  pending.resolve(json({ error: 'Internal server error' }, 500))
  await new Promise(resolve => setTimeout(resolve, 20))
  expect(existing.unsubscribe).not.toHaveBeenCalled()
  expect(api.calls.map(call => call.path)).toEqual(['/api/me/push', '/api/me/push/devices'])
})

test('구독을 읽는 중에 대화상자를 닫으면 옛 구독 지우기도 서버 요청도 하지 않는다', async () => {
  const api = serverWithKey()
  const old = subscriptionOf(
    Uint8Array.from([4, 9, 9, 9]),
    'https://fcm.googleapis.com/fcm/send/old',
  )
  let finishReading!: (subscription: BrowserSubscription) => void
  const reading = new Promise<BrowserSubscription>(resolve => {
    finishReading = resolve
  })
  const getSubscription = vi.fn(() => reading)
  const { env } = environment({
    permission: 'granted',
    manager: async () => ({ getSubscription, subscribe: vi.fn() }),
  })
  const { unmount } = render(<PushSettingsBody environment={env} />)
  await waitFor(() => expect(getSubscription).toHaveBeenCalledTimes(1))
  unmount()
  finishReading(old)
  await new Promise(resolve => setTimeout(resolve, 20))
  expect(old.unsubscribe).not.toHaveBeenCalled()
  expect(api.calls.map(call => call.path)).toEqual(['/api/me/push'])
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
  expect(
    await screen.findByText('5초 뒤에 알림이 와요. 화면을 끄거나 홈으로 나가 기다려 보세요.'),
  ).toBeTruthy()
  expect(
    (screen.getByRole('button', { name: '시험 알림 보내기' }) as HTMLButtonElement).disabled,
  ).toBe(true)
  pending.resolve(json({ result: 'sent' }))
  expect(await screen.findByText('보냈어요. 알림이 왔는지 확인해 주세요.')).toBeTruthy()
  const posts = api.calls.filter(call => call.path === '/api/me/push/test')
  expect(posts).toHaveLength(1)
  expect(posts[0]!.body).toEqual(existing.toJSON())
})

test('구독이 끝났으면 지우고 다시 켜게 한다', async () => {
  const api = serverWithKey()
  api.on('POST', '/api/me/push/test', () => json({ result: 'expired' }))
  const existing = subscriptionOf(keyBytes)
  render(<PushSettingsBody environment={environment({ permission: 'granted', existing }).env} />)
  fireEvent.click(await screen.findByRole('button', { name: '시험 알림 보내기' }))
  expect(
    await screen.findByText('이 기기의 알림 등록이 끝났어요. 알림을 다시 켜 주세요.'),
  ).toBeTruthy()
  expect(existing.unsubscribe).toHaveBeenCalled()
  expect(screen.getByRole('button', { name: '알림 켜기' })).toBeTruthy()
  // 끝난 구독은 서버에서도 지운다.
  await waitFor(() =>
    expect(
      api.calls.filter(call => call.path === '/api/me/push/devices/remove').map(call => call.body),
    ).toEqual([{ endpoint: existing.endpoint }]),
  )
})

test('끝난 구독을 다시 켜면 끝났다는 안내가 사라진다', async () => {
  const api = serverWithKey()
  api.on('POST', '/api/me/push/test', () => json({ result: 'expired' }))
  render(
    <PushSettingsBody
      environment={environment({ permission: 'granted', existing: subscriptionOf(keyBytes) }).env}
    />,
  )
  fireEvent.click(await screen.findByRole('button', { name: '시험 알림 보내기' }))
  expect(
    await screen.findByText('이 기기의 알림 등록이 끝났어요. 알림을 다시 켜 주세요.'),
  ).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: '알림 켜기' }))
  expect(screen.queryByText('이 기기의 알림 등록이 끝났어요. 알림을 다시 켜 주세요.')).toBeNull()
  expect(await screen.findByText('이 기기에서 알림을 받아요.')).toBeTruthy()
})

test('알림 서버가 받지 않으면 그렇게 알린다', async () => {
  const api = serverWithKey()
  api.on('POST', '/api/me/push/test', () => json({ result: 'rejected' }))
  render(
    <PushSettingsBody
      environment={environment({ permission: 'granted', existing: subscriptionOf(keyBytes) }).env}
    />,
  )
  fireEvent.click(await screen.findByRole('button', { name: '시험 알림 보내기' }))
  expect(await screen.findByText('알림 서버가 받지 않았어요.')).toBeTruthy()
})

// 진짜 서버처럼 모르는 알림 서버의 기기 저장은 400 PUSH_SERVICE_UNSUPPORTED로 거절한다.
test('서버가 모르는 알림 서버면 열 때 그 호스트를 보여 주고, 켜지 못했다며 다시 누르게 하지 않는다', async () => {
  const api = serverWithKey()
  api.on('POST', '/api/me/push/devices', () => json({ error: 'PUSH_SERVICE_UNSUPPORTED' }, 400))
  const existing = subscriptionOf(keyBytes, 'https://push.samsung.example/abc')
  render(<PushSettingsBody environment={environment({ permission: 'granted', existing }).env} />)
  expect(
    await screen.findByText('이 브라우저의 알림 서버(push.samsung.example)는 아직 받지 않아요.'),
  ).toBeTruthy()
  expect(screen.queryByText('알림을 켜지 못했어요. 다시 눌러 주세요.')).toBeNull()
  expect(screen.queryByText('이 기기에서 알림을 받아요.')).toBeNull()
  expect(existing.unsubscribe).not.toHaveBeenCalled()
})

test('알림 켜기에서 저장이 모르는 알림 서버라고 거절되면 그 호스트를 보여 주고, 켜지 못했다며 다시 누르게 하지 않는다', async () => {
  const api = serverWithKey()
  api.on('POST', '/api/me/push/devices', () => json({ error: 'PUSH_SERVICE_UNSUPPORTED' }, 400))
  const created = subscriptionOf(keyBytes, 'https://push.samsung.example/abc')
  render(<PushSettingsBody environment={environment({ subscribe: async () => created }).env} />)
  fireEvent.click(await screen.findByRole('button', { name: '알림 켜기' }))
  expect(
    await screen.findByText('이 브라우저의 알림 서버(push.samsung.example)는 아직 받지 않아요.'),
  ).toBeTruthy()
  expect(screen.queryByText('알림을 켜지 못했어요. 다시 눌러 주세요.')).toBeNull()
  expect(screen.queryByText('이 기기에서 알림을 받아요.')).toBeNull()
  expect(created.unsubscribe).toHaveBeenCalled()
})

// 기기 저장은 받았는데 시험 알림에서 모른다고 하는 경우(서버 쪽 알림 서버 목록이 어긋난 때)도 호스트를 보여 준다.
test('시험 알림에서 서버가 모르는 알림 서버라고 하면 그 호스트를 보여 준다', async () => {
  const api = serverWithKey()
  api.on('POST', '/api/me/push/test', () => json({ error: 'PUSH_SERVICE_UNSUPPORTED' }, 400))
  render(
    <PushSettingsBody
      environment={environment({ permission: 'granted', existing: subscriptionOf(keyBytes) }).env}
    />,
  )
  fireEvent.click(await screen.findByRole('button', { name: '시험 알림 보내기' }))
  expect(
    await screen.findByText('이 브라우저의 알림 서버(fcm.googleapis.com)는 아직 받지 않아요.'),
  ).toBeTruthy()
})

test('기다리는 동안 화면을 꺼서 요청이 끊기면 실패 대신 모른다고 알린다', async () => {
  const api = serverWithKey()
  const pending = deferredResponse()
  api.on('POST', '/api/me/push/test', () =>
    pending.promise.then(() => {
      throw new TypeError('Load failed')
    }),
  )
  render(
    <PushSettingsBody
      environment={environment({ permission: 'granted', existing: subscriptionOf(keyBytes) }).env}
    />,
  )
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
  render(
    <PushSettingsBody
      environment={environment({ permission: 'granted', existing: subscriptionOf(keyBytes) }).env}
    />,
  )
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

// jsdom에는 알림 API가 없어 위 테스트의 훅은 열든 닫든 서버를 부르지 않는다. browserPush()가 보는 세 가지를 갖춰 알림이 가능한 브라우저로 꾸민다.
test('알림이 가능한 브라우저에서도 열기 전에는 서버를 부르지 않고, 열면 한 번 부른다', async () => {
  const api = mockApi()
  api.on('GET', '/api/me/push', () => json({ error: 'NOT_FOUND' }, 404))
  Object.defineProperty(navigator, 'serviceWorker', { value: {}, configurable: true })
  vi.stubGlobal('PushManager', class {})
  vi.stubGlobal('Notification', { permission: 'default' })
  try {
    // 사이드바는 데스크톱 aside와 휴대폰 옆 메뉴에서 두 번 그려진다.
    render(<PushSettingsButton />)
    render(<PushSettingsButton />)
    expect(api.calls).toEqual([])
    fireEvent.click(screen.getAllByRole('button', { name: '휴대폰 알림' })[0]!)
    expect(await screen.findByText('아직 알림을 쓸 수 없어요.')).toBeTruthy()
    expect(api.calls.map(call => `${call.method} ${call.path}`)).toEqual(['GET /api/me/push'])
    api.assertNoUnexpectedRequests()
  } finally {
    // defineProperty로 단 것은 vi.unstubAllGlobals()가 돌려놓지 못한다.
    delete (navigator as unknown as Record<string, unknown>).serviceWorker
  }
})
