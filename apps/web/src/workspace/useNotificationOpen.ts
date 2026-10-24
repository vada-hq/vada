import { useEffect } from 'react'
import { appPath, parseAppPath, type MyCouncil } from '@vada/contracts'
import { navigate } from '@/lib/app-location'
import { listenServiceWorker } from '@/lib/service-worker'
import { useLatest } from '@/lib/use-latest'

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

// 열려 있는 창에서 알림을 누르면 그 주소로 한 칸 쌓는다. 작업 공간은 새로 그려지지 않는다.
// 내 학생회가 아닌 주소는 받지 않아 보던 화면을 그대로 둔다.
export function useNotificationOpen(councils: MyCouncil[]) {
  const latest = useLatest(councils)
  useEffect(
    () =>
      listenServiceWorker(url => {
        const target = pathOf(url)
        if (target && latest.current.some(council => council.id === target.councilId))
          navigate(target.path)
      }),
    [latest],
  )
}
