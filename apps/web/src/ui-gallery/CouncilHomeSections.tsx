import type { HomeCouncilBoard, HomeResponse, HomeTask, RoomSummary } from '@vada/contracts'
import CouncilHome from '@/home/CouncilHome'
import { Section } from './GallerySection'
import { noop, pushBand, today, Width } from './home-frame-samples'
import { longName } from './sample-text'

// 회장단 홈(기능 027 조각 6, HOME-01C)을 실제 부품으로 그린다. 폭은 실제 화면의 본문 폭이다(Width).

const room = (id: string, extra: Partial<RoomSummary>): RoomSummary => ({
  id,
  type: 'all_members',
  name: null,
  departmentId: null,
  readOnly: false,
  unread: 1,
  mentions: 0,
  lastMessageAt: '2026-10-26T03:00:00.000Z',
  lastMessage: null,
  memberCount: 3,
  ...extra,
})
const rooms = [
  room('a', { type: 'direct', name: '김민준', unread: 1 }),
  room('b', { unread: 3 }),
  room('c', { type: 'department', name: '기획부', departmentId: 'd1', unread: 2 }),
]

const task = (id: string, title: string, extra: Partial<HomeTask> = {}): HomeTask => ({
  id,
  title,
  status: 'todo',
  next: 'in_progress',
  dueDate: '2026-10-24',
  overdue: false,
  department: { id: 'd1', name: '기획부' },
  event: { id: 'e1', name: '가을 축제' },
  assignee: null,
  actions: [],
  group: 'soon',
  ...extra,
})

const ref = (
  id: string,
  name: string,
  startsAt: string | null,
  status: 'upcoming' | 'ongoing' | 'ended',
) => ({
  id,
  name,
  startsAt,
  endsAt: null,
  status,
})

// 총 행사 5개(진행 중 1, 기획 중 4)라 카드 셋과 '전체 5개 보기'다.
const board: HomeCouncilBoard = {
  events: {
    cards: [
      {
        event: ref('e1', '가을 축제', '2026-10-26T10:00', 'ongoing'),
        tasks: { done: 18, total: 30, overdue: 1, unassigned: 1 },
        next: { kind: 'task', dueDate: '2026-10-28', title: '부스 배치안 확정' },
      },
      {
        event: ref('e2', '진로 특강', '2026-10-30T18:00', 'upcoming'),
        tasks: { done: 7, total: 14, overdue: 0, unassigned: 1 },
        next: { kind: 'task', dueDate: '2026-10-29', title: '홍보 문안 전달' },
      },
      {
        event: ref('e3', longName, '2026-11-08T10:00', 'upcoming'),
        tasks: { done: 2, total: 9, overdue: 0, unassigned: 0 },
        next: { kind: 'start', startsAt: '2026-11-08T10:00' },
      },
    ],
    counts: { planning: 4, ongoing: 1, followUp: 1 },
  },
  followUp: {
    events: [
      {
        event: ref('e4', '신입생 환영회', '2026-10-17T18:00', 'ended'),
        endedDays: 9,
        remaining: { tasks: 1, settlement: 1 },
      },
    ],
    total: 1,
  },
  attention: {
    items: [
      {
        task: task('t1', '체험 부스 구성안', { overdue: true, dueDate: '2026-10-24' }),
        reason: 'overdue',
      },
      {
        task: task('t2', '현장 운영 순서표', {
          event: { id: 'e2', name: '진로 특강' },
          dueDate: '2026-10-29',
        }),
        reason: 'unassigned',
      },
      {
        task: task('t3', '행사 사진 정리', { department: null, event: null, dueDate: null }),
        reason: 'unassigned',
      },
    ],
    total: 4,
  },
  unassignedMembers: 1,
}

const home: HomeResponse = {
  today,
  kind: 'council',
  financeView: false,
  asOf: '2026-10-26T14:05',
  myTasks: { open: 4, overdue: 1, nearest: null },
  featuredEvents: [],
  participating: { events: [], total: 0 },
  upcoming: {
    items: [
      { kind: 'task_due', date: '2026-10-27', time: null, task: task('t4', '부스 배치안 확정') },
      {
        kind: 'registration_close',
        date: '2026-10-29',
        time: '18:00',
        event: { id: 'e2', name: '진로 특강' },
        form: { id: 'f1', name: '신청' },
      },
      {
        kind: 'event_start',
        date: '2026-10-30',
        time: '18:00',
        event: { id: 'e2', name: '진로 특강' },
      },
    ],
    total: 3,
  },
  myRequests: { requests: [], total: 0 },
  mine: { tasks: [], counts: { overdue: 0, today: 0, soon: 0, later: 0, noDue: 0 } },
  councilBoard: board,
}

// 첫 사용: 행사도 확인할 일도 없는 학생회. 행사를 만들 수 있는 회장에게 [새 행사]가 있다.
const emptyBoard: HomeCouncilBoard = {
  events: { cards: [], counts: { planning: 0, ongoing: 0, followUp: 0 } },
  followUp: { events: [], total: 0 },
  attention: { items: [], total: 0 },
  unassignedMembers: 0,
}

function Sample({ empty = false, band = false }: { empty?: boolean; band?: boolean }) {
  const value = empty ? emptyBoard : board
  return (
    <CouncilHome
      home={{
        ...home,
        councilBoard: value,
        upcoming: empty ? { items: [], total: 0 } : home.upcoming,
      }}
      board={value}
      councilId="c1"
      name="김바다"
      inboxRooms={empty ? [] : rooms}
      pushBand={band ? pushBand : undefined}
      onOpenEvent={noop}
      onOpenPage={noop}
      onNewEvent={empty ? noop : undefined}
    />
  )
}

export function CouncilHomeSection() {
  return (
    <Section title="회장단 홈(HOME-01C)">
      <Width label="1280px 창(회장단 홈)" className="w-248 shrink-0">
        <Sample />
      </Width>
      <Width label="1024px 창(회장단 홈)" className="w-184 shrink-0">
        <Sample />
      </Width>
      <Width label="420px 창(회장단 홈, 알림 꺼짐 띠)" className="w-97 shrink-0">
        <Sample band />
      </Width>
      <Width label="1280px 창(첫 사용: 행사 없음, 새 행사)" className="w-248 shrink-0">
        <Sample empty />
      </Width>
    </Section>
  )
}
