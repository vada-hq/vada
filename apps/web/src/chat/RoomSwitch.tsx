import type { RoomSummary } from '@vada/contracts'
import type { KeyboardEvent } from 'react'
import { CountBadge } from '@/components/ui/count-badge'
import { TabButton } from '@/components/ui/tab-button'
import { cn } from '@/lib/utils'
import { switchName } from './chat-view'
import { switchRooms } from './space-rooms'
import { DIRECT_LIST_TITLE } from './message-text'

// US-MSG-01·EVT-MSG-01의 밑줄 탭. 긴 이름은 줄을 바꾸고, 키보드로 옮길 때 선택과 초점을 함께 바꾼다.
export default function RoomSwitch({
  rooms,
  activeId,
  onPick,
  className,
  direct,
}: {
  rooms: RoomSummary[]
  activeId: string | null
  onPick: (roomId: string) => void
  className?: string
  direct?: { active: boolean; unread: number; onPick: () => void } | undefined
}) {
  if (rooms.length <= 1 && !direct) return null
  const ordered = switchRooms(rooms)
  const count = ordered.length + Number(!!direct)
  const pick = (index: number) => {
    const room = ordered[index]
    if (room) onPick(room.id)
    else direct?.onPick()
  }
  const onKey = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const last = count - 1
    const indices: Record<string, number> = {
      ArrowRight: (index + 1) % count,
      ArrowLeft: (index + last) % count,
      Home: 0,
      End: last,
    }
    const next = indices[event.key]
    if (next === undefined) return
    event.preventDefault()
    event.currentTarget.parentElement
      ?.querySelectorAll<HTMLButtonElement>('[role="tab"]')
      [next]?.focus()
    pick(next)
  }
  return (
    <div
      role="tablist"
      aria-label="대화방"
      className={cn('flex min-w-0 flex-wrap items-stretch border-b bg-white', className)}
    >
      {ordered.map((room, index) => (
        <TabButton
          key={room.id}
          aria-selected={room.id === activeId}
          tabIndex={room.id === activeId ? 0 : -1}
          className="min-h-11 min-w-0 max-w-full gap-1.5 text-left break-keep whitespace-normal wrap-anywhere"
          onKeyDown={event => onKey(event, index)}
          onClick={() => onPick(room.id)}
        >
          {switchName(room)}
          <CountBadge count={room.unread} label={`안 읽은 메시지 ${room.unread}개`} />
        </TabButton>
      ))}
      {direct && (
        <TabButton
          aria-selected={direct.active}
          tabIndex={direct.active ? 0 : -1}
          className="min-h-11 gap-1.5 break-keep"
          onClick={direct.onPick}
          onKeyDown={event => onKey(event, ordered.length)}
        >
          {DIRECT_LIST_TITLE}{' '}
          <CountBadge count={direct.unread} label={`안 읽은 메시지 ${direct.unread}개`} />
        </TabButton>
      )}
    </div>
  )
}
