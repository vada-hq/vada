import { useCallback, useEffect, useRef, useState } from 'react'
import { statusOf, type TaskFilter, type TasksResponse, type TaskView } from '@vada/contracts'
import { getJson } from '@/lib/api'
import { useActive } from '@/lib/use-active'
import { useLatest } from '@/lib/use-latest'
import { LIST_POLL_MS, useVisiblePoll } from '@/lib/use-visible-poll'
import { tasksPath } from './task-api'

// notFound: 거르기로 준 행사가 없다(지워졌거나 다른 학생회). 화면이 거르기를 풀 수 있게 알린다.
type Loaded =
  | { kind: 'failed'; notFound: boolean }
  | { kind: 'ready'; tasks: TasksResponse['tasks']; truncated: boolean }
type TasksState = { kind: 'loading' } | Loaded

// 업무 목록 하나(보기와 거르기). 화면이 보이는 동안 15초마다, 화면이 다시 보일 때, 알림이 올 때 다시 읽는다.
// 탭을 바꾸면 이전 탭의 늦은 응답은 버린다. 읽다 실패해도 보이던 목록은 그대로 둔다. 권한이 바뀌었으면(403) 학생회를 다시 읽게 한다.
export function useTasks(
  councilId: string,
  { view, filter, eventId }: { view: TaskView; filter: TaskFilter; eventId?: string | undefined },
  onForbidden: () => void,
  enabled = true,
) {
  const key = `${councilId}|${view}|${filter}|${eventId ?? ''}`
  const [loaded, setLoaded] = useState<{ key: string; state: Loaded } | null>(null)
  const forbidden = useLatest(onForbidden)
  const latestKey = useLatest(key)
  const issued = useRef(0)
  const isActive = useActive()
  const load = useCallback(async () => {
    if (!enabled) return
    const seq = ++issued.current
    const result = await getJson<TasksResponse>(tasksPath(councilId, view, filter, eventId))
    // 더 나중에 보낸 읽기가 있거나(탭을 바꿈 포함) 화면이 사라졌으면 이 응답은 버린다.
    if (seq !== issued.current || !isActive()) return
    const mine = latestKey.current
    if (result.ok) {
      const { tasks, truncated } = result.data
      return setLoaded({ key: mine, state: { kind: 'ready', tasks, truncated } })
    }
    if (result.status === statusOf('FORBIDDEN')) forbidden.current()
    // 404는 거르기로 준 행사가 없어졌다는 뜻이라 보이던 목록도 남기지 않는다.
    const notFound = result.status === statusOf('NOT_FOUND')
    setLoaded(before =>
      !notFound && before?.key === mine && before.state.kind === 'ready'
        ? before
        : { key: mine, state: { kind: 'failed', notFound } },
    )
  }, [councilId, view, filter, eventId, enabled, forbidden, isActive, latestKey])
  useEffect(() => {
    void load()
  }, [load])
  useVisiblePoll(() => void load(), LIST_POLL_MS)
  const state: TasksState = loaded?.key === key ? loaded.state : { kind: 'loading' }
  return { state, reload: load }
}
export type TaskList = ReturnType<typeof useTasks>
