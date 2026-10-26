import { useEffect, useState } from 'react'
import type { ShipmentTrackingResponse } from '@vada/contracts'
import { getJson } from '@/lib/api'
import { useLatest } from '@/lib/use-latest'
import { reportLost, type PurchaseDialogHandlers } from './purchase-requests'

// 카드가 택배사·번호마다 다시 열리므로 옛 조회 결과가 바뀐 송장을 덮지 않는다.
export function useShipmentTracking(
  path: string | null,
  handlers: Pick<PurchaseDialogHandlers, 'onLost' | 'onForbidden'>,
) {
  const [tracking, setTracking] = useState<ShipmentTrackingResponse | null>(null)
  const [loading, setLoading] = useState(path !== null)
  const latest = useLatest(handlers)
  useEffect(() => {
    if (!path) return
    const controller = new AbortController()
    void getJson<ShipmentTrackingResponse>(path, controller.signal).then(result => {
      if (controller.signal.aborted) return
      setLoading(false)
      if (result.ok) setTracking(result.data)
      else reportLost(latest.current, result.status)
    })
    return () => controller.abort()
  }, [path, latest])
  return { tracking, loading }
}
