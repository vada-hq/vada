import type { ReactNode } from 'react'
import { menuPath, type EventTab, type HomeCouncilBoard, type HomeResponse } from '@vada/contracts'
import { openEventTasks, openMenu, openRecord } from '@/lib/go-to'
import { navigate } from '@/lib/app-location'
import { departmentFocus } from '@/lib/org-focus'
import type { Page } from '../workspace/pages'
import { FollowUpCard } from './CouncilColumns'
import CouncilEventsCard from './CouncilEventsCard'
import { CouncilHead, CouncilSplit } from './CouncilHomeLayout'
import { HOME_PLANS } from './home-kinds'
import OpsCard from './OpsCard'
import UpcomingCard from './UpcomingCard'
import FinanceSummary from './FinanceSummary'

type Props = {
  home: HomeResponse
  board: HomeCouncilBoard
  councilId: string
  // 머리 인사의 이름(학생회 읽기의 내 이름)
  name: string
  // 알림 꺼짐 띠 자리(작업 공간의 띠가 이 자리에 그려진다)
  pushBand?: ReactNode
  onOpenEvent: (eventId: string, tab?: EventTab) => void
  onOpenPage: (page: Page) => void
  onNewEvent?: (() => void) | undefined
}

// 회장단 홈 배치 L3(notes layout-report.md '가'): 머리(날짜 + 인사) → ① 한 단 전체 → 아래 두 단(왼쪽 ② 행사, 오른쪽 ③⑤·사용 가능).
// ①이 0건이면 ① 띠 대신 머리 한 문장(calmGreeting)으로 합친다(merge).
// ②③⑤ 자리는 시연 조각 ㉯㉰에서 새 구역으로 바뀐다. 그때까지 지금 카드(행사 진행 현황, 후속 정리, 가까운 일정, 재정 요약)를 그 자리에 둔다.
export default function CouncilHome({ home, board, councilId, name, pushBand, ...open }: Props) {
  const openTask = (taskId: string) => openRecord('tasks', councilId, taskId, { behind: 'home' })
  const calm = board.ops.total === 0
  return (
    <div className="@container flex flex-col gap-4 @2xl:gap-6">
      {pushBand}
      <CouncilHead today={home.today} name={name} calm={calm} />
      {!calm && (
        <OpsCard
          ops={board.ops}
          onOpen={target =>
            target.kind === 'task'
              ? openTask(target.id)
              : openRecord('purchases', councilId, target.id)
          }
          onAssignTasks={() =>
            openMenu('tasks', councilId, {
              tab: 'council',
              events: 'include',
              dept: 'none',
              assignee: 'none',
            })
          }
          onSeePeople={() => openMenu('people', councilId)}
          onSeeFinance={() => navigate(menuPath('people', councilId), { pageState: 'finance' })}
          onSetHead={departmentId =>
            navigate(menuPath('people', councilId), { pageState: departmentFocus(departmentId) })
          }
        />
      )}
      <CouncilSplit
        ruleAbove={!calm}
        left={
          <CouncilEventsCard
            events={board.events}
            today={home.today}
            onOpenEvent={eventId => open.onOpenEvent(eventId)}
            onOpenTasks={(eventId, query) => openEventTasks(councilId, eventId, query)}
            onSeeAll={() => open.onOpenPage('events')}
            onNewEvent={open.onNewEvent}
          />
        }
        right={[
          <FollowUpCard
            key="follow-up"
            followUp={board.followUp}
            onOpenEvent={open.onOpenEvent}
            onSeeAll={() => openMenu('finance', councilId, { tab: 'closing' })}
          />,
          <UpcomingCard
            councilId={councilId}
            key="upcoming"
            title={HOME_PLANS.council.columns[2]}
            upcoming={home.upcoming}
            onOpenTask={openTask}
            onOpenEvent={open.onOpenEvent}
          />,
        ]}
        bottomRight={
          <FinanceSummary
            summary={home.financeSummary}
            onOpen={() => openMenu('finance', councilId)}
          />
        }
      />
    </div>
  )
}
