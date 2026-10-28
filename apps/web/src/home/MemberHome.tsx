import type { ReactNode } from 'react'
import type { EventTab, HomeResponse } from '@vada/contracts'
import { openMenu, openMessageRoom, openRecord } from '@/lib/go-to'
import type { RoomListState } from '../chat/useRoomList'
import type { Page } from '../workspace/pages'
import HomeFeaturedEvents from './HomeFeaturedEvents'
import HomeFrame from './HomeFrame'
import HomeGreeting from './HomeGreeting'
import { inboxRooms } from './home-view'
import { HOME_PLANS } from './home-kinds'
import { GridLayout } from './HomeLayout'
import { MyRequestsCard, MyWorkCard } from './MemberCards'
import MessageInbox from './MessageInbox'
import { NewEventButton } from './NoOpenEvents'
import ParticipatingCard from './ParticipatingCard'
import UnassignedBand from './UnassignedBand'
import UpcomingCard from './UpcomingCard'

type Props = {
  home: HomeResponse
  councilId: string
  // 인사 카드의 이름(학생회 읽기의 내 이름)
  name: string
  // 작업 공간이 읽는 대화 목록을 메시지함도 쓴다(DEC-90).
  rooms: RoomListState
  // 학생회 직급도 부서도 없으면 맨 위 '부서 배정 전' 띠(DEC-87)
  awaitingDepartment: boolean
  // 알림 꺼짐 띠 자리(작업 공간의 띠가 이 자리에 그려진다)
  pushBand?: ReactNode
  onOpenEvent: (eventId: string, tab?: EventTab) => void
  onOpenPage: (page: Page) => void
  // 행사를 만들 수 있는 사람에게만 온다(명세 027 정한 것 11). 부원은 보통 없어 누가 만드는지 한 줄이다.
  onNewEvent?: (() => void) | undefined
}

const [PARTICIPATING, UPCOMING] = HOME_PLANS.member.cards

// 행사를 만들 수 없는 사람의 행사 빈 상태: 누가 만드는지 한 줄(DEC-95, DEC-78 이동 규칙 9).
const whoCreates = <p className="text-xs text-gray-500">회장단과 부서장이 만들어요</p>

// 부원 홈(HOME-01M, DEC-95): 인사 카드(메시지함, 학생회 주요 행사 타일 3) → 2×2
// '참여 행사 진행' · '가까운 일정' / '내 요청'(와이어프레임 '확정된 결정·안내' 자리) · '내 업무'.
// 부서 없는 운영진도 이 홈이고, 맨 위 띠와 빈 참여 행사, 학생회 행사로 채운 가까운 일정을 본다(서버가 범위를 정한다).
// 홈 응답 하나로 그리고 따로 읽거나 주기적으로 읽지 않는다(명세 027 정한 것 3).
export default function MemberHome({
  home,
  councilId,
  name,
  rooms,
  awaitingDepartment,
  pushBand,
  ...open
}: Props) {
  const openEvent = (eventId: string) => open.onOpenEvent(eventId)
  return (
    <HomeFrame
      assignBand={awaitingDepartment && <UnassignedBand />}
      pushBand={pushBand}
      greeting={
        <HomeGreeting
          today={home.today}
          name={name}
          inbox={
            <MessageInbox
              inCard
              rooms={rooms.kind === 'ready' ? inboxRooms(rooms.data.rooms) : []}
              onOpenRoom={(roomId, eventId) => openMessageRoom(councilId, roomId, eventId)}
              onSeeAll={() => openMenu('chat', councilId)}
            />
          }
          featured={<HomeFeaturedEvents home={home} onOpen={openEvent} />}
        />
      }
    >
      <GridLayout
        cards={[
          <ParticipatingCard
            key="participating"
            title={PARTICIPATING}
            participating={home.participating}
            onOpenEvent={openEvent}
            onSeeAll={() => open.onOpenPage('events')}
            emptyAction={
              open.onNewEvent ? <NewEventButton onNewEvent={open.onNewEvent} /> : whoCreates
            }
          />,
          <UpcomingCard
            councilId={councilId}
            key="upcoming"
            title={UPCOMING}
            upcoming={home.upcoming}
            wideDate
            onOpenTask={taskId => openRecord('tasks', councilId, taskId, { behind: 'home' })}
            onOpenEvent={open.onOpenEvent}
          />,
          <MyRequestsCard
            key="requests"
            myRequests={home.myRequests}
            onOpenRequest={requestId => openRecord('purchases', councilId, requestId)}
            onSeeAll={() => openMenu('purchases', councilId, { view: 'mine' })}
          />,
          <MyWorkCard
            key="work"
            myTasks={home.myTasks}
            // 업무 '내 업무' 탭(업무 메뉴의 기본 보기라 주소에 view가 없다, DEC-94)
            onOpenTasks={() => openMenu('tasks', councilId, { tab: 'mine' })}
          />,
        ]}
      />
    </HomeFrame>
  )
}
