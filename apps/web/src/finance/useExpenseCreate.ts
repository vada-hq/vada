import { useRef, useState } from 'react'
import { CreateExpenseSchema, type ExpenseResponse } from '@vada/contracts'
import { postJson } from '@/lib/api'
import { expensesPath } from './expense-api'
import { expenseProblem, reportExpenseLost, type ExpenseDialogHandlers } from './expense-requests'

type Handlers = Pick<ExpenseDialogHandlers, 'onLost' | 'onForbidden'> & {
  onCreated: (expense: ExpenseResponse['expense']) => void
  // 보내는 동안 대화상자를 닫지 못하게 바깥에 알린다.
  setSaving: (saving: boolean) => void
}

// 지출 적기. 버튼은 계약의 safeParse로 켜고, 보내는 동안 다시 보내지 않는다.
export function useExpenseCreate(councilId: string, request: unknown, handlers: Handlers) {
  const [problem, setProblem] = useState<string | null>(null)
  const sending = useRef(false)
  const parsed = CreateExpenseSchema.safeParse(request)

  async function submit() {
    if (!parsed.success || sending.current) return
    sending.current = true
    handlers.setSaving(true)
    setProblem(null)
    const result = await postJson<ExpenseResponse>(expensesPath(councilId), parsed.data)
    sending.current = false
    handlers.setSaving(false)
    if (result.ok) return handlers.onCreated(result.data.expense)
    if (!reportExpenseLost(handlers, result.status)) setProblem(expenseProblem(result.code))
  }

  return { valid: parsed.success, problem, submit }
}
