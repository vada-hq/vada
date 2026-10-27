import type { ReactNode } from 'react'
import type { HomeDepartmentBoard, HomeResponse } from '@vada/contracts'
import { openMenu, openRecord } from '@/lib/go-to'
import { rememberDepartment } from '@/lib/menu-memory'
import type { RoomListState } from '../chat/useRoomList'
import type { HomeOpeners } from './HomeBody'
import { DepartmentAttentionCard, DepartmentPurchasesCard } from './DepartmentCards'
import HomeFrame from './HomeFrame'
import DepartmentGreeting from './DepartmentGreeting'
import { GridLayout } from './HomeLayout'
import { HOME_PLANS } from './home-kinds'
import { NewEventButton } from './NoOpenEvents'
import ParticipatingCard from './ParticipatingCard'
import UpcomingCard from './UpcomingCard'

type Props = HomeOpeners & {
  home: HomeResponse
  board: HomeDepartmentBoard
  councilId: string
  memberId: string
  name: string
  rooms: RoomListState
  pushBand?: ReactNode
}
const [PARTICIPATING, UPCOMING] = HOME_PLANS.department.cards

// HOME-01D: 부서장·부부장과 다중 부서 모두 서버가 고른 범위로 그린다. 별도 조회·주기 읽기는 없다.
export default function DepartmentHome({
  home,
  board,
  councilId,
  memberId,
  name,
  rooms,
  pushBand,
  ...open
}: Props) {
  const openTask = (id: string) => openRecord('tasks', councilId, id)
  const seeTasks = () => {
    for (const department of board.departments) rememberDepartment(department.id, department.name)
    openMenu('tasks', councilId, {
      view: 'department',
      heads: 'true',
      attention: 'true',
      ...(board.departments.length === 1 ? { dept: board.departments[0]!.id } : {}),
    })
  }
  return (
    <HomeFrame
      pushBand={pushBand}
      greeting={
        <DepartmentGreeting
          home={home}
          councilId={councilId}
          name={name}
          rooms={rooms}
          onOpenEvent={id => open.onOpenEvent(id)}
        />
      }
    >
      <GridLayout
        cards={[
          <ParticipatingCard
            key="events"
            title={PARTICIPATING}
            participating={home.participating}
            onOpenEvent={id => open.onOpenEvent(id)}
            onSeeAll={() => open.onOpenPage('events')}
            emptyAction={open.onNewEvent && <NewEventButton onNewEvent={open.onNewEvent} />}
          />,
          <UpcomingCard
            key="upcoming"
            title={UPCOMING}
            upcoming={home.upcoming}
            wideDate
            onOpenTask={openTask}
            onOpenEvent={open.onOpenEvent}
          />,
          <DepartmentPurchasesCard
            key="purchases"
            purchases={board.purchases}
            memberId={memberId}
            onOpen={id => openRecord('purchases', councilId, id)}
            onSeeAll={() => openMenu('finance', councilId, { tab: 'requests', view: 'department' })}
          />,
          <DepartmentAttentionCard
            key="attention"
            board={board}
            onOpenTask={openTask}
            onOpenEvent={open.onOpenEvent}
            onSeeAll={seeTasks}
            onCongestion={() =>
              board.congestion &&
              openMenu('tasks', councilId, {
                view: 'department',
                heads: 'true',
                assignee: board.congestion.member.id,
                due: 'week',
                ...(board.congestion.departmentIds.length === 1
                  ? { dept: board.congestion.departmentIds[0]! }
                  : {}),
              })
            }
          />,
        ]}
      />
    </HomeFrame>
  )
}
