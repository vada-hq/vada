import { useCallback, useEffect, useRef, useState } from 'react'
import { statusOf, type RoomListResponse } from '@vada/contracts'
import { getJson } from '@/lib/api'
import { useActive } from '@/lib/use-active'
import { useLatest } from '@/lib/use-latest'
import { LIST_POLL_MS, useVisiblePoll } from '@/lib/use-visible-poll'
import { chatBase } from './chat-api'

export type RoomListState =
  { kind: 'loading' } | { kind: 'failed' } | { kind: 'ready'; data: RoomListResponse }

// 방 목록과 안 읽은 수. 화면이 보이는 동안 15초마다 다시 읽는다. 읽다 실패해도 보이던 목록은 그대로 둔다.
// 권한이 바뀌었으면(403) 학생회를 다시 읽게 한다. 학생회를 아직 못 읽었거나 잃었으면(enabled가 false) 읽지 않는다.
export function useRoomList(councilId: string, onForbidden: () => void, enabled: boolean) {
  const [state, setState] = useState<RoomListState>({ kind: 'loading' })
  const forbidden = useLatest(onForbidden)
  const isActive = useActive()
  const running = useRef<Promise<boolean> | null>(null)
  const queued = useRef<Promise<boolean> | null>(null)
  const read = useCallback(async () => {
    const result = await getJson<RoomListResponse>(`${chatBase(councilId)}/rooms`)
    if (!isActive()) return false
    if (result.ok) {
      setState({ kind: 'ready', data: result.data })
      return true
    }
    if (result.status === statusOf('FORBIDDEN')) forbidden.current()
    setState(before => (before.kind === 'ready' ? before : { kind: 'failed' }))
    return false
  }, [councilId, forbidden, isActive])
  // 읽는 중에 다시 부르면 그 읽기가 끝난 뒤 새로 한 번 읽는다(읽기를 시작한 뒤에 생긴 방이 그 응답에 없을 수 있다).
  // 읽었으면 true, 못 읽었으면 false다.
  const reload = useCallback((): Promise<boolean> => {
    if (!enabled) return Promise.resolve(false)
    const start = () => {
      const next = read().finally(() => {
        running.current = null
      })
      running.current = next
      return next
    }
    const before = running.current
    if (!before) return start()
    queued.current ??= before.then(() => {
      queued.current = null
      return start()
    })
    return queued.current
  }, [enabled, read])
  useEffect(() => {
    void reload()
  }, [reload])
  // 폴링은 읽는 중이면 건너뛴다.
  useVisiblePoll(() => {
    if (!running.current) void reload()
  }, LIST_POLL_MS)
  return { state, reload }
}
export type RoomList = ReturnType<typeof useRoomList>
