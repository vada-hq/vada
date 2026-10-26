import { statusOf, type BudgetResponse } from '@vada/contracts'
import { usePolledRead } from '@/lib/use-polled-read'
import { budgetPath } from './finance-api'

type Loaded = { kind: 'failed' } | { kind: 'ready'; budget: BudgetResponse }
export type BudgetState = { kind: 'loading' } | Loaded

// 지금 회계 기간과 지출 예산 항목. 화면이 보이는 동안 15초마다, 다시 보일 때 읽는다(날짜가 바뀌면 기간도 바뀐다).
// 읽다 실패해도 보이던 값은 그대로 둔다. 권한이 바뀌었으면(403) 학생회를 다시 읽게 한다.
export function useBudget(councilId: string, onForbidden: () => void, periodId?: string) {
  const read = usePolledRead<BudgetResponse>(budgetPath(councilId, periodId), status => {
    if (status === statusOf('FORBIDDEN')) onForbidden()
  })
  const state: BudgetState =
    read.state.kind === 'ready' ? { kind: 'ready', budget: read.state.data } : read.state
  return { state, reload: read.reload }
}
