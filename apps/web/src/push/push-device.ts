import { statusOf } from '@vada/contracts'
import type { BrowserPushManager, BrowserSubscription } from './push-client'

export type SaveResult = 'saved' | 'unsupported' | 'failed'

const JSON_HEADERS = { 'Content-Type': 'application/json' }

// 서버가 모르는 알림 서버라고 거절한 응답인지. 다시 눌러도 같으므로 일반 실패와 나눈다.
export async function isUnsupportedService(response: Response): Promise<boolean> {
  return (
    response.status === statusOf('PUSH_SERVICE_UNSUPPORTED') &&
    ((await response.json()) as { error?: string }).error === 'PUSH_SERVICE_UNSUPPORTED'
  )
}

// 알림 받을 기기를 서버에 저장한다(바탕 spec G10). 같은 구독 주소면 서버가 열쇠를 갱신한다.
// 서버가 모르는 알림 서버라고 거절하면(PUSH_SERVICE_UNSUPPORTED) 다시 눌러도 같으므로 'failed'와 나눠, 호스트를 알려 준다.
export async function saveDevice(subscription: BrowserSubscription): Promise<SaveResult> {
  try {
    const response = await fetch('/api/me/push/devices', {
      method: 'POST',
      credentials: 'same-origin',
      headers: JSON_HEADERS,
      body: JSON.stringify(subscription.toJSON()),
    })
    if (response.ok) return 'saved'
    if (await isUnsupportedService(response)) return 'unsupported'
    return 'failed'
  } catch {
    return 'failed'
  }
}

// 끝난 구독은 서버에서도 지운다(바탕 spec G10). 실패해도 화면은 그대로 둔다.
export function forgetDevice(endpoint: string) {
  void fetch('/api/me/push/devices/remove', {
    method: 'POST',
    credentials: 'same-origin',
    headers: JSON_HEADERS,
    body: JSON.stringify({ endpoint }),
  }).catch(() => undefined)
}

export type EnableResult =
  | { kind: 'on'; subscription: BrowserSubscription }
  | { kind: 'unsupported-service'; endpoint: string }
  | { kind: 'save-failed' }
  | { kind: 'refused' }

// 누른 동작 안에서 바로 구독한다(첫 await 전에 subscribe를 부른다). 새 구독은 서버에 저장해야 이 기기로 알림이 간다.
// 저장하지 못하면 구독을 지우고 다시 누르게 한다.
export async function enableDevice(
  manager: BrowserPushManager,
  key: Uint8Array,
): Promise<EnableResult> {
  let next: BrowserSubscription
  try {
    next = await manager.subscribe({ userVisibleOnly: true, applicationServerKey: key })
  } catch {
    return { kind: 'refused' }
  }
  const saved = await saveDevice(next)
  if (saved === 'saved') return { kind: 'on', subscription: next }
  await next.unsubscribe().catch(() => false)
  return saved === 'unsupported'
    ? { kind: 'unsupported-service', endpoint: next.endpoint }
    : { kind: 'save-failed' }
}
