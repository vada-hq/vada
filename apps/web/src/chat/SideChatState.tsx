import { useEffect, useRef, useState } from 'react'
import type { Screen } from './ChatPage'
import { saveSideRoom, savedRoom, savedSideOpen, savedSideRoom } from './last-room'
import { DIRECT_PANEL_TOGGLE_ID } from './SidePanelClose'

type Side = { councilId: string; meId: string; open: boolean; roomId: string | null }

const readSide = (councilId: string, meId: string): Side => ({
  councilId,
  meId,
  open: savedSideOpen(councilId, meId),
  roomId: savedSideRoom(councilId, meId),
})

const focusable = (element: Element | null): element is HTMLElement =>
  element instanceof HTMLElement && element !== document.body && element.isConnected

// 이름 버튼은 1:1을 여는 동안 꺼져(busy) 초점을 잃는다. 마지막으로 초점을 받은 곳을 연 자리로 쓴다.
function useLastFocus() {
  const last = useRef<Element | null>(null)
  useEffect(() => {
    const keep = (event: FocusEvent) => {
      if (event.target instanceof Element) last.current = event.target
    }
    document.addEventListener('focusin', keep)
    return () => document.removeEventListener('focusin', keep)
  }, [])
  return () => (focusable(document.activeElement) ? document.activeElement : last.current)
}

// 1:1 칸은 평소 닫혀 있고 이름·[1:1]·주소로 열린다(MSG-04, DEC-90).
// 주소는 지금 연 방, 메모리는 방·메뉴를 오가도 남는 오른쪽 칸이다.
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
  const [side, setSide] = useState(() => readSide(councilId, meId))
  const remembered =
    side.councilId === councilId && side.meId === meId ? side : readSide(councilId, meId)
  const isOpen = addressSide !== undefined || remembered.open
  // 닫으면 초점을 연 버튼(이름, [1:1])으로 돌려준다. 주소로 열었으면 [1:1]이다.
  const opener = useRef<Element | null>(null)
  const lastFocus = useLastFocus()
  const keep = (open: boolean, roomId: string | null) => {
    saveSideRoom(councilId, meId, roomId, open)
    setSide({ councilId, meId, open, roomId })
  }
  useEffect(() => {
    if (addressSide) {
      saveSideRoom(councilId, meId, addressSide)
      setSide({ councilId, meId, open: true, roomId: addressSide })
    }
  }, [addressSide, councilId, meId])
  const markOpener = () => {
    if (!isOpen) opener.current = lastFocus()
  }
  const leaveAddress = () => {
    if (!addressSide) return
    const roomId = savedRoom(councilId)
    onScreen(roomId ? { kind: 'home', roomId } : { kind: 'home' })
  }
  const open = (roomId: string) => {
    if (!split) return onScreen({ kind: 'room', roomId })
    markOpener()
    keep(true, roomId)
    onScreen({ kind: 'home', sideRoomId: roomId })
  }
  const showList = () => {
    markOpener()
    keep(true, null)
    leaveAddress()
  }
  const close = () => {
    keep(false, null)
    leaveAddress()
    const back = focusable(opener.current)
      ? opener.current
      : document.getElementById(DIRECT_PANEL_TOGGLE_ID)
    opener.current = null
    back?.focus()
  }
  return {
    isOpen,
    roomId: addressSide ?? remembered.roomId,
    open,
    showList,
    close,
    toggle: () => (isOpen ? close() : showList()),
  }
}
