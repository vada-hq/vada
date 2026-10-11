import { useEffect, useState } from 'react'
import type { RecordsResponse } from '@vada/contracts'

const isRecords = (body: unknown): body is RecordsResponse => typeof body === 'object' && body !== null
  && Array.isArray((body as RecordsResponse).records)

// 기록 화면을 열 때마다 불러온다(완료·발행이 다른 곳에서 바뀔 수 있다).
export function useRecords(organizationId: string) {
  const url = `/api/organizations/${encodeURIComponent(organizationId)}/records`
  const [data, setData] = useState<RecordsResponse | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    setLoadError(false)
    void (async () => {
      try {
        const response = await fetch(url, { credentials: 'same-origin', cache: 'no-store', signal: controller.signal })
        const body: unknown = await response.json()
        if (!response.ok || !isRecords(body)) throw new Error('Records lookup failed')
        if (!controller.signal.aborted) setData(body)
      } catch {
        if (!controller.signal.aborted) setLoadError(true)
      }
    })()
    return () => controller.abort()
  }, [url, attempt])
  return { data, loadError, refresh: () => setAttempt(value => value + 1) }
}
