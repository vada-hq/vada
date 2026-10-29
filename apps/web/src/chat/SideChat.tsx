import { useState } from 'react'
import { PERMISSION_CHANGED } from '@/lib/messages'
import { useNow } from '@/lib/use-now'
import { Room, type RoomPage } from './ChatPage'
import DirectDialog from './DirectDialog'
import SideChatListView from './SideChatListView'
import { DIRECT_LIST_TITLE } from './message-text'

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

export default function SideChat({
  page,
  roomId,
  onOpen,
  onClose,
}: Props & {
  roomId: string | null
  onClose: () => void
}) {
  return (
    <aside
      aria-label={DIRECT_LIST_TITLE}
      className="h-full w-96 shrink-0 border-l-2 border-personal-border-strong bg-personal-surface/60"
      onKeyDown={event => {
        if (event.key === 'Escape' && roomId) {
          event.stopPropagation()
          onClose()
        }
      }}
    >
      {roomId ? (
        <Room key={roomId} page={page} roomId={roomId} onBack={onClose} onDirect={onOpen} side />
      ) : (
        <SideChatList page={page} onOpen={onOpen} />
      )}
    </aside>
  )
}
