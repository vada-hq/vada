import { useRef, useState } from 'react'
import type { BudgetResponse } from '@vada/contracts'
import { postJson } from '@/lib/api'
import { BUDGET_ERRORS, BUDGET_FAILED, BUDGET_LOST } from '@/lib/messages'
import { reportLost, type PurchaseDialogHandlers } from './purchase-requests'

export type BudgetChangeHandlers = Pick<PurchaseDialogHandlers, 'onLost' | 'onForbidden'> & {
  // 저장된 값을 받는다. 부모가 예산을 다시 읽고 대화상자를 닫는다.
  onSaved: (budget: BudgetResponse) => void
}

type Parser = { safeParse: (value: unknown) => { success: boolean } }

// 회계 기간 만들기와 예산 항목 더하기가 같이 쓴다. 버튼은 계약의 safeParse로 켜고, 보내는 동안 다시 보내지 않는다.
export function useBudgetChange(
  path: string,
  body: unknown,
  schema: Parser,
  handlers: BudgetChangeHandlers & { setSaving: (saving: boolean) => void },
) {
  const [problem, setProblem] = useState<string | null>(null)
  const sending = useRef(false)
  const valid = schema.safeParse(body).success

  async function submit() {
    if (!valid || sending.current) return
    sending.current = true
    handlers.setSaving(true)
    setProblem(null)
    const result = await postJson<BudgetResponse>(path, body)
    sending.current = false
    handlers.setSaving(false)
    if (result.ok) return handlers.onSaved(result.data)
    if (reportLost(handlers, result.status, BUDGET_LOST)) return
    setProblem(BUDGET_ERRORS[result.code] ?? BUDGET_FAILED)
  }

  return { valid, problem, submit }
}
