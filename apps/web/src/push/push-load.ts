import { statusOf, type PushKeyResponse } from '@vada/contracts'
import {
  base64UrlToBytes,
  sameKey,
  type BrowserPushManager,
  type BrowserSubscription,
  type PushBrowser,
} from './push-client'
import { forgetDevice, saveDevice } from './push-device'

// 이미 켜진 구독을 서버에 저장하지 못했을 때의 사정.
export type PushProblem =
  { kind: 'unsupported-service'; endpoint: string } | { kind: 'save-failed' }
export type PushLoad =
  | { kind: 'off' }
  | { kind: 'failed' }
  | {
      kind: 'ready'
      key: Uint8Array
      manager: BrowserPushManager
      subscription: BrowserSubscription | null
      problem: PushProblem | null
    }

// 이미 켜진(지금 열쇠의) 구독도 서버에 저장한다. 덩어리 1에서 켠 기기나 다른 계정으로 켰던 브라우저도 이 계정의 기기가 된다(바탕 spec G10).
// 저장하지 못하면 서버에 기기가 없는데 '켜짐'을 보이지 않는다(P23). 구독은 지우지 않고 켜기 전으로 보여 준다.
// '알림 켜기'를 누르면 브라우저가 같은 열쇠의 그 구독을 돌려주므로, 그때 다시 저장한다.
async function saveExisting(
  existing: BrowserSubscription | null,
): Promise<{ subscription: BrowserSubscription | null; problem: PushProblem | null }> {
  if (!existing) return { subscription: null, problem: null }
  const saved = await saveDevice(existing)
  if (saved === 'saved') return { subscription: existing, problem: null }
  return {
    subscription: null,
    problem:
      saved === 'unsupported'
        ? { kind: 'unsupported-service', endpoint: existing.endpoint }
        : { kind: 'save-failed' },
  }
}

// 열 때 서버 열쇠와 서비스 워커 등록을 미리 받아 두어, '알림 켜기'를 누른 동작 안에서 기다림 없이 구독하게 한다.
// 대화상자를 닫았으면(isCancelled) 구독 지우기도 서버 요청도 더 하지 않고 null을 돌려준다.
async function readyState(
  browser: PushBrowser,
  isCancelled: () => boolean,
): Promise<PushLoad | null> {
  const response = await fetch('/api/me/push', { credentials: 'same-origin', cache: 'no-store' })
  if (response.status === statusOf('NOT_FOUND')) return { kind: 'off' }
  if (!response.ok) throw new Error('Push key failed')
  const { publicKey } = (await response.json()) as PushKeyResponse
  const key = base64UrlToBytes(publicKey)
  const manager = await browser.pushManager()
  let existing = await manager.getSubscription()
  if (isCancelled()) return null
  // 열쇠가 바뀐 옛 구독은 여기서 지운다. 못 지워도 넘어가고, 구독이 없는 것으로 본다. 서버에 저장된 그 기기도 지운다(바탕 spec G10).
  // 그래야 '알림 켜기'를 누른 동작 안에서 기다림 없이 구독할 수 있다.
  if (existing && !sameKey(existing, key)) {
    await existing.unsubscribe().catch(() => false)
    forgetDevice(existing.endpoint)
    existing = null
  }
  const saved = await saveExisting(existing)
  if (isCancelled()) return null
  return { kind: 'ready', key, manager, ...saved }
}

export async function loadPush(
  browser: PushBrowser,
  isCancelled: () => boolean,
): Promise<PushLoad | null> {
  try {
    return await readyState(browser, isCancelled)
  } catch {
    return isCancelled() ? null : { kind: 'failed' }
  }
}
