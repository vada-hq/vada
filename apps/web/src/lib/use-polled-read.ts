import { useCallback, useEffect, useRef, useState } from 'react'
import { getJson } from '@/lib/api'
import { useActive } from '@/lib/use-active'
import { useLatest } from '@/lib/use-latest'
import { LIST_POLL_MS, useVisiblePoll } from '@/lib/use-visible-poll'

type Loaded<T> = { kind: 'failed' } | { kind: 'ready'; data: T }
export type PolledState<T> = { kind: 'loading' } | Loaded<T>

// 읽기 하나. 화면이 보이는 동안 15초마다, 화면이 다시 보일 때 다시 읽는다. 경로가 바뀌면 이전 경로의 늦은 응답은 버린다.
// 읽다 실패해도 보이던 값은 그대로 둔다. 실패한 상태 번호는 onError로 알린다(권한·사라짐을 보는 쪽이 정한다).
// replace는 내 변경이 돌려준 새 값을 바로 놓고, 아직 오지 않은 이전 읽기의 응답은 버린다.
export function usePolledRead<T>(path: string, onError: (status: number) => void, enabled = true) {
  const [loaded, setLoaded] = useState<{ path: string; state: Loaded<T> } | null>(null)
  const errorHandler = useLatest(onError)
  const latestPath = useLatest(path)
  const issued = useRef(0)
  const isActive = useActive()
  const load = useCallback(async () => {
    if (!enabled) return
    const seq = ++issued.current
    const mine = path
    const result = await getJson<T>(mine)
    if (seq !== issued.current || !isActive()) return
    if (result.ok) return setLoaded({ path: mine, state: { kind: 'ready', data: result.data } })
    errorHandler.current(result.status)
    setLoaded(before =>
      before?.path === mine && before.state.kind === 'ready'
        ? before
        : { path: mine, state: { kind: 'failed' } },
    )
  }, [path, enabled, errorHandler, isActive])
  useEffect(() => {
    void load()
  }, [load])
  useVisiblePoll(() => void load(), LIST_POLL_MS)
  const replace = useCallback(
    (data: T) => {
      issued.current += 1
      setLoaded({ path: latestPath.current, state: { kind: 'ready', data } })
    },
    [latestPath],
  )
  const state: PolledState<T> = loaded?.path === path ? loaded.state : { kind: 'loading' }
  return { state, reload: load, replace }
}
