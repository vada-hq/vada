import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useActive } from '@/lib/use-active'
import { useVisiblePoll } from '@/lib/use-visible-poll'
import { CHAT_POLL_MS, isRoomLost } from './chat-api'
import {
  appended,
  loadRoom,
  prepended,
  readMessages,
  readNewer,
  withNotice,
  withSync,
  type RoomState,
} from './room-state'

export type { RoomState }

// 방 하나의 정보와 메시지 흐름. 처음엔 가장 최근 쪽을 읽고, 화면이 보이는 동안 3초마다 마지막 메시지 뒤를 이어 읽는다.
// 방을 바꾸면 화면이 새로 그려진다(key). 그래서 이전 방의 늦은 응답이 덮을 일이 없다.
export function useRoom(councilId: string, roomId: string) {
  const where = useMemo(() => ({ councilId, roomId }), [councilId, roomId])
  const [state, setState] = useState<RoomState>({ kind: 'loading' })
  const ready = state.kind === 'ready'
  const firstId = state.kind === 'ready' ? state.messages[0]?.id : undefined
  const lastId = state.kind === 'ready' ? state.messages.at(-1)?.id : undefined
  const busy = useRef(false)
  const isActive = useActive()
  const lose = useCallback(() => setState({ kind: 'lost' }), [])

  const first = useCallback(async () => {
    setState({ kind: 'loading' })
    const next = await loadRoom(councilId, roomId)
    if (isActive()) setState(next)
  }, [councilId, roomId, isActive])
  useEffect(() => {
    void first()
  }, [first])

  // 마지막 메시지 뒤를 읽어 붙인다.
  const catchUp = useCallback(async () => {
    if (busy.current || !ready) return
    busy.current = true
    const outcome = await readNewer(where, lastId, more => {
      if (isActive()) setState(before => appended(before, more))
      return isActive()
    })
    busy.current = false
    if (!isActive()) return
    if (outcome === 'lost') lose()
    else setState(before => withSync(before, outcome === 'failed'))
  }, [where, ready, lastId, lose, isActive])
  useVisiblePoll(() => void catchUp(), CHAT_POLL_MS)

  // 이전 쪽을 읽어 앞에 붙인다. 못 읽으면 false를 돌려준다.
  const loadOlder = useCallback(async () => {
    if (!firstId) return false
    const result = await readMessages(where, { before: firstId })
    if (!isActive()) return true
    if (!result.ok) {
      if (isRoomLost(result.status)) lose()
      return false
    }
    setState(now => prepended(now, result.data))
    return true
  }, [where, firstId, lose, isActive])

  // 공지 표시를 바꾼 뒤 그 메시지만 고친다. 흐름은 다시 읽지 않는다.
  const setNoticeLocally = useCallback(
    (messageId: string, isNotice: boolean) => setState(now => withNotice(now, messageId, isNotice)),
    [],
  )
  return { state, retry: first, lose, loadOlder, setNoticeLocally, sync: catchUp }
}
export type Room = ReturnType<typeof useRoom>
