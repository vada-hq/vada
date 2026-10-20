import { useCallback, useEffect, useRef, useState } from 'react'
import { statusOf, type RoomListResponse } from '@vada/contracts'
import { getJson } from '@/lib/api'
import { useActive } from '@/lib/use-active'
import { useLatest } from '@/lib/use-latest'
import { useVisiblePoll } from '@/lib/use-visible-poll'
import { CHAT_POLL_MS, chatBase } from './chat-api'

export type RoomListState =
  { kind: 'loading' } | { kind: 'failed' } | { kind: 'ready'; data: RoomListResponse }

// 방 목록과 안 읽은 수. 화면이 보이는 동안 3초마다 다시 읽는다. 읽다 실패해도 보이던 목록은 그대로 둔다.
// 권한이 바뀌었으면(403) 학생회를 다시 읽게 한다. 학생회를 아직 못 읽었거나 잃었으면(enabled가 false) 읽지 않는다.
export function useRoomList(councilId: string, onForbidden: () => void, enabled: boolean) {
  const [state, setState] = useState<RoomListState>({ kind: 'loading' })
  const forbidden = useLatest(onForbidden)
  const busy = useRef(false)
  const isActive = useActive()
  const load = useCallback(async () => {
    if (busy.current || !enabled) return
    busy.current = true
    const result = await getJson<RoomListResponse>(`${chatBase(councilId)}/rooms`)
    busy.current = false
    if (!isActive()) return
    if (result.ok) return setState({ kind: 'ready', data: result.data })
    if (result.status === statusOf('FORBIDDEN')) forbidden.current()
    setState(before => (before.kind === 'ready' ? before : { kind: 'failed' }))
  }, [councilId, forbidden, isActive, enabled])
  useEffect(() => {
    void load()
  }, [load])
  useVisiblePoll(() => void load(), CHAT_POLL_MS)
  return { state, reload: load }
}
export type RoomList = ReturnType<typeof useRoomList>
