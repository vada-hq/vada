// VADA 서비스 워커: 휴대폰 알림을 띄우고, 알림을 누르면 VADA를 연다. 파일을 캐시하지 않는다(오프라인 없음).
self.addEventListener('install', () => {
  self.skipWaiting()
})
self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim())
})

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

async function markAppBadge() {
  try {
    await self.navigator.setAppBadge?.()
  } catch {
    // 배지를 지원해도 OS에서 거부할 수 있다. 알림은 계속 띄운다.
  }
}

// 아이폰은 알림을 띄우지 않는 푸시가 거듭되면 허락을 거둘 수 있다. 내용을 못 읽어도 늘 띄운다.
self.addEventListener('push', event => {
  let message = {}
  try {
    message = event.data ? event.data.json() : {}
  } catch {
    message = {}
  }
  // 객체가 아닌 본문(null, 숫자, 글자)은 못 읽은 것과 같다. 아래에서 속성을 읽다 멈추면 알림이 안 뜬다.
  if (message === null || typeof message !== 'object') message = {}
  const title = typeof message.title === 'string' && message.title ? message.title : 'VADA'
  const body = typeof message.body === 'string' ? message.body : ''
  const url = sameSitePath(message.url)
  // 같은 방의 알림은 tag로 한 줄에 갈아 끼운다. renotify가 없으면 갈아 끼운 알림이 소리 없이 바뀐다.
  const tag =
    typeof message.tag === 'string' && message.tag ? { tag: message.tag, renotify: true } : {}
  event.waitUntil(
    Promise.all([
      markAppBadge(),
      tellWindows({ type: 'vada:push' }),
      self.registration.showNotification(title, {
        body,
        data: { url },
        icon: '/icons/icon-192.png',
        lang: 'ko',
        ...tag,
      }),
    ]),
  )
})

// 열린 VADA 창을 찾는다. 찾기가 실패해도 멈추지 않는다.
async function openWindows() {
  try {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    return windows.filter(client => new URL(client.url).origin === self.location.origin)
  } catch {
    return []
  }
}

// 창마다 따로 보낸다. 한 창이 실패해도 나머지에는 간다.
async function tellWindows(message) {
  for (const client of await openWindows()) {
    try {
      client.postMessage(message)
    } catch {
      // 닫히는 창이다. 알림은 그대로 띄운다.
    }
  }
}

// 알림을 누르면 열린 VADA 창에 주소를 알려 앞으로 가져오고, 창이 없거나 실패하면 새로 연다.
// 열린 창을 navigate하지 않는다(아이폰 WebKit이 첫 화면만 여는 일이 있다).
async function openFromNotification(path) {
  for (const client of await openWindows()) {
    try {
      client.postMessage({ type: 'vada:open', url: path })
      await client.focus()
      return
    } catch {
      // 다음 창이나 새 창으로 넘어간다.
    }
  }
  await self.clients.openWindow(new URL(path, self.location.origin).href)
}

self.addEventListener('notificationclick', event => {
  event.notification.close()
  const path = sameSitePath(event.notification.data?.url)
  event.waitUntil(openFromNotification(path).catch(() => {}))
})
