// 휴대폰 알림을 받으려면 서비스 워커가 있어야 한다. 실패해도 화면은 그대로 쓴다.
type Registrar = { register: (url: string) => Promise<unknown> }
const browserRegistrar = () =>
  typeof navigator !== 'undefined' && 'serviceWorker' in navigator
    ? navigator.serviceWorker
    : undefined

export function registerServiceWorker(container: Registrar | undefined = browserRegistrar()) {
  if (!container) return
  void container.register('/sw.js').catch(() => {})
}

// 서비스 워커가 화면에 알리는 일: 알림을 눌렀다(vada:open, 열 주소), 푸시가 왔다(vada:push).
// 푸시가 왔다는 알림은 화면 전체에 이벤트로 퍼뜨려, 보이는 다시 읽기(useVisiblePoll)가 바로 한 번 더 읽게 한다.
export const PUSH_ARRIVED_EVENT = 'vada:push-arrived'
type MessageListener = (event: { data: unknown }) => void
type MessageContainer = {
  addEventListener: (type: 'message', listener: MessageListener) => void
  removeEventListener: (type: 'message', listener: MessageListener) => void
}

export function listenServiceWorker(
  onOpen: (url: string) => void,
  container: MessageContainer | undefined = browserRegistrar(),
) {
  if (!container) return () => undefined
  const listener: MessageListener = ({ data }) => {
    if (typeof data !== 'object' || data === null) return
    const { type, url } = data as { type?: unknown; url?: unknown }
    if (type === 'vada:push') window.dispatchEvent(new Event(PUSH_ARRIVED_EVENT))
    else if (type === 'vada:open' && typeof url === 'string') onOpen(url)
  }
  container.addEventListener('message', listener)
  return () => container.removeEventListener('message', listener)
}
