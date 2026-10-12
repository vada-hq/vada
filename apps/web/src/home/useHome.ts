import { useEffect, useState } from 'react'
import type { HomeResponse } from '@vada/contracts'

const isHome = (body: unknown): body is HomeResponse => typeof body === 'object' && body !== null
  && Array.isArray((body as HomeResponse).events) && Array.isArray((body as HomeResponse).items)

// 운영 현황(M6). 화면을 열 때마다 불러온다(다른 사람이 바꿨을 수 있다). 다시 불러오는 동안 지난 값을 그대로 보인다.
// reloadKey가 바뀌면 다시 불러온다(작업 공간에서 새 행사를 만들었을 때).
export function useHome(organizationId: string, reloadKey = 0) {
  const url = `/api/organizations/${encodeURIComponent(organizationId)}/home`
  const [data, setData] = useState<HomeResponse | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    setLoadError(false)
    void (async () => {
      try {
        const response = await fetch(url, { credentials: 'same-origin', cache: 'no-store', signal: controller.signal })
        const body: unknown = await response.json()
        if (!response.ok || !isHome(body)) throw new Error('Home lookup failed')
        if (!controller.signal.aborted) setData(body)
      } catch {
        if (!controller.signal.aborted) setLoadError(true)
      }
    })()
    return () => controller.abort()
  }, [url, attempt, reloadKey])
  return { data, loadError, refresh: () => setAttempt(value => value + 1) }
}
