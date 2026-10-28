import { afterEach, expect, test, vi } from 'vitest'
import { saveDevice } from './push-device'
import { forgetThisDevice } from './push-logout'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

const ENDPOINT = 'https://fcm.googleapis.com/fcm/send/abc'

function stubBrowser(subscription: { endpoint: string } | null, request = vi.fn()) {
  vi.stubGlobal('navigator', {
    serviceWorker: {
      getRegistration: async () => ({ pushManager: { getSubscription: async () => subscription } }),
    },
  })
  vi.stubGlobal('fetch', request)
  return request
}

test('로그아웃할 때 구독이 없어도 이 기기의 앱 배지를 지운다', async () => {
  const clearAppBadge = vi.fn(async () => {})
  vi.stubGlobal('navigator', { clearAppBadge })
  await forgetThisDevice()
  expect(clearAppBadge).toHaveBeenCalledOnce()
})

test('배지 지우기가 실패하거나 끝나지 않아도 로그아웃을 막지 않는다', async () => {
  for (const clearAppBadge of [
    vi.fn(async () => {
      throw new Error('denied')
    }),
    vi.fn(() => new Promise<void>(() => {})),
  ]) {
    vi.stubGlobal('navigator', { clearAppBadge })
    await expect(forgetThisDevice()).resolves.toBeUndefined()
    expect(clearAppBadge).toHaveBeenCalledOnce()
  }
})

test('이 기기의 구독 주소로 서버의 기기 줄을 지운다', async () => {
  const request = stubBrowser(
    { endpoint: ENDPOINT },
    vi.fn(async () => new Response(null)),
  )
  await forgetThisDevice()
  expect(request).toHaveBeenCalledTimes(1)
  const [path, init] = request.mock.calls[0] as [string, RequestInit]
  expect(path).toBe('/api/me/push/devices/remove')
  expect(JSON.parse(init.body as string)).toEqual({ endpoint: ENDPOINT })
})

test('구독이 없거나 서비스 워커가 없으면 서버를 부르지 않는다', async () => {
  const request = stubBrowser(null)
  await forgetThisDevice()
  vi.stubGlobal('navigator', {})
  await forgetThisDevice()
  expect(request).not.toHaveBeenCalled()
})

test('요청이 실패해도 던지지 않는다', async () => {
  stubBrowser(
    { endpoint: ENDPOINT },
    vi.fn(async () => {
      throw new Error('offline')
    }),
  )
  await expect(forgetThisDevice()).resolves.toBeUndefined()
})

test('3초가 넘으면 기다리지 않는다', async () => {
  vi.useFakeTimers()
  stubBrowser(
    { endpoint: ENDPOINT },
    vi.fn(() => new Promise<Response>(() => {})),
  )
  const done = vi.fn()
  void forgetThisDevice().then(done)
  await vi.advanceTimersByTimeAsync(2999)
  expect(done).not.toHaveBeenCalled()
  await vi.advanceTimersByTimeAsync(2)
  expect(done).toHaveBeenCalled()
})

test('진행 중인 기기 저장이 끝난 뒤에 지운다(늦은 저장이 지운 줄을 되살리지 않게)', async () => {
  const order: string[] = []
  let finishSave: (() => void) | undefined
  const request = stubBrowser(
    { endpoint: ENDPOINT },
    vi.fn((path: string) => {
      if (path.endsWith('/remove')) {
        order.push('지우기')
        return Promise.resolve(new Response(null))
      }
      return new Promise<Response>(resolve => {
        finishSave = () => {
          order.push('저장 끝')
          resolve(new Response(null))
        }
      })
    }),
  )
  const saving = saveDevice({
    endpoint: ENDPOINT,
    toJSON: () => ({}),
  } as unknown as Parameters<typeof saveDevice>[0])
  const forgetting = forgetThisDevice()
  await new Promise(resolve => setTimeout(resolve, 20))
  expect(order).toEqual([])
  finishSave?.()
  await saving
  await forgetting
  expect(order).toEqual(['저장 끝', '지우기'])
  expect(request).toHaveBeenCalledTimes(2)
})
