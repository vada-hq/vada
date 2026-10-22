import { useRef, useState } from 'react'
import { CreateIncomeSchema, type IncomeResponse } from '@vada/contracts'
import { postJson } from '@/lib/api'
import { incomesRootPath } from './income-api'
import { incomeProblem, reportIncomeLost, type IncomeDialogHandlers } from './income-requests'

type Handlers = Pick<IncomeDialogHandlers, 'onLost' | 'onForbidden'> & {
  onCreated: (income: IncomeResponse['income']) => void
  // 보내는 동안 대화상자를 닫지 못하게 바깥에 알린다.
  setSaving: (saving: boolean) => void
}

// 수입 적기. 버튼은 계약의 safeParse로 켜고, 보내는 동안 다시 보내지 않는다.
export function useIncomeCreate(councilId: string, request: unknown, handlers: Handlers) {
  const [problem, setProblem] = useState<string | null>(null)
  const sending = useRef(false)
  const parsed = CreateIncomeSchema.safeParse(request)

  async function submit() {
    if (!parsed.success || sending.current) return
    sending.current = true
    handlers.setSaving(true)
    setProblem(null)
    const result = await postJson<IncomeResponse>(incomesRootPath(councilId), parsed.data)
    sending.current = false
    handlers.setSaving(false)
    if (result.ok) return handlers.onCreated(result.data.income)
    if (!reportIncomeLost(handlers, result.status)) setProblem(incomeProblem(result.code))
  }

  return { valid: parsed.success, problem, submit }
}
