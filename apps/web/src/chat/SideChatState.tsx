import { useEffect, useState } from 'react'
import type { Screen } from './ChatPage'
import { saveSideRoom, savedRoom, savedSideRoom } from './last-room'

// 주소는 지금 연 방, 메모리는 학생회 탭을 바꾼 뒤에도 남는 오른쪽 칸이다.
export function useSideChatPanel({
  councilId,
  meId,
  screen,
  onScreen,
  split,
}: {
  councilId: string
  meId: string
  screen: Screen
  onScreen: (screen: Screen) => void
  split: boolean
}) {
  const addressSide = screen.kind === 'home' ? screen.sideRoomId : undefined
  const [side, setSide] = useState(() => ({
    councilId,
    meId,
    roomId: savedSideRoom(councilId, meId),
  }))
  const remembered =
    side.councilId === councilId && side.meId === meId
      ? side.roomId
      : savedSideRoom(councilId, meId)
  useEffect(() => {
    if (addressSide) {
      saveSideRoom(councilId, meId, addressSide)
      setSide({ councilId, meId, roomId: addressSide })
    }
  }, [addressSide, councilId, meId])
  const open = (roomId: string) => {
    if (split) {
      saveSideRoom(councilId, meId, roomId)
      setSide({ councilId, meId, roomId })
      onScreen({ kind: 'home', sideRoomId: roomId })
    } else onScreen({ kind: 'room', roomId })
  }
  const close = () => {
    saveSideRoom(councilId, meId, null)
    setSide({ councilId, meId, roomId: null })
    if (addressSide) {
      const roomId = savedRoom(councilId)
      onScreen(roomId ? { kind: 'home', roomId } : { kind: 'home' })
    }
  }
  return { roomId: addressSide ?? remembered, open, close }
}
