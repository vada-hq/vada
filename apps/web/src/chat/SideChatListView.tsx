import type { RoomList as RoomListHook } from './useRoomList'
import { Plus } from 'lucide-react'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import { ROOMS_LOAD_FAILED } from '@/lib/messages'
import RoomRow from './RoomRow'
import { DIRECT_EMPTY, DIRECT_LIST_TITLE, DIRECT_ROOMS_LABEL, DIRECT_START } from './message-text'
import { directRooms } from './space-rooms'
import { SidePanelCloseButton } from './SidePanelClose'

type ListProps = {
  state: RoomListHook['state']
  now: Date
  onOpen: (roomId: string) => void
}

function DirectRooms({ state, now, onOpen }: ListProps) {
  if (state.kind !== 'ready')
    return (
      <StateMessage kind={state.kind === 'loading' ? 'loading' : 'error'} className="p-4">
        {state.kind === 'loading' ? '대화방 불러오는 중…' : ROOMS_LOAD_FAILED}
      </StateMessage>
    )
  const rooms = directRooms(state.data.rooms)
  if (rooms.length === 0)
    return (
      <StateMessage kind="empty" className="p-4">
        {DIRECT_EMPTY}
      </StateMessage>
    )
  return (
    <ul
      aria-label={DIRECT_ROOMS_LABEL}
      className="min-h-0 flex-1 divide-y divide-border-subtle overflow-y-auto"
    >
      {rooms.map(room => (
        <RoomRow
          key={room.id}
          room={room}
          now={now}
          active={false}
          onOpen={() => onOpen(room.id)}
        />
      ))}
    </ul>
  )
}

export default function SideChatListView({
  canDirect,
  onStart,
  note,
  ...list
}: ListProps & {
  canDirect: boolean
  onStart: () => void
  note: string | null
}) {
  return (
    <section aria-label="1:1 대화" className="flex h-full min-h-0 flex-col break-keep">
      <header className="flex min-h-14 shrink-0 items-center gap-2 border-b bg-white py-2 pr-2 pl-4">
        <h2 className="min-w-0 flex-1 text-base font-semibold text-fg">{DIRECT_LIST_TITLE}</h2>
        {canDirect && (
          <Button variant="ghost" size="icon" touch aria-label={DIRECT_START} onClick={onStart}>
            <Plus aria-hidden />
          </Button>
        )}
        <SidePanelCloseButton />
      </header>
      {note && (
        <StateMessage kind="notice" className="p-4">
          {note}
        </StateMessage>
      )}
      <DirectRooms {...list} />
    </section>
  )
}
