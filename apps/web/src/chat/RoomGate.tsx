import { useEffect, useState, type ReactNode } from 'react'
import type { RoomDetailResponse } from '@vada/contracts'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import { getJson } from '@/lib/api'
import { ADDRESS_LOST } from '@/lib/messages'
import { isRoomLost, roomPath } from './chat-api'
import type { RoomList } from './useRoomList'

// 주소만으로는 방을 열지 않는다(PRIN-5: 주소는 볼 권한을 주지 않는다). 볼 수 있는지는 서버가 정한다.
// 내 방 목록에 있으면 바로 연다. 목록은 보여 줄 방만 담으므로(메시지가 없는 1:1은 빠진다) 없으면 서버에 그 방을 물어
// (메시지는 읽지 않는다) 주면 열고, 잃은 답(401·403·404)이면 있는지 없는지 가르지 않는 '찾을 수 없음'이다.
// 목록이나 그 방을 못 읽었으면 가르지 않고 방을 열어 방 화면이 서버의 답을 보인다.
function useRoomCheck(rooms: RoomList, councilId: string, roomId: string) {
  const { state } = rooms
  // 서버에 물은 방과 그 답이 잃은 답인지
  const [checked, setChecked] = useState<{ id: string; lost: boolean } | null>(null)
  const missing = state.kind === 'ready' && !state.data.rooms.some(item => item.id === roomId)
  useEffect(() => {
    if (!missing || checked?.id === roomId) return
    let live = true
    void getJson<RoomDetailResponse>(roomPath(councilId, roomId)).then(result => {
      if (live) setChecked({ id: roomId, lost: !result.ok && isRoomLost(result.status) })
    })
    return () => {
      live = false
    }
  }, [missing, checked?.id, councilId, roomId])
  if (state.kind === 'loading') return 'checking'
  if (!missing) return 'known'
  if (checked?.id !== roomId) return 'checking'
  return checked.lost ? 'missing' : 'known'
}

export default function RoomGate({
  rooms,
  councilId,
  roomId,
  onList,
  children,
}: {
  rooms: RoomList
  councilId: string
  roomId: string
  // 상위 목록(대화방 목록)으로 간다.
  onList: () => void
  children: ReactNode
}) {
  const check = useRoomCheck(rooms, councilId, roomId)
  if (check === 'known') return children
  // 대화 화면은 본문 여백 없이 칸 끝까지 쓰므로 안내에는 여백을 준다.
  if (check === 'checking')
    return (
      <StateMessage kind="loading" className="p-4 sm:p-6">
        방 불러오는 중…
      </StateMessage>
    )
  return (
    <div className="flex flex-col gap-3 p-4 sm:p-6">
      <StateMessage kind="notice">{ADDRESS_LOST}</StateMessage>
      <Button variant="outline" className="self-start" onClick={onList}>
        대화방 목록
      </Button>
    </div>
  )
}
