import type {
  EventSummary,
  HomeCouncilBoard,
  HomeDepartmentBoard,
  HomeEventLane,
  HomeFollowUp,
  HomeList,
  HomeOps,
  HomeOpsKind,
  HomeOpsRow,
  HomeParticipation,
  HomeResponse,
  HomeTask,
  HomeTaskGroup,
  HomeTodo,
  HomeWeek,
  PurchaseRequestSummary,
  RoomSummary,
} from '@vada/contracts'
import type { RoomListState } from '@/chat/useRoomList'
import { json } from './mock-api'

export const homeEvent = (id: string, extra: Partial<EventSummary> = {}): EventSummary => ({
  id,
  name: `행사 ${id}`,
  startsAt: '2026-10-20T10:00',
  endsAt: '2026-10-20T12:00',
  place: null,
  owner: { id: 'p1', name: '김회장', current: true },
  status: 'ongoing',
  ...extra,
})

export const homeRequest = (id: string): PurchaseRequestSummary => ({
  id,
  title: `요청 ${id}`,
  status: 'pending',
  requestedBy: { id: 'p2', name: '박부원' },
  neededBy: null,
  itemCount: 1,
  createdAt: '2026-10-20T03:00:00.000Z',
  payable: false,
  event: null,
})

export const noTasks: HomeList = { tasks: [], total: 0 }

export const homeTask = (
  id: string,
  group: HomeTaskGroup,
  extra: Partial<HomeTask> = {},
): HomeTask => ({
  id,
  title: `업무 ${id}`,
  status: 'todo',
  next: 'in_progress',
  dueDate: '2026-10-25',
  overdue: group === 'overdue',
  department: null,
  event: null,
  assignee: { id: 'p1', name: '김새내', current: true },
  actions: ['task.change_status'],
  group,
  ...extra,
})

const noCounts = { overdue: 0, today: 0, soon: 0, later: 0, noDue: 0 }

// 새 홈(기능 027)의 공통 칸은 빈 값이다. 지금 화면은 이 칸을 읽지 않는다.
// 종류는 아직 지금 홈(기능 010)을 그리는 부서장이다(명세 027 정한 것 8). 새 홈은 councilHome, memberHome으로 만든다.
export const homeResponse = (extra: Partial<HomeResponse> = {}): HomeResponse => ({
  today: '2026-10-23',
  kind: 'department',
  financeView: false,
  asOf: '2026-10-23T09:00',
  myTasks: { open: 0, overdue: 0, nearest: null },
  featuredEvents: [],
  participating: { events: [], total: 0 },
  upcoming: { items: [], total: 0 },
  myRequests: { requests: [], total: 0 },
  mine: { tasks: [], counts: noCounts },
  ...extra,
})

// 회장단 홈(기능 027 조각 6)의 칸. 시험이 정하지 않으면 비어 있다.
export const followUpRow = (id: string, extra: Partial<HomeFollowUp> = {}): HomeFollowUp => ({
  event: {
    id,
    name: `행사 ${id}`,
    startsAt: '2026-10-08T10:00',
    endsAt: '2026-10-08T12:00',
    status: 'ended',
  },
  endedDays: 15,
  remaining: { tasks: 0, settlement: 0 },
  ...extra,
})

// ① 확인이 필요한 운영 상황. 시험이 정하지 않으면 0건이다.
export const emptyOps = (extra: Partial<HomeOps> = {}): HomeOps => ({
  rows: [],
  counts: { late: 0, today: 0, tomorrow: 0, approval: 0 },
  assign: { by: 'council', noDepartment: 0, unassignedMembers: 0, financeStaffed: true },
  total: 0,
  ...extra,
})

export const opsRow = (
  id: string,
  kind: HomeOpsKind,
  extra: Partial<HomeOpsRow> = {},
): HomeOpsRow => ({
  kind,
  target: { kind: kind === 'approval' ? 'request' : 'task', id },
  title: `일 ${id}`,
  days: 0,
  event: null,
  contact: null,
  noHead: null,
  actions: [],
  ...extra,
})

// ② 행사 줄 하나. 시험이 정하지 않으면 신호 없는 예정 행사다.
export const eventLane = (id: string, extra: Partial<HomeEventLane> = {}): HomeEventLane => ({
  event: {
    id,
    name: `행사 ${id}`,
    startsAt: '2026-10-27T10:00',
    endsAt: '2026-10-27T12:00',
    status: 'upcoming',
    color: 'lime',
  },
  milestone: { kind: 'event_start', date: '2026-10-27', days: 4 },
  registration: null,
  undecided: [],
  late: [],
  budget: null,
  ...extra,
})

// ③ 내가 할 일, ⑤ 이번 주. 시험이 정하지 않으면 0건이다.
export const emptyTodo = (extra: Partial<HomeTodo> = {}): HomeTodo => ({
  rows: [],
  counts: { minutes: 0, event_tidy: 0, task_late: 0, task_today: 0 },
  total: 0,
  meTint: 0,
  ...extra,
})
export const emptyWeek = (extra: Partial<HomeWeek> = {}): HomeWeek => ({
  items: [],
  total: 0,
  ...extra,
})

const councilBoard = (extra: Partial<HomeCouncilBoard> = {}): HomeCouncilBoard => ({
  financeStaffed: true,
  events: { cards: [], counts: { planning: 0, ongoing: 0, followUp: 0 } },
  followUp: { events: [], total: 0 },
  attention: { items: [], total: 0 },
  unassignedMembers: 0,
  ops: emptyOps(),
  todo: emptyTodo(),
  week: emptyWeek(),
  lanes: { events: [], total: 0 },
  ...extra,
})

export const councilHome = (
  board: Partial<HomeCouncilBoard> = {},
  extra: Partial<HomeResponse> = {},
): HomeResponse => homeResponse({ kind: 'council', councilBoard: councilBoard(board), ...extra })

// 부장 홈(HOME-01D, 10/30). 시험이 정하지 않으면 구역이 비고 배정할 일은 부장 갈래 0건이다.
export const departmentHome = (
  board: Partial<HomeDepartmentBoard> = {},
  extra: Partial<HomeResponse> = {},
): HomeResponse =>
  homeResponse({
    kind: 'department',
    departmentBoard: {
      ops: emptyOps({ assign: { by: 'head', noAssignee: 0, departments: [] } }),
      todo: emptyTodo(),
      week: emptyWeek(),
      lanes: { events: [], total: 0 },
      budget: null,
      ...board,
    },
    ...extra,
  })

// 부원 홈(기능 027 조각 7, HOME-01M). 시험이 정하지 않으면 공통 칸이 비어 있다.
export const memberHome = (extra: Partial<HomeResponse> = {}): HomeResponse =>
  homeResponse({ kind: 'member', ...extra })

export const participation = (
  id: string,
  extra: Partial<HomeParticipation> = {},
): HomeParticipation => ({
  event: homeEvent(id, { startsAt: '2026-10-28T10:00', endsAt: null, status: 'upcoming' }),
  tasks: { done: 2, total: 5 },
  next: null,
  ...extra,
})

// 줄의 묶음으로 수를 세고, 줄보다 수가 많은 경우는 counts로 덮어쓴다.
export const homeWithTasks = (tasks: HomeTask[], counts: Partial<typeof noCounts> = {}) => {
  const own = { ...noCounts }
  for (const task of tasks) own[task.group] += 1
  return homeResponse({ mine: { tasks, counts: { ...own, ...counts } } })
}

type Extras = {
  requests?: PurchaseRequestSummary[]
  events?: EventSummary[]
}
// 홈이 응답 밖에서 같이 읽는 내 요청, 행사 목록. 시험이 정하지 않으면 비어 있다.
export function onHomeExtras(
  api: { on: (method: string, path: string, handler: () => Response) => void },
  extras: Extras = {},
  councilId = 'c1',
) {
  const base = `/api/organizations/${councilId}`
  api.on('GET', `${base}/purchase-requests?view=mine`, () =>
    json({ requests: extras.requests ?? [], truncated: false }),
  )
  api.on('GET', `${base}/events`, () => json({ events: extras.events ?? [], truncated: false }))
}

// 홈 메시지함이 쓰는 대화 목록(작업 공간이 옆 메뉴 배지와 같이 읽은 것). 읽는 중이면 메시지함이 없다.
export const noRooms: RoomListState = { kind: 'loading' }
export const roomsOf = (rooms: RoomSummary[]): RoomListState => ({
  kind: 'ready',
  data: {
    rooms,
    unreadTotal: rooms.reduce((sum, room) => sum + room.unread, 0),
    mentionTotal: 0,
  },
})
