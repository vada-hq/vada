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
        const manager = await browser.pushManager()
        const existing = await manager.getSubscription()
        if (cancelled) return
        setSubscription(existing)
        setServer({ kind: 'ready', key: base64UrlToBytes(publicKey), manager })
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

  // 열쇠가 바뀐 옛 구독은 지우고 다시 만든다. 옛 구독이 있었다면 이미 허락했으므로 다시 묻지 않는다.
  function enable() {
    if (!ready) return
    setEnableFailed(false)
    setTest({ kind: 'idle' })
    const options = { userVisibleOnly: true as const, applicationServerKey: ready.key }
    const stale = subscription && !sameKey(subscription, ready.key) ? subscription : null
    const subscribing = stale ? stale.unsubscribe().then(() => ready.manager.subscribe(options)) : ready.manager.subscribe(options)
    subscribing.then(next => {
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
