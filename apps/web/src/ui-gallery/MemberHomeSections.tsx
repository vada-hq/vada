import type {
  EventSummary,
  HomeParticipation,
  HomeResponse,
  HomeTask,
  PurchaseRequestSummary,
  RoomSummary,
} from '@vada/contracts'
import type { RoomListState } from '@/chat/useRoomList'
import MemberHome from '@/home/MemberHome'
import { Section } from './GallerySection'
import { noop, pushBand, today, Width } from './home-frame-samples'
import { longName } from './sample-text'

// 부원 홈(기능 027 조각 7, HOME-01M)을 실제 부품으로 그린다. 폭은 실제 화면의 본문 폭이다(Width).

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
const roomsOf = (rooms: RoomSummary[]): RoomListState => ({
  kind: 'ready',
  data: { rooms, unreadTotal: rooms.length, mentionTotal: 0 },
})

const event = (
  id: string,
  name: string,
  startsAt: string | null,
  status: EventSummary['status'],
): EventSummary => ({
  id,
  name,
  startsAt,
  endsAt: null,
  place: null,
  owner: { id: 'p1', name: '김회장', current: true },
  status,
})
const featured = [
  event('e1', '가을 축제', '2026-10-26T10:00', 'ongoing'),
  event('e2', '진로 특강', '2026-10-30T18:00', 'upcoming'),
  event('e3', longName, '2026-11-08T10:00', 'upcoming'),
]

const task = (id: string, title: string, extra: Partial<HomeTask> = {}): HomeTask => ({
  id,
  title,
  status: 'todo',
  next: 'in_progress',
  dueDate: '2026-10-28',
  overdue: false,
  department: { id: 'd1', name: '운영부' },
  event: { id: 'e1', name: '가을 축제' },
  assignee: null,
  actions: [],
  group: 'soon',
  ...extra,
})

const joined = (
  source: EventSummary,
  tasks: HomeParticipation['tasks'],
  next: HomeParticipation['next'],
): HomeParticipation => ({ event: source, tasks, next })

const request = (
  id: string,
  title: string,
  status: PurchaseRequestSummary['status'],
): PurchaseRequestSummary => ({
  id,
  title,
  status,
  requestedBy: { id: 'p2', name: '정하늘' },
  neededBy: null,
  itemCount: 1,
  createdAt: '2026-10-20T03:00:00.000Z',
  payable: false,
  event: { id: 'e1', name: '가을 축제' },
})

const home: HomeResponse = {
  today,
  kind: 'member',
  financeView: false,
  asOf: '2026-10-26T14:05',
  myTasks: {
    open: 3,
    overdue: 1,
    nearest: task('t1', '부스 배치안 확정', { dueDate: '2026-10-24', overdue: true }),
  },
  featuredEvents: featured,
  participating: {
    events: [
      joined(
        featured[0]!,
        { done: 8, total: 12 },
        {
          taskId: 't2',
          title: '부스 배치안 확정',
          dueDate: '2026-10-28',
        },
      ),
      joined(
        featured[1]!,
        { done: 3, total: 6 },
        { taskId: 't3', title: '홍보 문안 전달', dueDate: '2026-10-29' },
      ),
      joined(featured[2]!, { done: 0, total: 4 }, null),
    ],
    total: 4,
  },
  upcoming: {
    items: [
      {
        kind: 'schedule_item',
        date: '2026-10-28',
        time: null,
        item: {
          id: '019e0000-0000-7000-8000-000000000002',
          title: '중간고사 기간',
          type: 'academic',
        },
      },
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
    total: 5,
  },
  myRequests: {
    requests: [
      request('r1', '현수막 인쇄', 'rejected'),
      request('r2', '체험 부스 재료', 'partial'),
      request('r3', '간식', 'pending'),
    ],
    total: 3,
  },
  mine: { tasks: [], counts: { overdue: 0, today: 0, soon: 0, later: 0, noDue: 0 } },
}

// 첫날 막 들어온 운영진: 직급도 부서도 없어 참여 행사가 비고, 가까운 일정은 학생회 행사로 채운다(DEC-95).
const firstDay: HomeResponse = {
  ...home,
  myTasks: { open: 0, overdue: 0, nearest: null },
  featuredEvents: [featured[0]!, featured[1]!],
  participating: { events: [], total: 0 },
  upcoming: { items: home.upcoming.items.slice(1), total: 2 },
  myRequests: { requests: [], total: 0 },
}

function Sample({ newcomer = false, band = false }: { newcomer?: boolean; band?: boolean }) {
  return (
    <MemberHome
      home={newcomer ? firstDay : home}
      councilId="019e0000-0000-7000-8000-000000000001"
      name="정하늘"
      rooms={roomsOf(
        newcomer
          ? [room('notice', { unread: 2 })]
          : [
              room('a', { type: 'direct', name: '김민준', unread: 1 }),
              room('b', { unread: 3 }),
              room('c', { type: 'department', name: '운영부', departmentId: 'd1', unread: 2 }),
            ],
      )}
      awaitingDepartment={newcomer}
      pushBand={band ? pushBand : undefined}
      onOpenEvent={noop}
      onOpenPage={noop}
    />
  )
}

export function MemberHomeSection() {
  return (
    <Section title="부원 홈(HOME-01M)">
      <Width label="1280px 창(부원 홈)" className="w-248 shrink-0">
        <Sample />
      </Width>
      <Width label="1024px 창(부원 홈)" className="w-184 shrink-0">
        <Sample />
      </Width>
      <Width label="420px 창(부원 홈)" className="w-97 shrink-0">
        <Sample />
      </Width>
      <Width
        label="1280px 창(막 들어온 운영진: 부서 배정 전, 참여 행사 없음)"
        className="w-248 shrink-0"
      >
        <Sample newcomer />
      </Width>
      <Width label="1024px 창(막 들어온 운영진)" className="w-184 shrink-0">
        <Sample newcomer />
      </Width>
      <Width label="420px 창(막 들어온 운영진, 알림 꺼짐 띠)" className="w-97 shrink-0">
        <Sample newcomer band />
      </Width>
    </Section>
  )
}
