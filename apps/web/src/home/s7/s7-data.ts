// 회장단 홈 B2 시안(10/29 내용 확정판)의 견본 데이터. 원천은 notes/home-design-rules.md 4절과
// notes/integration/home/president-home-content.md다. 이 모양은 시안 타입이고 홈 응답 계약(HomeResponse)이 아니다.

export type S7Person = { name: string; role: string }

// 이미 물은 줄: 물은 날과 답이 있는지
export type S7Asked = { date: string; answered: boolean; question: string; answer: string | null }

// ① 줄의 원재료. 서버가 고른 것으로 보고, 차례와 글은 s7-view가 만든다.
export type S7AttentionItem =
  | {
      kind: 'task'
      id: string
      title: string
      dueDate: string
      contact: S7Person
      asked: S7Asked | null
    }
  | {
      kind: 'approval'
      id: string
      title: string
      neededBy: string
      contact: S7Person | null
      asked: S7Asked | null
    }
  | { kind: 'no-department'; id: string; title: string }
  | { kind: 'unassigned-members'; count: number }

export type S7Event = {
  id: string
  name: string
  // 다음 일정: 행사의 날짜 가운데 오늘 이후 가장 가까운 하나(없으면 null = 일정 미정)
  next: { name: '신청 시작' | '신청 마감' | '행사 시작' | '행사 종료'; date: string } | null
  // 신청 기간 안에만
  registration: { count: number; capacity: number | null } | null
  undecided: string[]
  lateDepartments: { name: string; overdue: number }[]
  budget: { kind: 'undecided' } | { kind: 'over'; amount: number } | null
}

export type S7Todo =
  | { kind: 'minutes'; id: string; title: string; proposedTasks: number }
  | {
      kind: 'event-report'
      id: string
      eventName: string
      settlementLeft: { department: string; contact: S7Person; asked: S7Asked | null } | null
    }
  | { kind: 'review'; id: string; title: string; department: string; uploadedOn: string }
  | { kind: 'task'; id: string; title: string; dueDate: string; owner: 'me' | S7Person }

export type S7WeekItem =
  | { kind: 'meeting'; id: string; title: string; date: string; time: string; agenda: number }
  | { kind: 'external'; id: string; title: string; date: string; time: string | null; label: '외부' | '제출 마감' }

export type S7Home = {
  today: string
  name: string
  attention: S7AttentionItem[]
  events: { cards: S7Event[]; total: number; canCreate: boolean }
  todos: S7Todo[]
  week: S7WeekItem[]
  // 회계 기간이 없으면 null
  available: number | null
}

const LONG_EVENT = '2026 소프트웨어융합대학 체육대회 및 학과 대항 e스포츠 리그'
const KIM = { name: '김민준', role: '기획부장' }
const FINANCE = { name: '정하늘', role: '재정부장' }

// 4.1 주 견본(문제가 있는 날). ①은 일부러 차례를 섞어 둔다(차례는 s7-view가 정한다).
const main: S7Home = {
  today: '2026-10-29',
  name: '김바다',
  attention: [
    { kind: 'unassigned-members', count: 1 },
    {
      kind: 'approval',
      id: 'r-201',
      title: '진로 특강 다과 구매',
      neededBy: '2026-11-01',
      contact: FINANCE,
      asked: null,
    },
    {
      kind: 'task',
      id: 't-104',
      title: '진로 특강 현장 운영 순서표 만들기',
      dueDate: '2026-10-30',
      contact: KIM,
      asked: null,
    },
    { kind: 'no-department', id: 't-105', title: '학생회실 비품 목록 정리' },
    {
      kind: 'task',
      id: 't-102',
      title: '동아리 지원금 신청서 제출',
      dueDate: '2026-10-27',
      contact: { name: '이서연', role: '담당자' },
      asked: {
        date: '2026-10-28',
        answered: true,
        question: '동아리 지원금 신청서 어디까지 됐어요?',
        answer: '학과 사무실 서명만 남았어요. 내일 오전에 낼게요.',
      },
    },
    {
      kind: 'task',
      id: 't-103',
      title: '부스 전기 사용 신청',
      dueDate: '2026-10-29',
      contact: { name: '박서준', role: '총무부장' },
      asked: { date: '2026-10-29', answered: false, question: '부스 전기 사용 신청 오늘 마감인데 낼 수 있어요?', answer: null },
    },
    {
      kind: 'task',
      id: 't-101',
      title: '체험 부스 구성안 확정',
      dueDate: '2026-10-26',
      contact: KIM,
      asked: null,
    },
  ],
  events: {
    total: 5,
    canCreate: true,
    cards: [
      {
        id: 'ev-1',
        name: '가을 축제',
        next: { name: '행사 종료', date: '2026-10-30' },
        registration: null,
        undecided: [],
        lateDepartments: [{ name: '기획부', overdue: 1 }],
        budget: { kind: 'over', amount: 30000 },
      },
      {
        id: 'ev-2',
        name: '진로 특강',
        next: { name: '신청 마감', date: '2026-10-31' },
        registration: { count: 18, capacity: 40 },
        undecided: ['장소'],
        lateDepartments: [],
        budget: null,
      },
      {
        id: 'ev-3',
        name: LONG_EVENT,
        next: { name: '신청 마감', date: '2026-11-06' },
        registration: { count: 120, capacity: 120 },
        undecided: [],
        lateDepartments: [],
        budget: { kind: 'undecided' },
      },
    ],
  },
  todos: [
    { kind: 'minutes', id: 'm-301', title: '10월 4주 운영진 회의', proposedTasks: 2 },
    {
      kind: 'event-report',
      id: 'ev-5',
      eventName: '신입생 환영회',
      settlementLeft: { department: '재정부', contact: FINANCE, asked: null },
    },
    { kind: 'review', id: 'p-401', title: '진로 특강 포스터', department: '홍보부', uploadedOn: '2026-10-28' },
    { kind: 'task', id: 't-110', title: '총학생회 대표자 회의 자료 제출', dueDate: '2026-10-29', owner: 'me' },
    {
      kind: 'task',
      id: 't-111',
      title: '학생회 운영 세칙 개정안 정리',
      dueDate: '2026-10-28',
      owner: { name: '이도윤', role: '부회장' },
    },
  ],
  week: [
    { kind: 'meeting', id: 'm-302', title: '11월 1주 운영진 회의', date: '2026-11-02', time: '19:00', agenda: 3 },
    { kind: 'external', id: 's-1', title: '총학생회 대표자 회의', date: '2026-10-30', time: '18:00', label: '외부' },
    {
      kind: 'external',
      id: 's-2',
      title: '2학기 학생회비 집행 내역 제출',
      date: '2026-11-04',
      time: '17:00',
      label: '제출 마감',
    },
  ],
  available: -120000,
}

// 4.2 정상인 날
const normal: S7Home = {
  ...main,
  attention: [],
  events: {
    total: 4,
    canCreate: true,
    cards: [
      { ...main.events.cards[0]!, next: { name: '행사 종료', date: '2026-11-01' }, lateDepartments: [], budget: null },
      { ...main.events.cards[1]!, registration: { count: 31, capacity: 40 }, undecided: [] },
      { ...main.events.cards[2]!, registration: { count: 64, capacity: 120 }, budget: null },
    ],
  },
  todos: [{ kind: 'minutes', id: 'm-301', title: '10월 4주 운영진 회의', proposedTasks: 0 }],
  week: [
    main.week[1]!,
    { kind: 'meeting', id: 'm-302', title: '11월 1주 운영진 회의', date: '2026-11-02', time: '19:00', agenda: 1 },
  ],
  available: 920000,
}

// 4.3 첫날 빈 상태
const empty: S7Home = {
  ...main,
  attention: [{ kind: 'unassigned-members', count: 2 }],
  events: { total: 0, canCreate: true, cards: [] },
  todos: [],
  week: [],
  available: null,
}

export const S7_DATA = { main, normal, empty }
export type S7DataName = keyof typeof S7_DATA
export type S7Greeting = 'line' | 'date' | 'merge'
