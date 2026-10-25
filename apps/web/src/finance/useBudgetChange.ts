import { useRef, useState } from 'react'
import type { BudgetResponse } from '@vada/contracts'
import { postJson } from '@/lib/api'
import type { Parsed } from '@/lib/use-form-check'
import { BUDGET_ERRORS, BUDGET_FAILED, BUDGET_LOST } from '@/lib/budget-messages'
import { reportLost, type PurchaseDialogHandlers } from './purchase-requests'

export type BudgetChangeHandlers = Pick<PurchaseDialogHandlers, 'onLost' | 'onForbidden'> & {
  // 저장된 값을 받는다. 부모가 예산을 다시 읽고 대화상자를 닫는다.
  onSaved: (budget: BudgetResponse) => void
}

type Parser = { safeParse: (value: unknown) => Parsed }

// 회계 기간 만들기, 예산 편성, 항목 고치기·지우기가 같이 쓴다. 계약의 safeParse를 넘을 때만 보내고, 보내는 동안 다시 보내지 않는다.
// onRejected는 창을 닫지 않는 실패(400·409)의 코드를 받는다. 예산 편성은 이때 예산을 다시 읽어 같은 이름을 그 행에 짚는다.
export function useBudgetChange(
  path: string,
  body: unknown,
  schema: Parser,
  handlers: BudgetChangeHandlers & {
    setSaving: (saving: boolean) => void
    onRejected?: (code: string) => void
  },
) {
  const [problem, setProblem] = useState<string | null>(null)
  const sending = useRef(false)
  const parsed = schema.safeParse(body)
  const valid = parsed.success

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
    handlers.onRejected?.(result.code)
  }

  return { valid, parsed, problem, submit }
}
