import { useRef, useState } from 'react'
import { CreatePurchaseRequestSchema, type PurchaseRequestResponse } from '@vada/contracts'
import { postJson } from '@/lib/api'
import { purchaseCreatePath } from './finance-api'
import { problemText, reportLost, type PurchaseDialogHandlers } from './purchase-requests'

type Handlers = Pick<PurchaseDialogHandlers, 'onLost' | 'onForbidden'> & {
  onCreated: (request: PurchaseRequestResponse['request']) => void
  // 보내는 동안 대화상자를 닫지 못하게 바깥에 알린다.
  setSaving: (saving: boolean) => void
}

// 요청 내기. 버튼은 계약의 safeParse로 켜고, 보내는 동안 다시 보내지 않는다.
export function useRequestCreate(councilId: string, request: unknown, handlers: Handlers) {
  const [problem, setProblem] = useState<string | null>(null)
  const sending = useRef(false)
  const parsed = CreatePurchaseRequestSchema.safeParse(request)

  async function submit() {
    if (!parsed.success || sending.current) return
    sending.current = true
    handlers.setSaving(true)
    setProblem(null)
    const result = await postJson<PurchaseRequestResponse>(purchaseCreatePath(councilId), request)
    sending.current = false
    handlers.setSaving(false)
    if (result.ok) return handlers.onCreated(result.data.request)
    if (!reportLost(handlers, result.status)) setProblem(problemText(result.code))
  }

  return { valid: parsed.success, problem, submit }
}
