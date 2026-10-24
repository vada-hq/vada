import type { HomeResponse } from '@vada/contracts'
import type { Page } from '../workspace/pages'
import CouncilSection from './CouncilSection'
import DepartmentsSection from './DepartmentsSection'
import MineSection from './MineSection'
import ReceivedSection from './ReceivedSection'
import SettlingSection from './SettlingSection'

export type HomeOpeners = {
  onOpenTask: (taskId: string) => void
  onOpenRequest: (requestId: string) => void
  // 정산 수가 있는 행사는 '예산·정산' 탭으로 연다.
  onOpenEvent: (eventId: string, tab?: 'money') => void
  onOpenPage: (page: Page) => void
}

// 응답에 있는 부분만 차례대로: 받은 것(남이 기다린다) → 학생회 → 내 부서 → 정산할 행사 → 내 업무.
export default function HomeBody({
  home,
  onOpenTask,
  onOpenRequest,
  onOpenEvent,
  onOpenPage,
}: { home: HomeResponse } & HomeOpeners) {
  const seeTasks = () => onOpenPage('tasks')
  const seeEvents = () => onOpenPage('events')
  return (
    <>
      {home.received && (
        <ReceivedSection
          received={home.received}
          onOpenRequest={onOpenRequest}
          onSeeAll={() => onOpenPage('finance')}
        />
      )}
      {home.council && (
        <CouncilSection
          council={home.council}
          onOpenTask={onOpenTask}
          onOpenEvent={onOpenEvent}
          onSeeTasks={seeTasks}
          onSeeEvents={seeEvents}
        />
      )}
      {home.departments && (
        <DepartmentsSection
          departments={home.departments}
          onOpenTask={onOpenTask}
          onSeeAll={seeTasks}
        />
      )}
      {home.settling && (
        <SettlingSection settling={home.settling} onOpenEvent={onOpenEvent} onSeeAll={seeEvents} />
      )}
      <MineSection mine={home.mine} onOpenTask={onOpenTask} onSeeAll={seeTasks} />
    </>
  )
}
