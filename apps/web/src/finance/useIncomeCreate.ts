import { useRef, useState } from 'react'
import { CreateIncomeSchema, type IncomeResponse } from '@vada/contracts'
import { postJson } from '@/lib/api'
import { CHECK_COMMAND_ID, withCommandId, type CommandMemo } from '@/lib/command-id'
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
  // 대화상자가 열린 동안만 기억한다. 닫으면 이 훅이 사라져 번호도 버려진다.
  const memo = useRef<CommandMemo>(null)
  const parsed = CreateIncomeSchema.safeParse({
    ...(request as object),
    commandId: CHECK_COMMAND_ID,
  })

  async function submit() {
    if (!parsed.success || sending.current) return
    sending.current = true
    handlers.setSaving(true)
    setProblem(null)
    const result = await postJson<IncomeResponse>(
      incomesRootPath(councilId),
      withCommandId(memo, parsed.data),
    )
    sending.current = false
    handlers.setSaving(false)
    if (result.ok) {
      memo.current = null
      return handlers.onCreated(result.data.income)
    }
    // 같은 번호에 다른 본문이다. 번호를 버려 다음에 누르면 새 수입으로 간다.
    if (result.code === 'COMMAND_REUSED') memo.current = null
    if (!reportIncomeLost(handlers, result.status)) setProblem(incomeProblem(result.code))
  }

  return { valid: parsed.success, parsed, problem, submit }
}
