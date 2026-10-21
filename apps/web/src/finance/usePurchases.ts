import { useCallback, useEffect, useRef, useState } from 'react'
import { statusOf, type PurchaseRequestsResponse, type PurchaseView } from '@vada/contracts'
import { getJson } from '@/lib/api'
import { useActive } from '@/lib/use-active'
import { useLatest } from '@/lib/use-latest'
import { LIST_POLL_MS, useVisiblePoll } from '@/lib/use-visible-poll'
import { purchasesPath } from './finance-api'

type Loaded =
  | { kind: 'failed' }
  | { kind: 'ready'; requests: PurchaseRequestsResponse['requests']; truncated: boolean }
type PurchasesState = { kind: 'loading' } | Loaded

// 구매 요청 목록 하나(보기). 화면이 보이는 동안 15초마다, 화면이 다시 보일 때, 알림이 올 때 다시 읽는다.
// 보기를 바꾸면 이전 보기의 늦은 응답은 버린다. 읽다 실패해도 보이던 목록은 그대로 둔다. 권한이 바뀌었으면(403) 학생회를 다시 읽게 한다.
export function usePurchases(
  councilId: string,
  view: PurchaseView,
  onForbidden: () => void,
  enabled = true,
) {
  const key = `${councilId}|${view}`
  const [loaded, setLoaded] = useState<{ key: string; state: Loaded } | null>(null)
  const forbidden = useLatest(onForbidden)
  const latestKey = useLatest(key)
  const issued = useRef(0)
  const isActive = useActive()
  const load = useCallback(async () => {
    if (!enabled) return
    const seq = ++issued.current
    const result = await getJson<PurchaseRequestsResponse>(purchasesPath(councilId, view))
    // 더 나중에 보낸 읽기가 있거나(보기를 바꿈 포함) 화면이 사라졌으면 이 응답은 버린다.
    if (seq !== issued.current || !isActive()) return
    const mine = latestKey.current
    if (result.ok) {
      const { requests, truncated } = result.data
      return setLoaded({ key: mine, state: { kind: 'ready', requests, truncated } })
    }
    if (result.status === statusOf('FORBIDDEN')) forbidden.current()
    setLoaded(before =>
      before?.key === mine && before.state.kind === 'ready'
        ? before
        : { key: mine, state: { kind: 'failed' } },
    )
  }, [councilId, view, enabled, forbidden, isActive, latestKey])
  useEffect(() => {
    void load()
  }, [load])
  useVisiblePoll(() => void load(), LIST_POLL_MS)
  const state: PurchasesState = loaded?.key === key ? loaded.state : { kind: 'loading' }
  return { state, reload: load }
}
export type PurchaseList = ReturnType<typeof usePurchases>
