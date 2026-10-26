import { useEffect, useRef, useState } from 'react'
import { postJson } from '@/lib/api'
import { useLatest } from '@/lib/use-latest'
import { isRoomLost, roomPath } from './chat-api'
import type { RoomAt } from './room-state'

// 보는 중인 방의 마지막 메시지가 바뀌면(처음 열 때 포함) 거기까지 읽었다고 알린다. 숨은 화면은 읽은 것이 아니라 보내지 않는다.
// 같은 메시지는 한 번만 보낸다. 읽음은 뒤로 가지 않으므로 실패해도 다음 메시지에서 다시 맞춰진다.
// 답글 패널도 마지막 답글로 쓴다(방 단위 읽음, 022 정한 것 32).
export function useReadMarker(
  where: RoomAt,
  lastId: string | undefined,
  handlers: { onRead: () => void; onLost: () => void },
) {
  const sent = useRef<string | null>(null)
  const read = useLatest(handlers.onRead)
  const lost = useLatest(handlers.onLost)
  // 숨었다 돌아오면 그사이 읽지 못한 마지막 메시지를 다시 확인한다.
  const [visits, setVisits] = useState(0)
  useEffect(() => {
    const onChange = () => {
      if (document.visibilityState === 'visible') setVisits(count => count + 1)
    }
    document.addEventListener('visibilitychange', onChange)
    return () => document.removeEventListener('visibilitychange', onChange)
  }, [])
  useEffect(() => {
    if (!lastId || sent.current === lastId || document.visibilityState !== 'visible') return
    sent.current = lastId
    void postJson(`${roomPath(where.councilId, where.roomId)}/read`, { messageId: lastId }).then(
      result => {
        if (result.ok) return read.current()
        if (isRoomLost(result.status)) lost.current()
        else sent.current = null
      },
    )
  }, [where.councilId, where.roomId, lastId, visits, read, lost])
}
