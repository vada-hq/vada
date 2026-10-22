import { useRef, useState } from 'react'
import type { IncomeResponse } from '@vada/contracts'
import { postJson } from '@/lib/api'
import { useLatest } from '@/lib/use-latest'
import { usePolledRead } from '@/lib/use-polled-read'
import { incomeCancelPath, incomePath } from './income-api'
import {
  incomeProblem,
  isStale,
  reportIncomeLost,
  type IncomeDialogHandlers,
} from './income-requests'

// 취소의 결과. 이미 바뀐 상태(취소됨, 잠김)면 수입을 다시 읽어 보이고 'stale'이다.
export type IncomeOutcome = 'done' | 'stale' | 'failed'

// 수입 하나를 읽고 취소한다. 열려 있는 동안 화면이 보이면 15초마다, 다시 보일 때 다시 읽는다.
// 읽다 실패해도 보이던 수입은 그대로 둔다. 바꾸는 요청은 한 번에 하나만 나간다.
export function useIncomeDetail(
  councilId: string,
  incomeId: string,
  handlers: IncomeDialogHandlers,
) {
  const latest = useLatest(handlers)
  const read = usePolledRead<IncomeResponse>(
    incomePath(councilId, incomeId),
    status => void reportIncomeLost(latest.current, status),
  )
  const [saving, setSaving] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const sending = useRef(false)

  async function cancel(reason: string): Promise<IncomeOutcome> {
    if (sending.current) return 'failed'
    sending.current = true
    setSaving(true)
    setProblem(null)
    const result = await postJson<IncomeResponse>(incomeCancelPath(councilId, incomeId), { reason })
    sending.current = false
    setSaving(false)
    if (result.ok) {
      read.replace(result.data)
      latest.current.onChanged()
      return 'done'
    }
    if (reportIncomeLost(latest.current, result.status)) return 'failed'
    setProblem(incomeProblem(result.code))
    if (!isStale(result.code)) return 'failed'
    latest.current.onChanged()
    await read.reload()
    return 'stale'
  }

  return {
    income: read.state.kind === 'ready' ? read.state.data.income : null,
    loadFailed: read.state.kind === 'failed',
    retry: () => void read.reload(),
    saving,
    problem,
    report: setProblem,
    cancel,
  }
}
export type IncomeDetailState = ReturnType<typeof useIncomeDetail>
