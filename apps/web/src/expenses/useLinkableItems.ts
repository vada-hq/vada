import { useEffect, useState } from 'react'
import type { LinkableItemsResponse } from '@vada/contracts'

const isLinkable = (body: unknown): body is LinkableItemsResponse => typeof body === 'object' && body !== null
  && Array.isArray((body as LinkableItemsResponse).items)

// 지출에 연결할 수 있는 승인 품목. 기록 대화상자를 열 때만 불러온다(재정 권한).
export function useLinkableItems(organizationId: string, enabled: boolean) {
  const url = `/api/organizations/${encodeURIComponent(organizationId)}/purchase-review/linkable-items`
  const [data, setData] = useState<LinkableItemsResponse | null>(null)
  const [loadError, setLoadError] = useState(false)
  useEffect(() => {
    if (!enabled) return
    const controller = new AbortController()
    void (async () => {
      try {
        const response = await fetch(url, { credentials: 'same-origin', cache: 'no-store', signal: controller.signal })
        const body: unknown = await response.json()
        if (!response.ok || !isLinkable(body)) throw new Error('Linkable items lookup failed')
        if (!controller.signal.aborted) setData(body)
      } catch {
        if (!controller.signal.aborted) setLoadError(true)
      }
    })()
    return () => controller.abort()
  }, [url, enabled])
  return { data, loadError }
}
