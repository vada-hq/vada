import type { HomeResponse } from '@vada/contracts'
import type { Page } from '../workspace/pages'
import AttentionTiles from './AttentionTiles'
import { CouncilBlocked, CouncilEvents } from './CouncilSection'
import DepartmentsSection from './DepartmentsSection'
import { attentionOf } from './home-attention'
import { mineRows } from './home-view'
import MineSection from './MineSection'
import NoticesSection from './NoticesSection'
import ReceivedSection from './ReceivedSection'
import RequestsSection from './RequestsSection'
import SettlingSection from './SettlingSection'
import { useHomeExtras, type HomeExtras } from './useHomeExtras'
import WeekEventsSection from './WeekEventsSection'

export type HomeOpeners = {
  onOpenTask: (taskId: string) => void
  onOpenRequest: (requestId: string) => void
  // 정산 수가 있는 행사는 '예산·정산' 탭으로 연다.
  onOpenEvent: (eventId: string, tab?: 'money') => void
  onOpenPage: (page: Page) => void
}

type Props = HomeOpeners & {
  home: HomeResponse
  councilId: string
  onForbidden: () => void
}
type Parts = HomeOpeners & { home: HomeResponse; extras: HomeExtras; mineIds: Set<string> }

// 넓은 단: 남이 기다리는 것부터(DEC-69) 받은 것 → 학생회 행사 → 내 부서 → 정산할 행사 → 내 업무.
function MainColumn({ home, mineIds, ...open }: Omit<Parts, 'extras'>) {
  const seeTasks = () => open.onOpenPage('tasks')
  const seeEvents = () => open.onOpenPage('events')
  const shared = { today: home.today, mineIds, onOpenTask: open.onOpenTask }
  return (
    <div className="flex min-w-0 flex-col gap-6 lg:col-span-2">
      {home.received && (
        <ReceivedSection
          received={home.received}
          onOpenRequest={open.onOpenRequest}
          onSeeAll={() => open.onOpenPage('finance')}
        />
      )}
      {home.council && (
        <CouncilEvents
          council={home.council}
          today={home.today}
          onOpenEvent={open.onOpenEvent}
          onSeeEvents={seeEvents}
        />
      )}
      {home.departments && (
        <DepartmentsSection departments={home.departments} {...shared} onSeeAll={seeTasks} />
      )}
      {home.settling && (
        <SettlingSection
          settling={home.settling}
          onOpenEvent={open.onOpenEvent}
          onSeeAll={seeEvents}
        />
      )}
      <MineSection
        mine={home.mine}
        today={home.today}
        onOpenTask={open.onOpenTask}
        onSeeAll={seeTasks}
      />
    </div>
  )
}

// 좁은 단: 업무 화면에 없는 것과 회장단의 막힌 곳. 비면 부분째 빠진다.
function SideColumn({ home, extras, mineIds, ...open }: Parts) {
  const seeTasks = () => open.onOpenPage('tasks')
  return (
    <div className="flex min-w-0 flex-col gap-6">
      {home.council && (
        <CouncilBlocked
          council={home.council}
          today={home.today}
          mineIds={mineIds}
          onOpenTask={open.onOpenTask}
          onSeeTasks={seeTasks}
        />
      )}
      <RequestsSection
        requests={extras.requests}
        onOpenRequest={open.onOpenRequest}
        onSeeAll={() => open.onOpenPage('finance')}
      />
      {!home.council && (
        <NoticesSection notices={extras.notices} onOpenChat={() => open.onOpenPage('chat')} />
      )}
      {!home.council && (
        <WeekEventsSection
          events={extras.events}
          today={home.today}
          onOpenEvent={open.onOpenEvent}
          onSeeAll={() => open.onOpenPage('events')}
        />
      )}
    </div>
  )
}

// 맨 위에 숫자 카드, 그 아래 넓은 화면에서 두 단(와이어프레임 홈, Basecamp 홈). 휴대폰은 한 단이다.
export default function HomeBody({ home, councilId, onForbidden, ...open }: Props) {
  const extras = useHomeExtras(councilId, home.today, onForbidden, !home.council)
  const mineIds = new Set(mineRows(home.mine).map(task => task.id))
  const items = attentionOf(home, extras.requests, extras.events.length)
  return (
    <div className="flex flex-col gap-6">
      <AttentionTiles items={items} />
      <div className="grid gap-6 lg:grid-cols-3">
        <MainColumn home={home} mineIds={mineIds} {...open} />
        <SideColumn home={home} extras={extras} mineIds={mineIds} {...open} />
      </div>
    </div>
  )
}
