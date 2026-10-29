import { useEffect, useRef, useState } from 'react'
import { PERMISSION_CHANGED } from '@/lib/messages'
import { useNow } from '@/lib/use-now'
import { Room, type RoomPage } from './ChatPage'
import DirectDialog from './DirectDialog'
import SideChatListView from './SideChatListView'
import { DIRECT_LIST_TITLE } from './message-text'
import { DIRECT_PANEL_ID, SidePanelClose } from './SidePanelClose'

type Props = {
  page: RoomPage
  onOpen: (roomId: string) => void
}

// 1:1 목록은 동작 권한과 무관하게 서버가 준 방 전부를 보인다.
export function SideChatList({ page, onOpen }: Props) {
  const [dialog, setDialog] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const now = useNow()
  const canDirect = page.view.permissions.includes('chat.direct')
  const { state } = page.rooms
  return (
    <>
      <SideChatListView
        state={state}
        now={now}
        onOpen={onOpen}
        canDirect={canDirect}
        note={note}
        onStart={() => {
          setNote(null)
          setDialog(true)
        }}
      />
      <DirectDialog
        councilId={page.councilId}
        meId={page.view.me.memberId}
        team={page.team}
        open={dialog && canDirect}
        onClose={() => setDialog(false)}
        onOpened={roomId => {
          setDialog(false)
          void page.rooms.reload()
          onOpen(roomId)
        }}
        onForbidden={() => {
          setDialog(false)
          setNote(PERMISSION_CHANGED)
          page.onForbidden()
        }}
      />
    </>
  )
}

// PC 오른쪽 칸. 평소 닫혀 있다가 이름·[1:1]·주소로 열린다(MSG-04).
// 회장단 홈 부품처럼 흰 면과 옅은 선이고, 1:1임은 머리 글('○○님과 1:1')로 알린다.
export default function SideChat({
  page,
  roomId,
  onOpen,
  onBack,
  onClose,
}: Props & {
  roomId: string | null
  onBack: () => void
  onClose: () => void
}) {
  const panel = useRef<HTMLElement>(null)
  // [1:1]로 연 목록, 방에서 돌아온 목록은 칸으로 초점을 옮긴다(누른 버튼이 사라져 초점이 본문으로 빠지면 Esc도 닿지 않는다).
  // 방은 입력칸이 스스로 초점을 받는다.
  useEffect(() => {
    if (!roomId && !panel.current?.contains(document.activeElement)) panel.current?.focus()
  }, [roomId])
  return (
    <aside
      ref={panel}
      id={DIRECT_PANEL_ID}
      tabIndex={-1}
      aria-label={DIRECT_LIST_TITLE}
      className="h-full w-96 shrink-0 border-l bg-white outline-none"
      onKeyDown={event => {
        // 칸 안에서 연 대화상자·메뉴는 포털이라 React 이벤트가 여기까지 오른다. 그 Esc는 그 창만 닫는다.
        const inside = event.currentTarget.contains(event.target as Node)
        if (event.key === 'Escape' && inside && !event.defaultPrevented) {
          event.stopPropagation()
          onClose()
        }
      }}
    >
      <SidePanelClose value={onClose}>
        {roomId ? (
          <Room key={roomId} page={page} roomId={roomId} onBack={onBack} onDirect={onOpen} side />
        ) : (
          <SideChatList page={page} onOpen={onOpen} />
        )}
      </SidePanelClose>
    </aside>
  )
}
