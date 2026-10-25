import { useRef, useState } from 'react'
import { CreateExpenseSchema, type ExpenseResponse } from '@vada/contracts'
import { postJson } from '@/lib/api'
import { reuseCommandId, type CommandMemo } from '@/lib/command-id'
import { expensesPath } from './expense-api'
import {
  expenseCreateProblem,
  reportExpenseLost,
  type ExpenseDialogHandlers,
} from './expense-requests'

type Handlers = Pick<ExpenseDialogHandlers, 'onLost' | 'onForbidden'> & {
  onCreated: (expense: ExpenseResponse['expense']) => void
  // 보내는 동안 대화상자를 닫지 못하게 바깥에 알린다.
  setSaving: (saving: boolean) => void
}

// 칸 확인용 자리 값이다. 보낼 때 대화상자가 기억한 번호로 바꾼다.
const CHECK_COMMAND_ID = '00000000-0000-4000-8000-000000000000'

// 지출 적기. 버튼은 계약의 safeParse로 켜고, 보내는 동안 다시 보내지 않는다.
export function useExpenseCreate(councilId: string, request: unknown, handlers: Handlers) {
  const [problem, setProblem] = useState<string | null>(null)
  const sending = useRef(false)
  // 대화상자가 열린 동안만 기억한다. 닫으면 이 훅이 사라져 번호도 버려진다.
  const memo = useRef<CommandMemo>(null)
  const parsed = CreateExpenseSchema.safeParse({
    ...(request as object),
    commandId: CHECK_COMMAND_ID,
  })

  async function submit() {
    if (!parsed.success || sending.current) return
    sending.current = true
    handlers.setSaving(true)
    setProblem(null)
    // 칸이 앞 시도와 같으면 같은 번호라, 응답을 잃은 뒤 다시 눌러도 지출은 하나다. 칸을 바꾸면 새 번호다.
    const { commandId: _placeholder, ...content } = parsed.data
    const result = await postJson<ExpenseResponse>(expensesPath(councilId), {
      ...content,
      commandId: reuseCommandId(memo, JSON.stringify(content)),
    })
    sending.current = false
    handlers.setSaving(false)
    if (result.ok) return handlers.onCreated(result.data.expense)
    // 같은 번호에 다른 본문이다. 번호를 버려 다음에 누르면 새 지출로 간다.
    if (result.code === 'COMMAND_REUSED') memo.current = null
    if (!reportExpenseLost(handlers, result.status)) setProblem(expenseCreateProblem(result.code))
  }

  return { valid: parsed.success, parsed, problem, submit }
}
