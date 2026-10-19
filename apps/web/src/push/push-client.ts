// 브라우저의 알림 API를 감싼다. 화면은 이 모양만 쓰고, 테스트는 가짜로 바꿔 끼운다.
export type BrowserSubscription = {
  endpoint: string
  options: { applicationServerKey: ArrayBuffer | null }
  toJSON: () => PushSubscriptionJSON
  unsubscribe: () => Promise<boolean>
}
export type BrowserPushManager = {
  getSubscription: () => Promise<BrowserSubscription | null>
  subscribe: (options: {
    userVisibleOnly: true
    applicationServerKey: Uint8Array
  }) => Promise<BrowserSubscription>
}
export type PushBrowser = {
  supported: boolean
  permission: () => NotificationPermission
  pushManager: () => Promise<BrowserPushManager>
}

export const READY_TIMEOUT_MS = 10_000

// 서비스 워커가 준비되지 않으면(사생활 보호 모드, 등록 실패) ready가 끝나지 않는다. 기다림에 상한을 둔다.
export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(new Error('Timed out')), ms)
  })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
}

export function browserPush(): PushBrowser {
  const supported =
    typeof navigator !== 'undefined' &&
    'serviceWorker' in navigator &&
    typeof PushManager !== 'undefined' &&
    typeof Notification !== 'undefined'
  return {
    supported,
    permission: () => Notification.permission,
    pushManager: async () => {
      await navigator.serviceWorker.register('/sw.js')
      const registration = await withTimeout(navigator.serviceWorker.ready, READY_TIMEOUT_MS)
      return registration.pushManager as unknown as BrowserPushManager
    },
  }
}

// 서버 열쇠(VAPID 공개 열쇠)는 URL용 base64다. subscribe는 바이트를 받는다.
export function base64UrlToBytes(value: string) {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/')
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
  return Uint8Array.from(atob(padded), char => char.charCodeAt(0))
}

// 구독이 지금 서버 열쇠로 만든 것인지. 서버 열쇠가 바뀌면 옛 구독으로는 보낼 수 없다.
export function sameKey(subscription: BrowserSubscription, key: Uint8Array) {
  const current = subscription.options.applicationServerKey
  if (!current || current.byteLength !== key.length) return false
  const bytes = new Uint8Array(current)
  return bytes.every((byte, index) => byte === key[index])
}
