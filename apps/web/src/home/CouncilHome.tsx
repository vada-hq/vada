import type { ReactNode } from 'react'
import { ClipboardList } from 'lucide-react'
import {
  dateFromKorean,
  type EventTab,
  type HomeCouncilBoard,
  type HomeResponse,
  type RoomSummary,
} from '@vada/contracts'
import { openEventTasks, openMenu, openRecord } from '@/lib/go-to'
import type { Page } from '../workspace/pages'
import { AttentionCard, FollowUpCard } from './CouncilColumns'
import CouncilEventsCard from './CouncilEventsCard'
import { myTasksLabel } from './council-view'
import HomeFrame from './HomeFrame'
import HomeGreeting, { HomeShortcut } from './HomeGreeting'
import { HOME_PLANS } from './home-kinds'
import { COLUMN_HEAD, CouncilLayout } from './HomeLayout'
import MessageInbox from './MessageInbox'
import UpcomingCard from './UpcomingCard'

type Props = {
  home: HomeResponse
  board: HomeCouncilBoard
  councilId: string
  // 인사 카드의 이름(학생회 읽기의 내 이름)
  name: string
  // 메시지함 칩(inboxRooms가 고른 방). 없으면 메시지함이 스스로 빠진다.
  inboxRooms: RoomSummary[]
  // 알림 꺼짐 띠 자리(작업 공간의 띠가 이 자리에 그려진다)
  pushBand?: ReactNode
  onOpenEvent: (eventId: string, tab?: EventTab) => void
  onOpenPage: (page: Page) => void
  onNewEvent?: (() => void) | undefined
}

const DESCRIPTION = '학생회 행사와 확인할 일을 봐요'

// 회장단 홈(HOME-01C, DEC-95): 인사 카드(메시지함 오른쪽, 주요 행사 타일 없음, 아래 '내 업무' 바로가기)
// → 전체 행사 진행 현황 → 3열(확인이 필요한 운영 상황 · 후속 정리 중인 행사 · 가까운 주요 일정).
// 맨 아래 '전체 재정 요약' 한 줄은 재정 셈이 붙는 조각(명세 027 조각 8)이 이 배치의 bottom에 채운다.
// 줄은 원래 기록을 연다: 업무는 업무 주소, 행사는 행사 주소(정산이 남으면 '재정' 탭), 참가 신청 마감은 '인원 관리' 탭.
export default function CouncilHome({
  home,
  board,
  councilId,
  name,
  inboxRooms,
  pushBand,
  ...open
}: Props) {
  const openTask = (taskId: string) => openRecord('tasks', councilId, taskId)
  return (
    <HomeFrame
      // 서버 시각은 한국 시각 글이라 틀이 읽는 순간(ISO)으로 바꿔 준다.
      asOf={dateFromKorean(home.asOf).toISOString()}
      today={home.today}
      pushBand={pushBand}
      greeting={
        <HomeGreeting
          today={home.today}
          name={name}
          description={DESCRIPTION}
          inbox={
            <MessageInbox
              inCard
              rooms={inboxRooms}
              onOpenRoom={roomId => openRecord('chat', councilId, roomId)}
              onSeeAll={() => openMenu('chat', councilId)}
            />
          }
          shortcuts={
            <HomeShortcut
              icon={ClipboardList}
              label={myTasksLabel(home.myTasks)}
              onOpen={() => openMenu('tasks', councilId)}
            />
          }
        />
      }
    >
      <CouncilLayout
        top={
          <CouncilEventsCard
            events={board.events}
            today={home.today}
            onOpenEvent={eventId => open.onOpenEvent(eventId)}
            onOpenTasks={(eventId, unassigned) =>
              openEventTasks(councilId, eventId, unassigned ? { view: 'unassigned' } : {})
            }
            onSeeAll={() => open.onOpenPage('events')}
            onNewEvent={open.onNewEvent}
          />
        }
        columns={[
          <AttentionCard
            key="attention"
            board={board}
            onOpenTask={openTask}
            onSeeAll={() => openMenu('tasks', councilId, { view: 'all' })}
            onSeePeople={() => openMenu('people', councilId)}
          />,
          <FollowUpCard
            key="follow-up"
            followUp={board.followUp}
            onOpenEvent={open.onOpenEvent}
            onSeeAll={() => openMenu('finance', councilId, { tab: 'settlements' })}
          />,
          <UpcomingCard
            key="upcoming"
            title={HOME_PLANS.council.columns[2]}
            upcoming={home.upcoming}
            headClassName={COLUMN_HEAD}
            onOpenTask={openTask}
            onOpenEvent={open.onOpenEvent}
          />,
        ]}
      />
    </HomeFrame>
  )
}
