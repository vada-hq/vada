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
