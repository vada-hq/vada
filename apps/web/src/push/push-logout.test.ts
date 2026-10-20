import { afterEach, expect, test, vi } from 'vitest'
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
