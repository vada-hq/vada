import { useEffect, useState } from 'react'
import { chatRoomFromPath } from '@vada/contracts'
import { listenServiceWorker } from '@/lib/service-worker'

// 알림을 눌러 열 방. seq는 같은 방을 또 눌러도 다시 열게 하는 번호다.
export type ChatLink = { councilId: string; roomId: string; seq: number }

// 알림이 알려 준 주소를 방으로 읽는다. 같은 사이트의 방 주소만 받는다.
function roomOf(url: string) {
  try {
    const resolved = new URL(url, window.location.origin)
    return resolved.origin === window.location.origin ? chatRoomFromPath(resolved.pathname) : null
  } catch {
    return null
  }
}

// 앱이 닫혀 있었다면 알림 주소(/chat/학생회/방)로 열리고, 열려 있었다면 서비스 워커가 주소를 알린다.
// 읽은 주소는 맨 앞으로 되돌려, 새로 고쳐도 같은 방이 다시 열리지 않게 한다.
export function useChatLink() {
  const [link, setLink] = useState<ChatLink | null>(() => {
    const room = chatRoomFromPath(window.location.pathname)
    return room && { ...room, seq: 0 }
  })
  useEffect(() => {
    if (chatRoomFromPath(window.location.pathname)) window.history.replaceState(null, '', '/')
    return listenServiceWorker(url => {
      const room = roomOf(url)
      if (room) setLink(before => ({ ...room, seq: (before?.seq ?? 0) + 1 }))
    })
  }, [])
  return link
}
