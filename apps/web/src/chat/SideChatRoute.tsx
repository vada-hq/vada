import { useEffect, useState } from 'react'
import type { RoomDetailResponse } from '@vada/contracts'
import { getJson } from '@/lib/api'
import { isRoomLost, roomPath } from './chat-api'

const RETRY_MS = 3000

// 빈 1:1은 목록에 없으므로 직접 받은 주소도 서버의 방 종류를 확인한 뒤 칸을 고른다.
export function useUnlistedDirect(councilId: string, roomId: string | null) {
  const [checked, setChecked] = useState<{
    councilId: string
    roomId: string
    direct: boolean
  } | null>(null)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    if (!roomId) return
    const controller = new AbortController()
    let retry: ReturnType<typeof setTimeout> | undefined
    void getJson<RoomDetailResponse>(roomPath(councilId, roomId), controller.signal).then(
      result => {
        if (controller.signal.aborted) return
        // 연결 실패·5xx는 방 종류를 말해 주지 않는다. 전체 폭으로 정하지 않고 첫 화면에서 기다리며 다시 읽는다.
        if (!result.ok && !isRoomLost(result.status)) {
          retry = setTimeout(() => setAttempt(count => count + 1), RETRY_MS)
          return
        }
        setChecked({ councilId, roomId, direct: result.ok && result.data.room.type === 'direct' })
      },
    )
    return () => {
      controller.abort()
      clearTimeout(retry)
    }
  }, [councilId, roomId, attempt])
  return checked?.councilId === councilId && checked.roomId === roomId ? checked : null
}
