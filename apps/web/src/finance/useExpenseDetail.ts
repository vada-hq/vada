import { useRef, useState } from 'react'
import type { ExpenseResponse } from '@vada/contracts'
import { postJson } from '@/lib/api'
import { useLatest } from '@/lib/use-latest'
import { usePolledRead } from '@/lib/use-polled-read'
import { expenseCancelPath, expensePath, expenseReimbursePath } from './expense-api'
import {
  expenseProblem,
  isStale,
  reportExpenseLost,
  type ExpenseDialogHandlers,
} from './expense-requests'

// 바꾸기의 결과. 이미 바뀐 상태(취소됨, 환급할 수 없음)면 지출을 다시 읽어 보이고 'stale'이다.
export type ExpenseOutcome = 'done' | 'stale' | 'failed'

// 지출 하나를 읽고 취소·환급한다. 열려 있는 동안 화면이 보이면 15초마다, 다시 보일 때 다시 읽는다.
// 읽다 실패해도 보이던 지출은 그대로 둔다. 바꾸는 요청은 한 번에 하나만 나간다.
export function useExpenseDetail(
  councilId: string,
  expenseId: string,
  handlers: ExpenseDialogHandlers,
) {
  const latest = useLatest(handlers)
  const read = usePolledRead<ExpenseResponse>(
    expensePath(councilId, expenseId),
    status => void reportExpenseLost(latest.current, status),
  )
  const [saving, setSaving] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const sending = useRef(false)

  // 내 변경이 돌려준 지출을 바로 놓고 목록을 다시 읽게 한다(증빙 붙이기도 쓴다).
  const apply = (data: ExpenseResponse) => {
    read.replace(data)
    latest.current.onChanged()
  }

  async function change(path: string, body: unknown): Promise<ExpenseOutcome> {
    if (sending.current) return 'failed'
    sending.current = true
    setSaving(true)
    setProblem(null)
    const result = await postJson<ExpenseResponse>(path, body)
    sending.current = false
    setSaving(false)
    if (result.ok) {
      apply(result.data)
      return 'done'
    }
    if (reportExpenseLost(latest.current, result.status)) return 'failed'
    setProblem(expenseProblem(result.code))
    if (!isStale(result.code)) return 'failed'
    latest.current.onChanged()
    await read.reload()
    return 'stale'
  }

  return {
    expense: read.state.kind === 'ready' ? read.state.data.expense : null,
    loadFailed: read.state.kind === 'failed',
    retry: () => void read.reload(),
    saving,
    problem,
    clearProblem: () => setProblem(null),
    cancel: (reason: string) => change(expenseCancelPath(councilId, expenseId), { reason }),
    reimburse: () => change(expenseReimbursePath(councilId, expenseId), {}),
    apply,
    reload: read.reload,
  }
}
export type ExpenseDetailState = ReturnType<typeof useExpenseDetail>
