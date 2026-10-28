import { updateAppBadge } from '@/lib/app-badge'
import { withTimeout } from './push-client'
import { removeDevice, settlePendingSaves } from './push-device'

const LOGOUT_FORGET_MS = 3000

// 이 기기의 구독 주소. 서비스 워커나 구독이 없으면 null이다.
async function currentEndpoint(): Promise<string | null> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return null
  const registration = await navigator.serviceWorker.getRegistration()
  const subscription = await registration?.pushManager.getSubscription()
  return subscription?.endpoint ?? null
}

// 로그아웃 전에 서버의 이 기기 줄을 지워, 그 계정의 알림이 이 기기로 오지 않게 한다. 브라우저 구독은 남긴다(다음 로그인 때 다시 저장한다).
// 실패하거나 시간이 넘어도 던지지 않는다. 로그아웃을 막지 않기 위해서다.
export async function forgetThisDevice(timeoutMs = LOGOUT_FORGET_MS): Promise<void> {
  void updateAppBadge(0)
  try {
    await withTimeout(
      settlePendingSaves()
        .then(currentEndpoint)
        .then(endpoint => (endpoint ? removeDevice(endpoint) : undefined)),
      timeoutMs,
    )
  } catch {
    // 못 지워도 로그아웃은 한다. 끝난 구독은 서버가 보낼 때 알아서 지운다.
  }
}
