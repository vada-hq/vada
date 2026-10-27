import { ClipboardList } from 'lucide-react'
import type { HomeResponse } from '@vada/contracts'
import { openMenu, openMessageRoom } from '@/lib/go-to'
import type { RoomListState } from '../chat/useRoomList'
import { myTasksLabel } from './council-view'
import HomeFeaturedEvents from './HomeFeaturedEvents'
import HomeGreeting, { HomeShortcut } from './HomeGreeting'
import { inboxRooms } from './home-view'
import MessageInbox from './MessageInbox'

export default function DepartmentGreeting({
  home,
  councilId,
  name,
  rooms,
  onOpenEvent,
}: {
  home: HomeResponse
  councilId: string
  name: string
  rooms: RoomListState
  onOpenEvent: (id: string) => void
}) {
  return (
    <HomeGreeting
      today={home.today}
      name={name}
      inbox={
        <MessageInbox
          inCard
          rooms={rooms.kind === 'ready' ? inboxRooms(rooms.data.rooms) : []}
          onOpenRoom={(id, eventId) => openMessageRoom(councilId, id, eventId)}
          onSeeAll={() => openMenu('chat', councilId)}
        />
      }
      featured={<HomeFeaturedEvents home={home} onOpen={onOpenEvent} />}
      shortcuts={
        <HomeShortcut
          icon={ClipboardList}
          label={myTasksLabel(home.myTasks)}
          onOpen={() => openMenu('tasks', councilId)}
        />
      }
    />
  )
}
