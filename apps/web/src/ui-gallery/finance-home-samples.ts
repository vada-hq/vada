import type {
  HomeFinanceBoard,
  HomeFinanceSummary,
  HomeResponse,
  RoomSummary,
} from '@vada/contracts'
import type { RoomListState } from '@/chat/useRoomList'

export const financeCouncilId = '01900000-0000-7000-8000-000000000001'
const eventId = '01900000-0000-7000-8000-000000000002'
const requestId = '01900000-0000-7000-8000-000000000003'
const REQUEST_ID_START = 3
const EVENT_ID_START = 2
const event = { id: eventId, name: '가을 축제' }
export const financeSummary: HomeFinanceSummary = {
  overview: { total: 1200000, actual: 320000, committed: 410000, available: 470000 },
  missing: [{ id: '01900000-0000-7000-8000-000000000004', name: '체육대회' }],
}
export const financeBoard: HomeFinanceBoard = {
  pending: {
    requests: ['무대 음향 대여', '특강 안내 리플릿', '단체 티셔츠'].map((title, index) => ({
      id: `${requestId.slice(0, -1)}${index + REQUEST_ID_START}`,
      title,
      status: 'pending',
      requestedBy: { id: '01900000-0000-7000-8000-000000000006', name: '이수현' },
      neededBy: ['2026-10-27', '2026-10-29', '2026-11-08'][index]!,
      itemCount: 1,
      createdAt: '2026-10-20T03:00:00.000Z',
      payable: false,
      event,
    })),
    total: 5,
    pendingItems: 8,
    truncated: false,
  },
  nearby: {
    items: ['부스 테이블', '축제 안내 배너', '특강 명찰'].map((name, index) => ({
      id: `01900000-0000-7000-8000-00000000001${index}`,
      name,
      requestId,
      event,
      neededBy: '2026-10-28',
    })),
    total: 3,
  },
  settling: {
    events: [
      {
        event: {
          id: '01900000-0000-7000-8000-000000000007',
          name: '신입생 환영회',
          startsAt: '2026-10-17T10:00',
          endsAt: null,
          place: null,
          owner: null,
          status: 'ended',
        },
        settlement: { remaining: 2, settled: false },
        endedDays: 9,
      },
      {
        event: {
          id: '01900000-0000-7000-8000-000000000008',
          name: '진로 특강',
          startsAt: '2026-10-20T10:00',
          endsAt: null,
          place: null,
          owner: null,
          status: 'ended',
        },
        settlement: { remaining: 0, settled: true },
        endedDays: 6,
      },
    ],
    total: 2,
  },
  budgets: {
    events: [
      {
        event,
        budget: { event, amount: 1200000, actual: 320000, committed: 410000, available: 470000 },
      },
      {
        event: { id: '01900000-0000-7000-8000-000000000009', name: '전시' },
        budget: {
          event: { id: '01900000-0000-7000-8000-000000000009', name: '전시' },
          amount: 100000,
          actual: 90000,
          committed: 40000,
          available: -30000,
        },
      },
      { event: financeSummary.missing[0]!, budget: null },
    ],
    total: 3,
  },
  departments: [
    { id: '01900000-0000-7000-8000-000000000020', name: '재정부', overdue: 2, unassigned: 1 },
  ],
  ownedEnded: [
    {
      event: {
        id: '01900000-0000-7000-8000-000000000021',
        name: '지난 학기 간담회',
        startsAt: '2026-09-21T10:00',
        endsAt: null,
        status: 'ended',
      },
      endedDays: 35,
      remaining: { tasks: 1, settlement: 2 },
    },
  ],
}

export const financeHome: HomeResponse = {
  today: '2026-10-26',
  kind: 'finance',
  financeView: false,
  asOf: '2026-10-26T14:05',
  myTasks: { open: 2, overdue: 0, nearest: null },
  featuredEvents: ['가을 축제', '진로 특강', '체육대회'].map((name, index) => ({
    id: `${eventId.slice(0, -1)}${index + EVENT_ID_START}`,
    name,
    startsAt: '2026-10-30T10:00',
    endsAt: null,
    place: null,
    owner: null,
    status: 'upcoming',
  })),
  participating: { events: [], total: 0 },
  upcoming: { items: [], total: 0 },
  myRequests: { requests: [], total: 0 },
  mine: { tasks: [], counts: { overdue: 0, today: 0, soon: 0, later: 0, noDue: 0 } },
  financeBoard,
}

const room: RoomSummary = {
  id: '01900000-0000-7000-8000-000000000030',
  type: 'all_members',
  name: null,
  departmentId: null,
  readOnly: false,
  unread: 2,
  mentions: 0,
  lastMessageAt: null,
  lastMessage: null,
  memberCount: 3,
}
export const financeRooms: RoomListState = {
  kind: 'ready',
  data: { rooms: [room], unreadTotal: 2, mentionTotal: 0 },
}
