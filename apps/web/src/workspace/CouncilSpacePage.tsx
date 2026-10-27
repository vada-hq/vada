import { COUNCIL_TABS, type CouncilView } from '@vada/contracts'
import RoomView from '@/chat/RoomView'
import type { RoomList } from '@/chat/useRoomList'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import { openRecord } from '@/lib/go-to'
import { ROOMS_LOAD_FAILED } from '@/lib/messages'
import { withTaskLayout } from '@/lib/task-layout'
import { pickQuery, useMenuQuery } from '@/lib/use-menu-query'
import TasksPage from '@/tasks/TasksPage'
import type { Team } from '@/team/useTeam'
import CouncilSpace from './CouncilSpace'

type Props = {
  view: CouncilView
  rooms: RoomList
  team: Team
  onForbidden: () => void
  onTasksChanged: () => void
}

// 조각 6 전까지 공지방을 바로 연다. 대화 메뉴의 마지막 방 기억은 읽지도 쓰지도 않는다(DEC-96).
function NoticeRoom({ view, rooms, team, onForbidden }: Props) {
  const { state } = rooms
  if (state.kind === 'loading')
    return <StateMessage kind="loading">대화방 불러오는 중…</StateMessage>
  if (state.kind === 'failed')
    return (
      <div className="flex flex-col items-start gap-3">
        <StateMessage kind="error">{ROOMS_LOAD_FAILED}</StateMessage>
        <Button variant="outline" onClick={() => void rooms.reload()}>
          다시 시도
        </Button>
      </div>
    )
  const room = state.data.rooms.find(item => item.type === 'all_members')
  if (!room) return <StateMessage kind="empty">공지방 없음</StateMessage>
  return (
    <RoomView
      key={room.id}
      councilId={view.council.id}
      roomId={room.id}
      meId={view.me.memberId}
      rooms={rooms}
      request={{
        canRequest: view.permissions.includes('purchase.request'),
        canAssign: view.permissions.includes('finance.manage'),
        team: team.data,
        onOpenRequest: id => openRecord('purchases', view.council.id, id),
      }}
      canWriteExpense={view.permissions.includes('finance.manage')}
      onForbidden={onForbidden}
      className="overflow-hidden rounded-lg border"
    />
  )
}

export default function CouncilSpacePage(props: Props) {
  const { view } = props
  const url = useMenuQuery('council', view.council.id)
  const tab = pickQuery(COUNCIL_TABS, url.query['tab'], 'messages')
  return (
    <CouncilSpace
      tab={tab}
      onTab={next => {
        if (next === tab) return
        url.set(next === 'tasks' ? withTaskLayout(view.me.memberId, { tab: next }) : { tab: next })
      }}
    >
      {tab === 'tasks' ? (
        <TasksPage
          view={view}
          councilSpace
          onForbidden={props.onForbidden}
          onChanged={props.onTasksChanged}
        />
      ) : (
        <NoticeRoom {...props} />
      )}
    </CouncilSpace>
  )
}
