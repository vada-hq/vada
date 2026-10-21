import { useEffect, useState } from 'react'
import { chatRoomFromPath, isUuid, purchaseRequestFromPath, taskFromPath } from '@vada/contracts'
import { listenServiceWorker } from '@/lib/service-worker'

// 알림을 눌러 열 방이나 업무. seq는 같은 곳을 또 눌러도 다시 열게 하는 번호다.
export type ChatLink = {
  councilId: string
  roomId?: string
  taskId?: string
  requestId?: string
  seq: number
}

// 알림 주소를 방, 업무, 구매 요청으로 읽는다. 업무 번호는 uuid여야 한다.
function targetOf(pathname: string) {
  const room = chatRoomFromPath(pathname)
  if (room) return room
  const task = taskFromPath(pathname)
  if (task) return isUuid(task.taskId) ? task : null
  const request = purchaseRequestFromPath(pathname)
  return request && isUuid(request.requestId) ? request : null
}

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
export function useChatLink() {
  const [link, setLink] = useState<ChatLink | null>(() => {
    const target = targetOf(window.location.pathname)
    return target && { ...target, seq: 0 }
  })
  useEffect(() => {
    if (targetOf(window.location.pathname)) window.history.replaceState(null, '', '/')
    return listenServiceWorker(url => {
      const target = targetOfUrl(url)
      if (target) setLink(before => ({ ...target, seq: (before?.seq ?? 0) + 1 }))
    })
  }, [])
  return link
}
