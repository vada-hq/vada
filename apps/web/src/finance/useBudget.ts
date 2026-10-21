import { useCallback, useEffect, useRef, useState } from 'react'
import { statusOf, type BudgetResponse } from '@vada/contracts'
import { getJson } from '@/lib/api'
import { useActive } from '@/lib/use-active'
import { useLatest } from '@/lib/use-latest'
import { LIST_POLL_MS, useVisiblePoll } from '@/lib/use-visible-poll'
import { budgetPath } from './finance-api'

type Loaded = { kind: 'failed' } | { kind: 'ready'; budget: BudgetResponse }
export type BudgetState = { kind: 'loading' } | Loaded

// 지금 회계 기간과 지출 예산 항목. 화면이 보이는 동안 15초마다, 다시 보일 때 읽는다(날짜가 바뀌면 기간도 바뀐다).
// 읽다 실패해도 보이던 값은 그대로 둔다. 권한이 바뀌었으면(403) 학생회를 다시 읽게 한다.
export function useBudget(councilId: string, onForbidden: () => void) {
  const [loaded, setLoaded] = useState<{ councilId: string; state: Loaded } | null>(null)
  const forbidden = useLatest(onForbidden)
  const issued = useRef(0)
  const isActive = useActive()
  const load = useCallback(async () => {
    const seq = ++issued.current
    const result = await getJson<BudgetResponse>(budgetPath(councilId))
    // 더 나중에 보낸 읽기가 있거나 화면이 사라졌으면 이 응답은 버린다.
    if (seq !== issued.current || !isActive()) return
    if (result.ok) return setLoaded({ councilId, state: { kind: 'ready', budget: result.data } })
    if (result.status === statusOf('FORBIDDEN')) forbidden.current()
    setLoaded(before =>
      before?.councilId === councilId && before.state.kind === 'ready'
        ? before
        : { councilId, state: { kind: 'failed' } },
    )
  }, [councilId, forbidden, isActive])
  useEffect(() => {
    void load()
  }, [load])
  useVisiblePoll(() => void load(), LIST_POLL_MS)
  const state: BudgetState = loaded?.councilId === councilId ? loaded.state : { kind: 'loading' }
  return { state, reload: load }
}
