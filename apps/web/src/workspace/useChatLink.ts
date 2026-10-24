import { useEffect, useState } from 'react'
import { chatRoomFromPath, purchaseRequestFromPath, taskFromPath } from '@vada/contracts'
import { listenServiceWorker } from '@/lib/service-worker'

// 알림을 눌러 열 방이나 업무. seq는 같은 곳을 또 눌러도 다시 열게 하는 번호다.
export type ChatLink = {
  councilId: string
  roomId?: string
  taskId?: string
  requestId?: string
  seq: number
}

// 알림 주소를 방, 업무, 구매 요청으로 읽는다. 학생회와 기록 칸이 uuid인지는 paths.ts의 읽기가 본다.
const targetOf = (pathname: string) =>
  chatRoomFromPath(pathname) ?? taskFromPath(pathname) ?? purchaseRequestFromPath(pathname)

// 서비스 워커가 알려 준 주소를 읽는다. 같은 사이트의 주소만 받는다.
function targetOfUrl(url: string) {
  try {
    const resolved = new URL(url, window.location.origin)
    return resolved.origin === window.location.origin ? targetOf(resolved.pathname) : null
  } catch {
    return null
  }
}

// 앱이 닫혀 있었다면 알림 주소(/chat/학생회/방, /tasks/학생회/업무, /purchases/학생회/요청)로 열리고, 열려 있었다면 서비스 워커가 주소를 알린다.
// 읽은 주소는 맨 앞으로 되돌려, 새로 고쳐도 같은 곳이 다시 열리지 않게 한다.
// 창 기록의 표시(use-window-history)를 지우지 않도록 상태는 그대로 둔다.
export function useChatLink() {
  const [link, setLink] = useState<ChatLink | null>(() => {
    const target = targetOf(window.location.pathname)
    return target && { ...target, seq: 0 }
  })
  useEffect(() => {
    if (targetOf(window.location.pathname))
      window.history.replaceState(window.history.state, '', '/')
    return listenServiceWorker(url => {
      const target = targetOfUrl(url)
      if (target) setLink(before => ({ ...target, seq: (before?.seq ?? 0) + 1 }))
    })
  }, [])
  return link
}
