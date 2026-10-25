import { useCallback, useEffect, useRef, useState } from 'react'
import { statusOf, type TaskCreateOptionsResponse } from '@vada/contracts'
import { getJson } from '@/lib/api'
import { useActive } from '@/lib/use-active'
import { useLatest } from '@/lib/use-latest'
import { LIST_POLL_MS, useVisiblePoll } from '@/lib/use-visible-poll'
import { taskOptionsPath } from './task-api'

export type TaskOptionsState =
  { kind: 'loading' } | { kind: 'failed' } | { kind: 'ready'; options: TaskCreateOptionsResponse }

// 업무를 만들 때 고를 수 있는 부서와 담당자(서버가 만들기와 같은 판정으로 센다, DEC-38). 목록처럼 15초마다 다시 읽는다.
// 읽다 실패해도 받아 둔 선택지는 그대로 둔다. 권한이 바뀌었으면(403) 학생회를 다시 읽게 한다.
export function useTaskOptions(
  councilId: string,
  eventId: string | undefined,
  onForbidden: () => void,
) {
  const key = `${councilId}|${eventId ?? ''}`
  const [loaded, setLoaded] = useState<{ key: string; state: TaskOptionsState } | null>(null)
  const forbidden = useLatest(onForbidden)
  const latestKey = useLatest(key)
  const issued = useRef(0)
  const isActive = useActive()
  const load = useCallback(async () => {
    const seq = ++issued.current
    const result = await getJson<TaskCreateOptionsResponse>(taskOptionsPath(councilId, eventId))
    if (seq !== issued.current || !isActive()) return
    const mine = latestKey.current
    if (result.ok) return setLoaded({ key: mine, state: { kind: 'ready', options: result.data } })
    if (result.status === statusOf('FORBIDDEN')) forbidden.current()
    setLoaded(before =>
      before?.key === mine && before.state.kind === 'ready'
        ? before
        : { key: mine, state: { kind: 'failed' } },
    )
  }, [councilId, eventId, forbidden, isActive, latestKey])
  useEffect(() => {
    void load()
  }, [load])
  useVisiblePoll(() => void load(), LIST_POLL_MS)
  const state: TaskOptionsState = loaded?.key === key ? loaded.state : { kind: 'loading' }
  return { state, reload: load }
}
