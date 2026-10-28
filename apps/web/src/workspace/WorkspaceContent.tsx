import type { CouncilView } from '@vada/contracts'
import type { ComponentType, Ref } from 'react'
import ChatRoute from '../chat/ChatRoute'
import CalendarPage from '../calendar/CalendarPage'
import MeetingsPage from '../meetings/MeetingsPage'
import EventsPage from '../events/EventsPage'
import FinancePage from '../finance/FinancePage'
import PurchasesPage from '../purchases/PurchasesPage'
import type { HomeOpeners } from '../home/HomeBody'
import HomePage from '../home/HomePage'
import type { EventTab } from '@vada/contracts'
import type { RoomList } from '../chat/useRoomList'
import CouncilSettings from '../settings/CouncilSettings'
import TasksPage from '../tasks/TasksPage'
import type { TaskList } from '../tasks/useTasks'
import OrganizationPage from '../team/OrganizationPage'
import StateMessage from '@/components/StateMessage'
import { useBottomNavigationHidden } from '@/components/BottomNavigationVisibility'
import { pageFrameClass, type PageWidth } from '@/components/page-width'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import type { Reading } from '@/lib/use-lost'
import { cn } from '@/lib/utils'
import type { Page } from './pages'
import type { CouncilData } from './useCouncilData'

type Props = {
  data: CouncilData
  rooms: RoomList
  tasks: TaskList
  page: Page
  taskId?: string | undefined
  // 주소의 칸. 바뀌면 페이지가 새로 열려 주소로 연 기록을 다시 연다. 기록 주소가 아니면 늘 같다.
  linkKey: string
  // 업무 카드·상세에서 행사 이름을, 홈에서 행사 줄을 눌렀다.
  onOpenEvent: (eventId: string, tab?: EventTab) => void
  onOpenPage: (page: Page) => void
  sidebarEvents?: readonly { id: string }[] | undefined
}

// 알림으로 열 업무를 받는 업무 화면과 재정 화면(재정은 주소를 스스로 읽는다).
function RecordsPage({
  data,
  tasks,
  page,
  taskId,
  view,
}: Pick<Props, 'data' | 'tasks' | 'taskId'> & {
  page: 'tasks' | 'finance'
  view: CouncilView
}) {
  if (page === 'tasks')
    return (
      <TasksPage
        view={view}
        initialTaskId={taskId}
        onForbidden={data.reload}
        onChanged={() => void tasks.reload()}
      />
    )
  return <FinancePage view={view} onForbidden={data.reload} />
}

// 홈과 대화. 홈이 첫 화면이다.
function LeadPage({
  data,
  rooms,
  page,
  taskId,
  view,
  ...openers
}: Pick<Props, 'data' | 'rooms' | 'taskId'> &
  HomeOpeners & {
    page: 'home' | 'chat' | 'council'
    view: CouncilView
  }) {
  if (page === 'home')
    return (
      <HomePage
        view={view}
        rooms={rooms.state}
        taskId={taskId}
        onForbidden={data.reload}
        {...openers}
      />
    )
  return (
    <ChatRoute
      councilId={view.council.id}
      view={view}
      team={data.team}
      rooms={rooms}
      onForbidden={data.reload}
    />
  )
}

// 학생회 화면과 권한 재읽기만 받는 메뉴(메뉴 v7의 구매, 캘린더).
const SINGLE_PAGES: Partial<
  Record<Page, ComponentType<{ view: CouncilView; onForbidden: () => void }>>
> = { purchases: PurchasesPage, calendar: CalendarPage, meetings: MeetingsPage }

function PageOf({
  data,
  rooms,
  tasks,
  page,
  taskId,
  onOpenEvent,
  onOpenPage,
  view,
  reading,
  sidebarEvents,
}: Props & { view: CouncilView; reading: Reading }) {
  if (page === 'home' || page === 'chat' || page === 'council')
    return <LeadPage {...{ data, rooms, page, taskId, onOpenEvent, onOpenPage, view }} />
  if (page === 'events')
    return (
      <EventsPage
        sidebarEvents={sidebarEvents}
        view={view}
        team={data.team}
        rooms={rooms}
        onForbidden={data.reload}
        onTasksChanged={() => void tasks.reload()}
      />
    )
  const Single = SINGLE_PAGES[page]
  if (Single) return <Single view={view} onForbidden={data.reload} />
  if (page === 'tasks' || page === 'finance')
    return <RecordsPage {...{ data, tasks, page, taskId, view }} />
  // 사람(people)과 옛 부서 주소(departments)는 같은 조직 화면이다(DEC-91).
  if (page === 'people' || page === 'departments')
    return (
      <OrganizationPage
        view={view}
        reading={reading}
        team={data.team}
        onCouncilChanged={data.reload}
        onOwnChange={data.reloadAfterOwnChange}
      />
    )
  // 학생회 이름이 바뀌면 옆 메뉴와 학생회 고르기의 이름도 바뀌도록 내 학생회 목록을 다시 읽는다.
  return <CouncilSettings view={view} onForbidden={data.reload} onSaved={data.saved} />
}

function Body({ data, ...props }: Props) {
  const { state } = data
  if (state.kind === 'lost')
    return (
      <StateMessage kind="notice">
        이 학생회의 운영진이 아니게 되었어요. 학생회 목록으로 돌아가요.
      </StateMessage>
    )
  if (state.kind === 'failed')
    return (
      <Card className="flex flex-col gap-3 p-6">
        <StateMessage kind="error">학생회를 불러오지 못했어요. 연결을 확인해 주세요.</StateMessage>
        <Button variant="outline" className="self-start" onClick={data.reload}>
          다시 시도
        </Button>
      </Card>
    )
  if (state.kind !== 'ready') return <StateMessage kind="loading">학생회 불러오는 중…</StateMessage>
  return (
    <PageOf key={props.linkKey} data={data} {...props} view={state.view} reading={state.reading} />
  )
}

// 본문 여백 없이 칸 끝까지 쓰는 화면. 목록·방 두 칸(메시지)이 스스로 여백을 둔다.
const EDGE_TO_EDGE = (page: Page) => page === 'council' || page === 'chat'

// 작업 공간 본문. 학생회를 불러오는 동안과 잃었을 때, 못 불러왔을 때를 보여 주고, 불러왔으면 고른 쪽을 보여 준다.
export default function WorkspaceContent({
  mainRef,
  width,
  ...props
}: Props & { mainRef: Ref<HTMLElement>; width: PageWidth }) {
  const bottomHidden = useBottomNavigationHidden()
  return (
    <main
      ref={mainRef}
      className={cn(
        'min-h-0 flex-1 overflow-y-auto md:scrollbar-gutter-stable',
        !EDGE_TO_EDGE(props.page) && 'p-4 sm:p-6',
        !bottomHidden && 'max-md:bottom-navigation-space',
      )}
    >
      <div className={cn(pageFrameClass(width), EDGE_TO_EDGE(props.page) && 'h-full min-h-0')}>
        <Body {...props} />
      </div>
    </main>
  )
}
