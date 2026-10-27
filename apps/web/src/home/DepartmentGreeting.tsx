import { ClipboardList } from 'lucide-react'
import type { HomeDepartmentBoard, HomeResponse } from '@vada/contracts'
import { openMenu, openMessageRoom } from '@/lib/go-to'
import type { RoomListState } from '../chat/useRoomList'
import { myTasksLabel } from './council-view'
import HomeFeaturedEvents from './HomeFeaturedEvents'
import HomeGreeting, { HomeShortcut } from './HomeGreeting'
import { inboxRooms } from './home-view'
import MessageInbox from './MessageInbox'

export default function DepartmentGreeting({
  home,
  board,
  councilId,
  name,
  rooms,
  onOpenEvent,
}: {
  home: HomeResponse
  board: HomeDepartmentBoard
  councilId: string
  name: string
  rooms: RoomListState
  onOpenEvent: (id: string) => void
}) {
  const label = board.departments.length === 1 ? board.departments[0]!.name : '우리 부서'
  return (
    <HomeGreeting
      today={home.today}
      name={name}
      description={`학생회 주요 행사와 ${label}의 행사·일정·구매를 봐요`}
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
