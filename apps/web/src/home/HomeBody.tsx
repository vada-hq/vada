import type { AppQuery, HomeResponse } from '@vada/contracts'
import { openMenu, openRecord } from '@/lib/go-to'
import { rememberDepartment } from '@/lib/menu-memory'
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
  // 정산 수가 있는 행사는 '예산·정산' 탭으로 연다.
  onOpenEvent: (eventId: string, tab?: 'money') => void
  onOpenPage: (page: Page) => void
}

type Props = HomeOpeners & {
  home: HomeResponse
  councilId: string
  onForbidden: () => void
}
type Parts = HomeOpeners & {
  home: HomeResponse
  councilId: string
  extras: HomeExtras
  mineIds: Set<string>
}

// 업무 줄과 '모두 보기'는 그 줄이 보이는 보기·거르기로 연다(주소를 쌓는다).
function useTaskOpeners(councilId: string, home: HomeResponse) {
  const departments = [
    ...(home.departments ?? []),
    ...(home.council?.blocked.flatMap(item => (item.department ? [item.department] : [])) ?? []),
  ]
  return {
    openTask: (taskId: string) => openRecord('tasks', councilId, taskId),
    // 거르는 부서의 이름은 업무 화면의 칩이 쓴다(내 부서가 아닌 부서도 이름이 보이게).
    seeTasks: (query?: AppQuery) => {
      const department = departments.find(item => item.id === query?.['dept'])
      if (department) rememberDepartment(department.id, department.name)
      openMenu('tasks', councilId, query)
    },
  }
}

// 요청 줄은 그 요청의 주소로 연다(닫으면 홈으로 돌아온다). '받은 것' 모두 보기는 결재 대기 거르기, '내 요청'은 구매 요청 탭(내 요청)이다.
// 재정부의 재정 첫 화면은 개요라서 탭을 적어 보낸다.
const requestOpeners = (councilId: string) => ({
  openRequest: (requestId: string) => openRecord('purchases', councilId, requestId),
  seeReceived: () => openMenu('finance', councilId, { tab: 'requests', view: 'pending' }),
  seeMine: () => openMenu('finance', councilId, { tab: 'requests' }),
})

// 넓은 단: 남이 기다리는 것부터(DEC-69) 받은 것 → 학생회 행사 → 내 부서 → 정산할 행사 → 내 업무.
function MainColumn({ home, councilId, mineIds, ...open }: Omit<Parts, 'extras'>) {
  const { openTask, seeTasks } = useTaskOpeners(councilId, home)
  const seeEvents = () => open.onOpenPage('events')
  const requests = requestOpeners(councilId)
  const shared = { today: home.today, mineIds, onOpenTask: openTask }
  return (
    <div className="flex min-w-0 flex-col gap-6 lg:col-span-2">
      {home.received && (
        <ReceivedSection
          received={home.received}
          onOpenRequest={requests.openRequest}
          onSeeAll={requests.seeReceived}
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
        <DepartmentsSection
          departments={home.departments}
          {...shared}
          onSeeAll={department => seeTasks({ view: 'department', dept: department })}
        />
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
        onOpenTask={openTask}
        onSeeAll={() => seeTasks()}
      />
    </div>
  )
}

// 좁은 단: 업무 화면에 없는 것과 회장단의 막힌 곳. 비면 부분째 빠진다.
function SideColumn({ home, councilId, extras, mineIds, ...open }: Parts) {
  const { openTask, seeTasks } = useTaskOpeners(councilId, home)
  const requests = requestOpeners(councilId)
  return (
    <div className="flex min-w-0 flex-col gap-6">
      {home.council && (
        <CouncilBlocked
          council={home.council}
          today={home.today}
          mineIds={mineIds}
          onOpenTask={openTask}
          onSeeTasks={seeTasks}
        />
      )}
      <RequestsSection
        requests={extras.requests}
        onOpenRequest={requests.openRequest}
        onSeeAll={requests.seeMine}
      />
      {!home.council && (
        <NoticesSection
          notices={extras.notices}
          onOpenNotices={() => openMenu('chat', councilId, { tab: 'notices' })}
        />
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
        <MainColumn home={home} councilId={councilId} mineIds={mineIds} {...open} />
        <SideColumn home={home} councilId={councilId} extras={extras} mineIds={mineIds} {...open} />
      </div>
    </div>
  )
}
