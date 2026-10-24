import { useRef, useState } from 'react'
import { postJson } from '@/lib/api'
import { purchaseItemCancelPath } from './finance-api'
import { problemText, reportLost, type PurchaseDialogHandlers } from './purchase-requests'

// 취소의 결과. 이미 취소할 수 없게 된 품목(409, 행사 완료)이면 요청을 다시 읽고 창을 닫는다.
type CancelItemOutcome = 'done' | 'closed' | 'failed'
const REREAD = new Set(['LINE_ITEM_NOT_CANCELLABLE', 'EVENT_COMPLETED'])

export type ItemCancel = {
  saving: boolean
  // 어느 품목에서 난 문제인지 같이 둬서 그 품목의 버튼 옆에 보인다.
  problem: { lineItemId: string; message: string } | null
  cancelItem: (lineItemId: string, reason: string) => Promise<CancelItemOutcome>
  clearProblem: () => void
}

// 승인한 품목 취소(DEC-73). 한 번에 하나만 나간다. 취소할 수 없게 된 품목이면 이유를 보이고 요청을 다시 읽는다.
export function useCancelItem(
  councilId: string,
  requestId: string,
  latest: { current: PurchaseDialogHandlers },
  reload: () => Promise<void>,
): ItemCancel {
  const [saving, setSaving] = useState(false)
  const [problem, setProblem] = useState<ItemCancel['problem']>(null)
  const sending = useRef(false)

  async function refreshed(outcome: CancelItemOutcome) {
    latest.current.onChanged()
    await reload()
    return outcome
  }

  async function cancelItem(lineItemId: string, reason: string): Promise<CancelItemOutcome> {
    if (sending.current) return 'failed'
    sending.current = true
    setSaving(true)
    setProblem(null)
    const result = await postJson<undefined>(
      purchaseItemCancelPath(councilId, requestId, lineItemId),
      { reason },
    )
    sending.current = false
    setSaving(false)
    if (result.ok) return refreshed('done')
    if (reportLost(latest.current, result.status)) return 'failed'
    setProblem({ lineItemId, message: problemText(result.code) })
    return REREAD.has(result.code) ? refreshed('closed') : 'failed'
  }

  return { saving, problem, cancelItem, clearProblem: () => setProblem(null) }
}
