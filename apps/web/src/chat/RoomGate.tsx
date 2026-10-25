import { useEffect, useState, type ReactNode } from 'react'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import { ADDRESS_LOST } from '@/lib/messages'
import type { RoomList } from './useRoomList'

// 주소가 가리킨 방이 내 방 목록에 있을 때만 연다(PRIN-5: 주소는 볼 권한을 주지 않는다).
// 목록에 없으면 방을 읽기 전에 한 번 목록을 다시 읽어 보고(방금 생긴 1:1일 수 있다), 그래도 없으면 있는지 없는지 가르지 않는 '찾을 수 없음'이다.
// 목록을 못 읽었으면 가르지 않고 방을 열어 서버가 정한다.
function useRoomCheck(rooms: RoomList, roomId: string) {
  const { state, reload } = rooms
  const [checked, setChecked] = useState<string | null>(null)
  const missing = state.kind === 'ready' && !state.data.rooms.some(item => item.id === roomId)
  useEffect(() => {
    if (!missing || checked === roomId) return
    let live = true
    void reload().then(() => live && setChecked(roomId))
    return () => {
      live = false
    }
  }, [missing, checked, roomId, reload])
  if (state.kind === 'loading') return 'checking'
  if (!missing) return 'known'
  return checked === roomId ? 'missing' : 'checking'
}

export default function RoomGate({
  rooms,
  roomId,
  onList,
  children,
}: {
  rooms: RoomList
  roomId: string
  // 상위 목록(대화방 목록)으로 간다.
  onList: () => void
  children: ReactNode
}) {
  const check = useRoomCheck(rooms, roomId)
  if (check === 'known') return children
  if (check === 'checking') return <StateMessage kind="loading">방 불러오는 중…</StateMessage>
  return (
    <div className="flex flex-col gap-3">
      <StateMessage kind="notice">{ADDRESS_LOST}</StateMessage>
      <Button variant="outline" className="self-start" onClick={onList}>
        대화방 목록
      </Button>
    </div>
  )
}
