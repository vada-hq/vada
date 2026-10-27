import { useContext } from 'react'
import type { AppQuery, EventTab, HomeResponse, HomeDepartmentBoard } from '@vada/contracts'
import { openMenu, openMessageRoom, openRecord } from '@/lib/go-to'
import { rememberDepartment } from '@/lib/menu-memory'
import type { RoomListState } from '../chat/useRoomList'
import { PushBandSlot } from '../push/push-band-slot'
import type { Page } from '../workspace/pages'
import AttentionTiles from './AttentionTiles'
import CouncilHome from './CouncilHome'
import DepartmentHome from './DepartmentHome'
import FinanceHome from './FinanceHome'
import { useFinanceView } from './use-finance-view'
import { CouncilBlocked, CouncilEvents } from './CouncilSection'
import DepartmentsSection from './DepartmentsSection'
import { attentionOf } from './home-attention'
import { inboxRooms, mineRows } from './home-view'
import MemberHome from './MemberHome'
import MessageInbox from './MessageInbox'
import MineSection from './MineSection'
import ReceivedSection from './ReceivedSection'
import RequestsSection from './RequestsSection'
import SettlingSection from './SettlingSection'
import { useHomeExtras, type HomeExtras } from './useHomeExtras'
import WeekEventsSection from './WeekEventsSection'
import UnassignedBand from './UnassignedBand'
import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'

export type HomeOpeners = {
  // 정산 수가 있는 행사는 '재정' 탭으로 연다.
  onOpenEvent: (eventId: string, tab?: EventTab) => void
  onOpenPage: (page: Page) => void
  // 행사를 만들 수 있는 사람에게만 온다(canCreateEvent). 행사 빈 상태의 [새 행사]가 새 행사 창을 연다.
  onNewEvent?: (() => void) | undefined
}

type Props = HomeOpeners & {
  home: HomeResponse
  councilId: string
  // 인사 카드의 이름(새 홈)
  name: string
  memberId: string
  // 학생회 직급도 부서도 없는 운영진이면 부원 홈 맨 위에 '부서 배정 전' 띠(DEC-87)
  awaitingDepartment?: boolean
  // 작업 공간이 옆 메뉴 배지와 같이 읽는 대화 목록(DEC-90 홈 메시지함). 같은 응답이라 칩과 배지가 어긋나지 않는다.
  rooms: RoomListState
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
  // 정산할 행사 모두 보기는 같은 셈의 재정 '행사 정산' 탭이다(DEC-92).
  seeSettling: () => openMenu('finance', councilId, { tab: 'settlements' }),
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
        <div className="flex min-w-0 flex-col gap-3">
          {home.council.unassignedMembers > 0 && (
            <Button
              variant="link"
              className="min-h-11 w-full justify-between break-keep whitespace-normal"
              aria-label={`미배정 구성원 ${home.council.unassignedMembers}명`}
              onClick={() => open.onOpenPage('people')}
            >
              <span>미배정 구성원</span>
              <span className="text-right tabular-nums">{home.council.unassignedMembers}명</span>
            </Button>
          )}
          <CouncilEvents
            council={home.council}
            today={home.today}
            onOpenEvent={open.onOpenEvent}
            onSeeEvents={seeEvents}
            onNewEvent={open.onNewEvent}
          />
        </div>
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
          onSeeAll={requests.seeSettling}
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
      {/* 빈 상태의 [새 행사] 자리는 부장 홈(내 부서 부분을 받는 사람)에만 둔다(DEC-95). 부분이 없는 홈에는 생기지 않는다. */}
      {!home.council && (
        <WeekEventsSection
          events={extras.events}
          today={home.today}
          noOpenEvents={extras.noOpenEvents}
          onOpenEvent={open.onOpenEvent}
          onSeeAll={() => open.onOpenPage('events')}
          onNewEvent={home.departments?.length ? open.onNewEvent : undefined}
        />
      )}
    </div>
  )
}

// 지금 홈(기능 010): 맨 위에 숫자 카드, 바로 아래 메시지함, 그 아래 넓은 화면에서 두 단(와이어프레임 홈, Basecamp 홈). 휴대폰은 한 단이다.
// 목록을 아직 읽지 못했거나 읽지 못하면 메시지함만 빠진다. 새 배치가 오르지 않은 홈 종류가 그대로 쓴다(명세 027 정한 것 8).
function CurrentHome({
  home,
  councilId,
  rooms,
  onForbidden,
  awaitingDepartment = false,
  pushBand,
  ...open
}: Omit<Props, 'name' | 'memberId'> & { pushBand?: ReactNode }) {
  const extras = useHomeExtras(councilId, home.today, onForbidden, !home.council)
  const mineIds = new Set(mineRows(home.mine).map(task => task.id))
  const items = attentionOf(home, extras.requests, extras.events.length)
  return (
    <div className="flex flex-col gap-6">
      {awaitingDepartment && <UnassignedBand />}
      {pushBand}
      <AttentionTiles items={items} />
      <MessageInbox
        rooms={rooms.kind === 'ready' ? inboxRooms(rooms.data.rooms) : []}
        onOpenRoom={(roomId, eventId) => openMessageRoom(councilId, roomId, eventId)}
        onSeeAll={() => openMenu('chat', councilId)}
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <MainColumn home={home} councilId={councilId} mineIds={mineIds} {...open} />
        <SideColumn home={home} councilId={councilId} extras={extras} mineIds={mineIds} {...open} />
      </div>
    </div>
  )
}

// 홈 종류로 가른다(DEC-95, 명세 027 정한 것 8). 새 배치가 main에 오른 종류만 새 홈이고, 아직인 종류는 지금 홈 그대로다.
// 지금 오른 것: 회장단(조각 6), 부원(조각 7), 재정부(조각 8). 새 홈은 별도 읽기(useHomeExtras)를 부르지 않는다.
const isDepartmentHome = (
  home: HomeResponse,
): home is HomeResponse & { departmentBoard: HomeDepartmentBoard } =>
  home.kind === 'department' && home.departmentBoard !== undefined

export default function HomeBody({ name, memberId, awaitingDepartment = false, ...props }: Props) {
  const setPushSlot = useContext(PushBandSlot)
  const { home, councilId, rooms, onOpenEvent, onOpenPage, onNewEvent } = props
  const { finance, switcher } = useFinanceView(home, councilId)
  // 작업 공간의 알림 꺼짐 띠가 새 홈 틀의 이 자리에 그려진다. 띠가 없으면 자리도 없다.
  const pushBand = setPushSlot && <div ref={setPushSlot} className="empty:hidden" />
  const opens = { onOpenEvent, onOpenPage, onNewEvent }
  if (isDepartmentHome(home))
    return (
      <DepartmentHome
        home={home}
        board={home.departmentBoard}
        councilId={councilId}
        memberId={memberId}
        name={name}
        rooms={rooms}
        pushBand={pushBand}
        {...opens}
      />
    )
  if (finance && home.financeBoard)
    return (
      <>
        {switcher}
        <FinanceHome
          home={home}
          board={home.financeBoard}
          councilId={councilId}
          name={name}
          rooms={rooms}
          pushBand={pushBand}
        />
      </>
    )
  if (home.kind === 'council' && home.councilBoard)
    return (
      <>
        {switcher}
        <CouncilHome
          home={home}
          board={home.councilBoard}
          councilId={councilId}
          name={name}
          inboxRooms={rooms.kind === 'ready' ? inboxRooms(rooms.data.rooms) : []}
          pushBand={pushBand}
          {...opens}
        />
      </>
    )
  if (home.kind === 'member')
    return (
      <MemberHome
        home={home}
        councilId={councilId}
        name={name}
        rooms={rooms}
        awaitingDepartment={awaitingDepartment}
        pushBand={pushBand}
        {...opens}
      />
    )
  return <CurrentHome {...props} awaitingDepartment={awaitingDepartment} pushBand={pushBand} />
}
