import { useEffect, useState } from 'react'
import type { RoomDetailResponse } from '@vada/contracts'
import { getJson } from '@/lib/api'
import { roomPath } from './chat-api'

// 빈 1:1은 목록에 없으므로 직접 받은 주소도 서버의 방 종류를 확인한 뒤 칸을 고른다.
export function useUnlistedDirect(councilId: string, roomId: string | null) {
  const [checked, setChecked] = useState<{
    councilId: string
    roomId: string
    direct: boolean
  } | null>(null)
  useEffect(() => {
    if (!roomId) return
    const controller = new AbortController()
    void getJson<RoomDetailResponse>(roomPath(councilId, roomId), controller.signal).then(
      result => {
        if (!controller.signal.aborted)
          setChecked({ councilId, roomId, direct: result.ok && result.data.room.type === 'direct' })
      },
    )
    return () => controller.abort()
  }, [councilId, roomId])
  return checked?.councilId === councilId && checked.roomId === roomId ? checked : null
}
