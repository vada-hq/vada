import { afterEach, expect, test, vi } from 'vitest'
import { base64UrlToBytes, sameKey, withTimeout, type BrowserSubscription } from './push-client'

afterEach(() => {
  vi.useRealTimers()
})

test('URL용 base64 열쇠를 바이트로 바꾼다', () => {
  expect([...base64UrlToBytes('AQID')]).toEqual([1, 2, 3])
  expect([...base64UrlToBytes('-_8')]).toEqual([251, 255])
  expect(base64UrlToBytes('B'.repeat(87))).toHaveLength(65)
})

test('구독의 열쇠가 서버 열쇠와 같은지 본다', () => {
  const key = Uint8Array.from([4, 1, 2])
  const subscription = (bytes: number[] | null): BrowserSubscription => ({
    endpoint: 'https://fcm.googleapis.com/x',
    options: { applicationServerKey: bytes ? Uint8Array.from(bytes).buffer : null },
    toJSON: () => ({}),
    unsubscribe: async () => true,
  })
  expect(sameKey(subscription([4, 1, 2]), key)).toBe(true)
  expect(sameKey(subscription([4, 1, 3]), key)).toBe(false)
  expect(sameKey(subscription([4, 1]), key)).toBe(false)
  expect(sameKey(subscription(null), key)).toBe(false)
})

test('끝나지 않는 기다림은 시간이 지나면 실패한다', async () => {
  vi.useFakeTimers()
  const outcome = withTimeout(new Promise(() => {}), 10_000).then(
    () => 'resolved',
    () => 'timed out',
  )
  await vi.advanceTimersByTimeAsync(10_000)
  expect(await outcome).toBe('timed out')
  vi.useRealTimers()
  expect(await withTimeout(Promise.resolve('ok'), 10_000)).toBe('ok')
})

test('기다리던 쪽이 실패하면 그 사유를 그대로 전하고 타이머를 남기지 않는다', async () => {
  vi.useFakeTimers()
  const reason = new Error('subscribe failed')
  await expect(withTimeout(Promise.reject(reason), 10_000)).rejects.toBe(reason)
  expect(vi.getTimerCount()).toBe(0)
  await expect(withTimeout(Promise.resolve('ok'), 10_000)).resolves.toBe('ok')
  expect(vi.getTimerCount()).toBe(0)
  vi.useRealTimers()
})
