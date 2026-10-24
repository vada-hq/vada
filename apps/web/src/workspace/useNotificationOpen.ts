import { useEffect } from 'react'
import { appPath, parseAppPath, type MyCouncil } from '@vada/contracts'
import { navigate } from '@/lib/app-location'
import { listenServiceWorker } from '@/lib/service-worker'

// 서비스 워커가 알려 준 주소(vada:open)를 읽는다. 같은 사이트의 학생회 안 주소만 받는다.
function pathOf(url: string) {
  try {
    const resolved = new URL(url, window.location.origin)
    if (resolved.origin !== window.location.origin) return null
    const location = parseAppPath(resolved.pathname + resolved.search)
    return location && { path: appPath(location), councilId: location.councilId }
  } catch {
    return null
  }
}

// 받은 알림 주소. 학생회 목록을 읽는 동안, 학생회가 없는 카드 화면, 로그아웃 상태에서 받은 것도 버리지 않고 들고 있다가
// 목록이 준비되면 연다(App이 늘 들으므로 작업 공간이 그려지기 전의 알림도 받는다).
let pending: string | null = null
const wakers = new Set<() => void>()

export function useNotificationInbox() {
  useEffect(() => {
    const stop = listenServiceWorker(url => {
      const target = pathOf(url)
      if (!target) return
      pending = target.path
      for (const wake of wakers) wake()
    })
    return () => {
      stop()
      pending = null
    }
  }, [])
}

// 알림 주소로 한 칸 쌓는다. 작업 공간은 새로 그려지지 않는다.
// 내 학생회가 아닌 주소는 받지 않아 보던 화면을 그대로 둔다(서버가 준 내 학생회 목록으로만 가른다).
export function useNotificationOpen(councils: MyCouncil[], ready: boolean) {
  useEffect(() => {
    const flush = () => {
      if (pending === null || !ready || councils.length === 0) return
      const path = pending
      pending = null
      const councilId = parseAppPath(path)?.councilId
      if (councils.some(council => council.id === councilId)) navigate(path)
    }
    wakers.add(flush)
    flush()
    return () => {
      wakers.delete(flush)
    }
  }, [councils, ready])
}
