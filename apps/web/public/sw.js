// VADA 서비스 워커: 휴대폰 알림을 띄우고, 알림을 누르면 VADA를 연다. 파일을 캐시하지 않는다(오프라인 없음).
self.addEventListener('install', () => { self.skipWaiting() })
self.addEventListener('activate', event => { event.waitUntil(self.clients.claim()) })

// 같은 사이트 경로만 연다. 다른 곳을 가리키면(//다른곳, /\다른곳, 전체 주소) 맨 앞 화면으로 바꾼다.
function sameSitePath(value) {
  if (typeof value !== 'string' || !value.startsWith('/')) return '/'
  try {
    const resolved = new URL(value, self.location.origin)
    const path = resolved.pathname + resolved.search + resolved.hash
    // '/.//다른곳'은 같은 사이트로 풀리지만 그 경로를 다시 해석하면 '//다른곳'이라 다른 사이트를 가리킨다. 그것도 바꾼다.
    return resolved.origin === self.location.origin && !path.startsWith('//') ? path : '/'
  } catch {
    return '/'
  }
}

// 아이폰은 알림을 띄우지 않는 푸시가 거듭되면 허락을 거둘 수 있다. 내용을 못 읽어도 늘 띄운다.
self.addEventListener('push', event => {
  let message = {}
  try { message = event.data ? event.data.json() : {} } catch { message = {} }
  // 객체가 아닌 본문(null, 숫자, 글자)은 못 읽은 것과 같다. 아래에서 속성을 읽다 멈추면 알림이 안 뜬다.
  if (message === null || typeof message !== 'object') message = {}
  const title = typeof message.title === 'string' && message.title ? message.title : 'VADA'
  const body = typeof message.body === 'string' ? message.body : ''
  const url = sameSitePath(message.url)
  event.waitUntil(self.registration.showNotification(title, { body, data: { url }, icon: '/icons/icon-192.png', lang: 'ko' }))
})

// 알림을 누르면 열린 VADA 창을 앞으로 가져와 그 주소로 보내고, 없으면 새로 연다.
self.addEventListener('notificationclick', event => {
  event.notification.close()
  const url = new URL(sameSitePath(event.notification.data?.url), self.location.origin).href
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    const open = windows.find(client => new URL(client.url).origin === self.location.origin)
    if (open) {
      await open.focus()
      if (open.url !== url) await open.navigate(url).catch(() => {})
      return
    }
    await self.clients.openWindow(url)
  })())
})
