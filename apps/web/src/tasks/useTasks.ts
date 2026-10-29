import { useCallback, useEffect, useRef, useState } from 'react'
import { statusOf, type TaskFilter, type TasksResponse, type TaskView } from '@vada/contracts'
import { getJson } from '@/lib/api'
import { useActive } from '@/lib/use-active'
import { useLatest } from '@/lib/use-latest'
import { LIST_POLL_MS, useVisiblePoll } from '@/lib/use-visible-poll'
import { tasksPath, type TaskNarrow } from './task-api'

// notFound: 거르기로 준 행사가 없다(지워졌거나 다른 학생회). 화면이 거르기를 풀 수 있게 알린다.
type Loaded =
  | { kind: 'failed'; notFound: boolean }
  | { kind: 'ready'; tasks: TasksResponse['tasks']; truncated: boolean }
type TasksState = { kind: 'loading' } | Loaded

// 업무 목록 하나(보기와 거르기, 서버가 거르는 칩·홈 범위). 화면이 보이는 동안 15초마다, 화면이 다시 보일 때, 알림이 올 때 다시 읽는다.
// 탭을 바꾸면 이전 탭의 늦은 응답은 버린다. 읽다 실패해도 보이던 목록은 그대로 둔다. 권한이 바뀌었으면(403) 학생회를 다시 읽게 한다.
export function useTasks(
  councilId: string,
  {
    view,
    filter,
    eventId,
    narrow = {},
  }: { view: TaskView; filter: TaskFilter; eventId?: string | undefined; narrow?: TaskNarrow },
  onForbidden: () => void,
  enabled = true,
) {
  // 주소가 보기·거르기·행사·범위를 모두 담으므로 읽기의 열쇠로 쓴다(렌더마다 새 narrow 객체여도 같은 글자다).
  const key = tasksPath(councilId, { view, status: filter, eventId }, narrow)
  const [loaded, setLoaded] = useState<{ key: string; state: Loaded } | null>(null)
  const forbidden = useLatest(onForbidden)
  const latestKey = useLatest(key)
  const latestEnabled = useLatest(enabled)
  const issued = useRef(0)
  const isActive = useActive()
  const load = useCallback(async () => {
    // 꺼질 때도 차례를 올려, 꺼지기 전에 보낸 읽기의 늦은 응답을 버린다.
    const seq = ++issued.current
    // 화면이 사라졌으면 읽지 않는다(답을 어차피 버린다).
    if (!isActive()) return
    // 옛 거르기·꺼진 때 받은 reload를 늦게 불러도 지금 주소와 켜짐으로 읽는다(차례를 올려 지금 읽기를 버리므로 대신 읽는다).
    const mine = latestEnabled.current ? latestKey.current : null
    if (mine === null) return
    const result = await getJson<TasksResponse>(mine)
    // 더 나중에 보낸 읽기가 있거나(탭을 바꿈 포함) 화면이 사라졌거나 보낸 뒤 거르기가 바뀌었으면 이 응답은 버린다.
    if (seq !== issued.current || !isActive() || mine !== latestKey.current) return
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
  }, [forbidden, isActive, latestKey, latestEnabled])
  useEffect(() => {
    void load()
  }, [load, key, enabled])
  useVisiblePoll(() => void load(), LIST_POLL_MS)
  const state: TasksState = loaded?.key === key ? loaded.state : { kind: 'loading' }
  return { state, reload: load }
}
export type TaskList = ReturnType<typeof useTasks>
