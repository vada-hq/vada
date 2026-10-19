import { useEffect, useRef, useState } from 'react'
import type { PushKeyResponse, PushTestResponse, PushTestResult } from '@vada/contracts'
import { deviceOf, isIosHomeScreenApp, type Device } from '@/lib/platform'
import { base64UrlToBytes, browserPush, sameKey, type BrowserPushManager, type BrowserSubscription, type PushBrowser } from './push-client'
import { pushStateOf } from './push-state'

export type PushTest = { kind: 'idle' } | { kind: 'sending' } | { kind: 'result'; result: PushTestResult }
  | { kind: 'unsupported-service'; host: string } | { kind: 'failed' } | { kind: 'unknown' }
export type PushEnvironment = { browser: PushBrowser; device: Device; homeScreenApp: boolean }

export const currentEnvironment = (): PushEnvironment => ({
  browser: browserPush(),
  device: deviceOf(navigator.userAgent, navigator.maxTouchPoints),
  homeScreenApp: isIosHomeScreenApp(navigator as { standalone?: boolean }),
})

// 알림 받을 기기를 서버에 저장한다(바탕 spec G10). 같은 구독 주소면 서버가 열쇠를 갱신한다. 저장했으면 true다.
async function saveDevice(subscription: BrowserSubscription) {
  try {
    const response = await fetch('/api/me/push/devices', { method: 'POST', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(subscription.toJSON()) })
    return response.ok
  } catch {
    return false
  }
}

// 끝난 구독은 서버에서도 지운다(바탕 spec G10). 실패해도 화면은 그대로 둔다.
function forgetDevice(endpoint: string) {
  void fetch('/api/me/push/devices/remove', { method: 'POST', credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ endpoint }) }).catch(() => undefined)
}

type Server = { kind: 'loading' } | { kind: 'failed' } | { kind: 'off' } | { kind: 'ready'; key: Uint8Array; manager: BrowserPushManager }

// 휴대폰 알림 대화상자의 데이터. 열 때 서버 열쇠와 서비스 워커 등록을 미리 받아 두어,
// '알림 켜기'를 누른 동작 안에서 기다림 없이 구독한다(아이폰은 누른 동작 안에서만 허락을 묻는다).
export function usePush({ browser, device, homeScreenApp }: PushEnvironment) {
  const [server, setServer] = useState<Server>({ kind: 'loading' })
  const [subscription, setSubscription] = useState<BrowserSubscription | null>(null)
  const [permission, setPermission] = useState<NotificationPermission>(() => browser.supported ? browser.permission() : 'default')
  const [enableFailed, setEnableFailed] = useState(false)
  const [test, setTest] = useState<PushTest>({ kind: 'idle' })
  const [attempt, setAttempt] = useState(0)
  const sending = useRef(false)
  const blocked = (device === 'ios' && !homeScreenApp) || !browser.supported

  useEffect(() => {
    if (blocked) return
    let cancelled = false
    setServer({ kind: 'loading' })
    async function load() {
      try {
        const response = await fetch('/api/me/push', { credentials: 'same-origin', cache: 'no-store' })
        if (response.status === 404) {
          if (!cancelled) setServer({ kind: 'off' })
          return
        }
        if (!response.ok) throw new Error('Push key failed')
        const { publicKey } = await response.json() as PushKeyResponse
        const key = base64UrlToBytes(publicKey)
        const manager = await browser.pushManager()
        let existing = await manager.getSubscription()
        // 열쇠가 바뀐 옛 구독은 여기서 지운다. 못 지워도 넘어가고, 구독이 없는 것으로 본다. 서버에 저장된 그 기기도 지운다(바탕 spec G10).
        // 그래야 '알림 켜기'를 누른 동작 안에서 기다림 없이 구독할 수 있다.
        if (existing && !sameKey(existing, key)) {
          await existing.unsubscribe().catch(() => false)
          forgetDevice(existing.endpoint)
          existing = null
        }
        // 이미 켜진(지금 열쇠의) 구독도 서버에 저장한다. 덩어리 1에서 켠 기기나 다른 계정으로 켰던 브라우저도 이 계정의 기기가 된다(바탕 spec G10).
        // 저장하지 못하면 켜기에 실패한 것처럼 구독을 지우고 다시 누르게 한다. 서버에 기기가 없는데 '켜짐'을 보이지 않는다(P23).
        let saveFailed = false
        if (existing && !await saveDevice(existing)) {
          await existing.unsubscribe().catch(() => false)
          existing = null
          saveFailed = true
        }
        if (cancelled) return
        setSubscription(existing)
        if (saveFailed) setEnableFailed(true)
        setServer({ kind: 'ready', key, manager })
      } catch {
        if (!cancelled) setServer({ kind: 'failed' })
      }
    }
    void load()
    return () => { cancelled = true }
  }, [blocked, browser, attempt])

  const ready = server.kind === 'ready' ? server : null
  const subscribed = Boolean(subscription && ready && sameKey(subscription, ready.key))
  const state = pushStateOf({ device, homeScreenApp, supported: browser.supported, server: server.kind, permission, subscribed })

  // 누른 동작 안에서 바로 구독한다. 열쇠가 바뀐 옛 구독은 대화상자를 열 때 이미 지웠으므로 여기서 기다릴 일이 없다.
  // 새 구독은 서버에 저장해야 이 기기로 알림이 간다. 저장하지 못하면 구독을 지우고 다시 누르게 한다.
  function enable() {
    if (!ready) return
    setEnableFailed(false)
    setTest({ kind: 'idle' })
    ready.manager.subscribe({ userVisibleOnly: true, applicationServerKey: ready.key }).then(async next => {
      if (!await saveDevice(next)) {
        await next.unsubscribe().catch(() => false)
        setSubscription(null)
        setPermission(browser.permission())
        setEnableFailed(true)
        return
      }
      setSubscription(next)
      setPermission(browser.permission())
    }, () => {
      setPermission(browser.permission())
      setEnableFailed(true)
    })
  }

  // 5초를 기다리는 동안 화면을 끄면 iOS가 요청을 끊을 수 있다. 그때의 실패는 '모름'으로 보여 준다.
  async function sendTest() {
    if (!subscription || sending.current) return
    sending.current = true
    setTest({ kind: 'sending' })
    let hidden = false
    const onVisibility = () => { if (document.visibilityState === 'hidden') hidden = true }
    document.addEventListener('visibilitychange', onVisibility)
    try {
      const response = await fetch('/api/me/push/test', { method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(subscription.toJSON()) })
      if (response.status === 400 && (await response.json() as { error?: string }).error === 'PUSH_SERVICE_UNSUPPORTED') {
        setTest({ kind: 'unsupported-service', host: new URL(subscription.endpoint).host })
        return
      }
      if (!response.ok) throw new Error('Push test failed')
      const { result } = await response.json() as PushTestResponse
      if (result === 'expired') {
        await subscription.unsubscribe().catch(() => false)
        forgetDevice(subscription.endpoint)
        setSubscription(null)
      }
      setTest({ kind: 'result', result })
    } catch {
      setTest({ kind: hidden ? 'unknown' : 'failed' })
    } finally {
      document.removeEventListener('visibilitychange', onVisibility)
      sending.current = false
    }
  }

  return { state, device, test, enableFailed, enable, sendTest, retry: () => setAttempt(value => value + 1) }
}
