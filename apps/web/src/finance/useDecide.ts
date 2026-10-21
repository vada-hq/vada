import { useRef, useState } from 'react'
import type { PurchaseRequestResponse } from '@vada/contracts'
import { postJson } from '@/lib/api'
import { DECIDE_ERRORS, PURCHASE_FAILED } from '@/lib/messages'
import { purchaseDecisionsPath } from './finance-api'
import { reportLost, type PurchaseDialogHandlers } from './purchase-requests'

// 결재가 막힌 까닭. 요청이 바뀐 것이면 요청을 다시 읽고, 항목이 맞지 않으면 화면이 예산을 다시 읽는다.
export type DecideResult = { ok: true } | { ok: false; code: string }
const REREAD = new Set(['LINE_ITEM_DECIDED', 'REQUEST_CLOSED'])

// 품목 결재 보내기. 한 번에 하나만 나가고, 끝나고 요청을 다시 읽을 때까지 막아 둔다(낡은 줄을 다시 누르지 못하게).
export function useDecide(
  councilId: string,
  requestId: string,
  latest: { current: PurchaseDialogHandlers },
  reload: () => Promise<void>,
) {
  const [saving, setSaving] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const sending = useRef(false)

  async function decide(decisions: unknown[]): Promise<DecideResult> {
    if (sending.current) return { ok: false, code: 'BUSY' }
    sending.current = true
    setSaving(true)
    setProblem(null)
    const result = await postJson<PurchaseRequestResponse>(
      purchaseDecisionsPath(councilId, requestId),
      { decisions },
    )
    const failure = result.ok ? null : result
    const lost = failure !== null && reportLost(latest.current, failure.status)
    if (failure && !lost) setProblem(DECIDE_ERRORS[failure.code] ?? PURCHASE_FAILED)
    if (!failure || REREAD.has(failure.code)) {
      latest.current.onChanged()
      await reload()
    }
    sending.current = false
    setSaving(false)
    return failure ? { ok: false, code: failure.code } : { ok: true }
  }

  return { saving, problem, decide, clearProblem: () => setProblem(null) }
}
