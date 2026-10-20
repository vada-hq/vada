import type { PushTestResponse, PushTestResult } from '@vada/contracts'
import type { BrowserSubscription } from './push-client'
import { forgetDevice, isUnsupportedService } from './push-device'

export type PushTest =
  | { kind: 'idle' }
  | { kind: 'sending' }
  | { kind: 'result'; result: PushTestResult }
  | { kind: 'unsupported-service'; host: string }
  | { kind: 'failed' }
  | { kind: 'unknown' }

export const unsupportedServiceOf = (endpoint: string): PushTest => ({
  kind: 'unsupported-service',
  host: new URL(endpoint).host,
})

async function postTest(subscription: BrowserSubscription): Promise<PushTest> {
  const response = await fetch('/api/me/push/test', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(subscription.toJSON()),
  })
  if (await isUnsupportedService(response)) return unsupportedServiceOf(subscription.endpoint)
  if (!response.ok) throw new Error('Push test failed')
  const { result } = (await response.json()) as PushTestResponse
  return { kind: 'result', result }
}

// 시험 알림을 보낸다. 5초를 기다리는 동안 화면을 끄면 iOS가 요청을 끊을 수 있다. 그때의 실패는 '모름'으로 돌려준다.
// 등록이 끝났다고(expired) 하면 구독을 지우고 서버의 기기도 지우며, 호출한 쪽이 구독을 비우도록 expired로 알린다.
export async function sendPushTest(
  subscription: BrowserSubscription,
): Promise<{ test: PushTest; expired: boolean }> {
  let hidden = false
  const onVisibility = () => {
    if (document.visibilityState === 'hidden') hidden = true
  }
  document.addEventListener('visibilitychange', onVisibility)
  try {
    const test = await postTest(subscription)
    const expired = test.kind === 'result' && test.result === 'expired'
    if (expired) {
      await subscription.unsubscribe().catch(() => false)
      forgetDevice(subscription.endpoint)
    }
    return { test, expired }
  } catch {
    return { test: { kind: hidden ? 'unknown' : 'failed' }, expired: false }
  } finally {
    document.removeEventListener('visibilitychange', onVisibility)
  }
}
