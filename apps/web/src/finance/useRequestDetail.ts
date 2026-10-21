import { useCallback, useEffect, useRef, useState } from 'react'
import type { PurchaseRequestDetail, PurchaseRequestResponse } from '@vada/contracts'
import { getJson, postJson } from '@/lib/api'
import { useLatest } from '@/lib/use-latest'
import { LIST_POLL_MS, useVisiblePoll } from '@/lib/use-visible-poll'
import { purchaseCancelPath, purchasePath } from './finance-api'
import { problemText, reportLost, type PurchaseDialogHandlers } from './purchase-requests'

// 취소의 결과. 이미 닫힌 요청(409 REQUEST_CLOSED)이면 요청을 다시 읽어 보이고 확인을 닫는다.
export type CancelOutcome = 'done' | 'closed' | 'failed'
const CLOSED = 'REQUEST_CLOSED'

// 요청 하나를 읽고 취소한다. 열려 있는 동안 화면이 보이면 15초마다, 다시 보일 때, 알림이 올 때 다시 읽는다.
// 읽다 실패해도 보이던 요청은 그대로 둔다. 취소하는 요청은 한 번에 하나만 나간다.
export function useRequestDetail(
  councilId: string,
  requestId: string,
  handlers: PurchaseDialogHandlers,
) {
  const path = purchasePath(councilId, requestId)
  const [request, setRequest] = useState<PurchaseRequestDetail | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)
  const [saving, setSaving] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const sending = useRef(false)
  const alive = useRef(new AbortController())
  const latest = useLatest(handlers)

  const load = useCallback(async () => {
    const { signal } = alive.current
    const result = await getJson<PurchaseRequestResponse>(path, signal)
    if (signal.aborted) return
    if (result.ok) {
      setLoadFailed(false)
      return setRequest(result.data.request)
    }
    if (!reportLost(latest.current, result.status)) setLoadFailed(true)
  }, [path, latest])

  useEffect(() => {
    const controller = new AbortController()
    alive.current = controller
    void load()
    return () => controller.abort()
  }, [load])
  useVisiblePoll(() => void load(), LIST_POLL_MS)

  // 취소가 막힌 뒤(이미 닫힌 요청)에는 요청을 다시 읽어 보인다.
  async function refreshed(outcome: CancelOutcome) {
    latest.current.onChanged()
    await load()
    return outcome
  }

  async function cancel(): Promise<CancelOutcome> {
    if (sending.current) return 'failed'
    sending.current = true
    setSaving(true)
    setProblem(null)
    const result = await postJson<undefined>(purchaseCancelPath(councilId, requestId), {})
    sending.current = false
    setSaving(false)
    if (result.ok) return refreshed('done')
    if (reportLost(latest.current, result.status)) return 'failed'
    setProblem(problemText(result.code))
    return result.code === CLOSED ? refreshed('closed') : 'failed'
  }

  return { request, loadFailed, saving, problem, cancel, retry: () => void load() }
}
