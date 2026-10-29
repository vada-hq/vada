// S5 흑백 시안의 견본 데이터(notes/home-design-rules.md 4절). 칸 이름은 HomeResponse(packages/contracts/src/home.ts) 기준이고,
// '†'가 붙은 칸은 지금 응답에 없어 시안에서만 쓴다(규칙 2.2, X18).

export type S5Task = {
  id: string
  title: string
  dueDate: string | null
  department: { id: string; name: string } | null
  assignee: { id: string; name: string } | null
  event: { id: string; name: string } | null
}

export type S5BoardEvent = {
  event: {
    id: string
    name: string
    startsAt: string | null
    endsAt: string | null
    status: 'tbd' | 'upcoming' | 'ongoing'
  }
  tasks: { done: number; total: number; overdue: number; unassigned: number }
  next: { kind: 'task'; dueDate: string; title: string } | { kind: 'start'; startsAt: string } | null
}

export type S5SettlementKind =
  | 'no_evidence'
  | 'unreimbursed'
  | 'no_reason'
  | 'refund_pending'
  | 'unpaid_items'
  | 'pending_items'

export type S5FollowUp = {
  event: { id: string; name: string; endsAt: string }
  endedDays: number
  remaining: {
    tasks: number
    settlement: number
    // †
    settlementKinds: { kind: S5SettlementKind; count: number }[]
  }
}

export type S5Upcoming =
  | { kind: 'event_start'; date: string; time: string; event: { id: string; name: string } }
  | {
      kind: 'registration_close'
      date: string
      time: string
      event: { id: string; name: string }
      form: { id: string; name: string }
    }
  | { kind: 'task_due'; date: string; time: null; task: S5Task }
  | {
      kind: 'schedule_item'
      date: string
      time: string | null
      item: { id: string; title: string; type: 'deadline' | 'academic' | 'external' | 'other' }
    }

export type S5Home = {
  today: string
  name: string
  // 인사 띠 메시지함(DEC-90 차례)
  rooms: { id: string; name: string; unread: number }[]
  myTasks: { open: number; overdue: number; nearest: { id: string; dueDate: string } | null }
  upcoming: { items: S5Upcoming[]; total: number }
  financeSummary: {
    overview: { available: number } | null
    missing: { id: string; name: string }[]
    // †
    noEvidenceOutsideEvents: number
  }
  board: {
    financeStaffed: boolean
    canCreateEvent: boolean
    events: {
      cards: S5BoardEvent[]
      counts: { planning: number; ongoing: number; followUp: number }
    }
    followUp: { events: S5FollowUp[]; total: number }
    attention: { items: { task: S5Task; reason: 'overdue' | 'unassigned' }[]; total: number }
    // †
    stalePending: {
      total: number
      requests: { id: string; title: string; createdAt: string; event: { id: string; name: string } | null }[]
    }
    // †
    financeDepartment: { id: string; name: string } | null
    // †
    draftMinutes: {
      total: number
      meetings: {
        id: string
        title: string
        heldAt: string
        event: { id: string; name: string } | null
        hostDepartment: { id: string; name: string } | null
      }[]
    }
    unassignedMembers: number
  }
}

const LONG_EVENT = '2026 소프트웨어융합대학 체육대회 및 학과 대항 e스포츠 리그'
const dept = (id: string, name: string) => ({ id, name })
const PLAN = dept('d-plan', '기획부')

const task = (id: string, title: string, extra: Partial<S5Task>): S5Task => ({
  id,
  title,
  dueDate: null,
  department: null,
  assignee: null,
  event: null,
  ...extra,
})

const eventCards = (risky: boolean): S5BoardEvent[] => [
  {
    event: {
      id: 'ev-1',
      name: '가을 축제',
      startsAt: '2026-10-28T10:00',
      endsAt: '2026-10-30T18:00',
      status: 'ongoing',
    },
    tasks: risky
      ? { done: 18, total: 30, overdue: 1, unassigned: 0 }
      : { done: 24, total: 30, overdue: 0, unassigned: 0 },
    next: { kind: 'task', dueDate: '2026-10-30', title: '부스 철거 인원 배치' },
  },
  {
    event: {
      id: 'ev-2',
      name: '진로 특강',
      startsAt: '2026-11-02T18:00',
      endsAt: '2026-11-02T20:00',
      status: 'upcoming',
    },
    tasks: risky
      ? { done: 7, total: 14, overdue: 0, unassigned: 1 }
      : { done: 12, total: 14, overdue: 0, unassigned: 0 },
    next: { kind: 'task', dueDate: '2026-10-30', title: '연사 발표 자료 받기' },
  },
  {
    event: {
      id: 'ev-3',
      name: LONG_EVENT,
      startsAt: '2026-11-11T09:00',
      endsAt: '2026-11-11T18:00',
      status: 'upcoming',
    },
    tasks: risky
      ? { done: 2, total: 9, overdue: 0, unassigned: 0 }
      : { done: 4, total: 9, overdue: 0, unassigned: 0 },
    next: { kind: 'task', dueDate: '2026-11-06', title: '종목별 심판 섭외' },
  },
]

const noMinutes = { total: 0, meetings: [] }
const noStale = { total: 0, requests: [] }
const FINANCE = dept('d-fin', '재정부')

// 4.1 주 견본(문제가 있는 날)
const main: S5Home = {
  today: '2026-10-29',
  name: '김바다',
  rooms: [
    { id: 'room-a', name: '김민준 · 1:1', unread: 1 },
    { id: 'room-b', name: '공지방', unread: 3 },
    { id: 'room-c', name: '기획부', unread: 2 },
  ],
  myTasks: { open: 3, overdue: 0, nearest: { id: 't-110', dueDate: '2026-11-02' } },
  upcoming: {
    items: [
      {
        kind: 'registration_close',
        date: '2026-10-31',
        time: '23:59',
        event: { id: 'ev-2', name: '진로 특강' },
        form: { id: 'f-1', name: '진로 특강 참가 신청' },
      },
      { kind: 'event_start', date: '2026-11-02', time: '18:00', event: { id: 'ev-2', name: '진로 특강' } },
      {
        kind: 'schedule_item',
        date: '2026-11-03',
        time: null,
        item: { id: 's-1', title: '중간고사 기간 시작', type: 'academic' },
      },
      {
        kind: 'task_due',
        date: '2026-11-04',
        time: null,
        task: task('t-120', '11월 학생회비 안내문 올리기', {
          dueDate: '2026-11-04',
          department: FINANCE,
          assignee: { id: 'm-9', name: '박지호' },
        }),
      },
    ],
    total: 4,
  },
  financeSummary: {
    overview: { available: 920000 },
    missing: [{ id: 'ev-3', name: LONG_EVENT }],
    noEvidenceOutsideEvents: 1,
  },
  board: {
    financeStaffed: true,
    canCreateEvent: true,
    events: { cards: eventCards(true), counts: { planning: 3, ongoing: 1, followUp: 1 } },
    followUp: {
      events: [
        {
          event: { id: 'ev-5', name: '신입생 환영회', endsAt: '2026-10-20T21:00' },
          endedDays: 9,
          remaining: {
            tasks: 1,
            settlement: 2,
            settlementKinds: [
              { kind: 'no_evidence', count: 1 },
              { kind: 'unreimbursed', count: 1 },
            ],
          },
        },
      ],
      total: 1,
    },
    attention: {
      items: [
        {
          reason: 'overdue',
          task: task('t-101', '체험 부스 구성안 확정', {
            dueDate: '2026-10-26',
            department: PLAN,
            assignee: { id: 'm-1', name: '김민준' },
            event: { id: 'ev-1', name: '가을 축제' },
          }),
        },
        {
          reason: 'overdue',
          task: task('t-102', '동아리 지원금 신청서 제출', {
            dueDate: '2026-10-27',
            department: dept('d-ext', '대외협력부'),
            assignee: { id: 'm-2', name: '이서연' },
          }),
        },
        {
          reason: 'unassigned',
          task: task('t-103', '현장 운영 순서표 만들기', {
            dueDate: '2026-10-31',
            department: PLAN,
            event: { id: 'ev-2', name: '진로 특강' },
          }),
        },
        {
          reason: 'unassigned',
          task: task('t-104', '겨울 MT 숙소 후보 알아보기', {
            dueDate: '2026-11-09',
            department: dept('d-gen', '총무부'),
            event: { id: 'ev-4', name: '겨울 MT' },
          }),
        },
      ],
      total: 4,
    },
    stalePending: {
      total: 1,
      requests: [
        {
          id: 'r-201',
          title: '가을 축제 부스 현수막 인쇄',
          createdAt: '2026-10-23T14:10:00+09:00',
          event: { id: 'ev-1', name: '가을 축제' },
        },
      ],
    },
    financeDepartment: FINANCE,
    draftMinutes: {
      total: 1,
      meetings: [
        { id: 'm-301', title: '10월 4주 운영진 회의', heldAt: '2026-10-27T19:00', event: null, hostDepartment: null },
      ],
    },
    unassignedMembers: 1,
  },
}

// 4.2 모두 정상(평소엔 조용)
const normal: S5Home = {
  ...main,
  rooms: [],
  myTasks: { open: 2, overdue: 0, nearest: { id: 't-111', dueDate: '2026-11-03' } },
  upcoming: {
    items: [main.upcoming.items[1]!, main.upcoming.items[2]!],
    total: 2,
  },
  financeSummary: { overview: { available: 920000 }, missing: [], noEvidenceOutsideEvents: 0 },
  board: {
    ...main.board,
    events: { cards: eventCards(false), counts: { planning: 2, ongoing: 1, followUp: 1 } },
    followUp: {
      events: [
        {
          event: { id: 'ev-6', name: '중간고사 간식 나눔', endsAt: '2026-10-26T18:00' },
          endedDays: 3,
          remaining: { tasks: 0, settlement: 0, settlementKinds: [] },
        },
      ],
      total: 1,
    },
    attention: { items: [], total: 0 },
    stalePending: noStale,
    draftMinutes: noMinutes,
    unassignedMembers: 0,
  },
}

// 4.3 첫날 빈 상태
const empty: S5Home = {
  ...main,
  rooms: [{ id: 'room-b', name: '공지방', unread: 1 }],
  myTasks: { open: 0, overdue: 0, nearest: null },
  upcoming: { items: [], total: 0 },
  financeSummary: { overview: null, missing: [], noEvidenceOutsideEvents: 0 },
  board: {
    ...main.board,
    events: { cards: [], counts: { planning: 0, ongoing: 0, followUp: 0 } },
    followUp: { events: [], total: 0 },
    attention: { items: [], total: 0 },
    stalePending: noStale,
    draftMinutes: noMinutes,
    unassignedMembers: 2,
  },
}

export const S5_DATA = { main, normal, empty }
export type S5DataName = keyof typeof S5_DATA
