import { useCallback, useEffect, useRef, useState } from 'react'
import { statusOf, type HomeResponse } from '@vada/contracts'
import { getJson } from '@/lib/api'
import { useActive } from '@/lib/use-active'
import { useLatest } from '@/lib/use-latest'

type HomeState = { kind: 'loading' } | { kind: 'failed' } | { kind: 'ready'; home: HomeResponse }

const homePath = (councilId: string) => `/api/organizations/${encodeURIComponent(councilId)}/home`

// 홈 읽기. 열 때와 화면이 다시 보일 때 읽고, 주기적으로 읽지 않는다. 읽다 실패해도 보이던 것은 그대로 둔다.
// 직급을 잃었으면(403) 학생회를 다시 읽게 한다.
export function useHome(councilId: string, onForbidden: () => void) {
  const [state, setState] = useState<HomeState>({ kind: 'loading' })
  const forbidden = useLatest(onForbidden)
  const isActive = useActive()
  const issued = useRef(0)
  const load = useCallback(async () => {
    const seq = ++issued.current
    const result = await getJson<HomeResponse>(homePath(councilId))
    // 더 나중에 보낸 읽기가 있거나 화면이 사라졌으면 이 응답은 버린다.
    if (seq !== issued.current || !isActive()) return
    if (result.ok) return setState({ kind: 'ready', home: result.data })
    if (result.status === statusOf('FORBIDDEN')) forbidden.current()
    setState(before => (before.kind === 'ready' ? before : { kind: 'failed' }))
  }, [councilId, forbidden, isActive])
  useEffect(() => {
    void load()
  }, [load])
  const latest = useLatest(load)
  useEffect(() => {
    const onChange = () => {
      if (document.visibilityState === 'visible') void latest.current()
    }
    document.addEventListener('visibilitychange', onChange)
    return () => document.removeEventListener('visibilitychange', onChange)
  }, [latest])
  return { state, reload: load }
}
