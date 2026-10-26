import { useRef, useState } from 'react'
import type { ShipmentInput, ShipmentResponse } from '@vada/contracts'
import { postJson } from '@/lib/api'
import { purchaseShipmentPath, purchaseShipmentsPath } from './finance-api'
import { problemText, reportLost, type PurchaseDialogHandlers } from './purchase-requests'

type Outcome = 'done' | 'closed' | 'failed'
const REREAD = new Set([
  'EVENT_COMPLETED',
  'LINE_ITEM_NOT_SHIPPABLE',
  'SHIPMENT_CANCELLED',
  'REQUEST_CLOSED',
])

// 송장 변경 뒤 요청을 다시 읽어 품목 연결과 권한도 함께 갱신한다.
export function useShipmentActions(
  councilId: string,
  requestId: string,
  latest: { current: PurchaseDialogHandlers },
  reload: () => Promise<void>,
) {
  const [saving, setSaving] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const sending = useRef(false)
  async function send(path: string, input: unknown): Promise<Outcome> {
    if (sending.current) return 'failed'
    sending.current = true
    setSaving(true)
    setProblem(null)
    try {
      const result = await postJson<ShipmentResponse>(path, input)
      if (!result.ok && reportLost(latest.current, result.status)) return 'failed'
      if (!result.ok) setProblem(problemText(result.code))
      if (result.ok || REREAD.has(result.code)) {
        latest.current.onChanged()
        await reload()
        return result.ok ? 'done' : 'closed'
      }
      return 'failed'
    } finally {
      sending.current = false
      setSaving(false)
    }
  }
  return {
    saving,
    problem,
    clearProblem: () => setProblem(null),
    save: (input: ShipmentInput, shipmentId?: string) =>
      send(
        shipmentId
          ? purchaseShipmentPath(councilId, requestId, shipmentId)
          : purchaseShipmentsPath(councilId, requestId),
        input,
      ),
    cancel: (shipmentId: string, reason: string) =>
      send(`${purchaseShipmentPath(councilId, requestId, shipmentId)}/cancel`, { reason }),
  }
}
export type ShipmentActions = ReturnType<typeof useShipmentActions>
