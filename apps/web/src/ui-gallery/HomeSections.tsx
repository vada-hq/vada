import type {
  EventStatus,
  EventSummary,
  HomeCouncil,
  HomeDepartment,
  HomeList,
  HomeMine,
  HomeTask,
  HomeTaskGroup,
  PurchaseRequestSummary,
  RoomSummary,
} from '@vada/contracts'
import AttentionTiles from '@/home/AttentionTiles'
import { CouncilBlocked, CouncilEvents } from '@/home/CouncilSection'
import DepartmentsSection from '@/home/DepartmentsSection'
import MessageInbox from '@/home/MessageInbox'
import MineSection from '@/home/MineSection'
import ReceivedSection from '@/home/ReceivedSection'
import RequestsSection from '@/home/RequestsSection'
import SettlingSection from '@/home/SettlingSection'
import { Section } from './GallerySection'
import { longName, unbroken } from './sample-text'

// 묶음과 마감일이 맞아야 'N일 지남'이 실제처럼 보인다. 기준일은 아래 today다.
const DUE: Record<HomeTaskGroup, string> = {
  overdue: '2026-10-21',
  today: '2026-10-23',
  soon: '2026-10-25',
}

const task = (id: string, group: HomeTaskGroup, extra: Partial<HomeTask> = {}): HomeTask => ({
  id,
  title: '신입생 환영회 장소 예약',
  status: 'todo',
  next: 'in_progress',
  dueDate: DUE[group],
  overdue: group === 'overdue',
  department: null,
  event: null,
  assignee: { id: 'p1', name: '김새내', current: true },
  actions: ['task.change_status'],
  group,
  ...extra,
})

const full: HomeMine = {
  tasks: [
    task('a', 'overdue'),
    task('b', 'today', { event: { id: 'e1', name: '신입생 환영회' } }),
    task('c', 'soon', { title: `${unbroken} ${longName}` }),
  ],
  counts: { overdue: 12, today: 1, soon: 1, later: 4, noDue: 2 },
}
const empty: HomeMine = {
  tasks: [],
  counts: { overdue: 0, today: 0, soon: 0, later: 0, noDue: 0 },
}

const noop = () => {}
const today = '2026-10-23'
const none = new Set<string>()
const noTasks: HomeList = { tasks: [], total: 0 }

const lateTask = task('late', 'overdue', { title: `${unbroken} ${longName}` })
const event = (id: string, status: EventStatus): EventSummary => ({
  id,
  name: id === 'e1' ? longName : '신입생 환영회',
  startsAt: '2026-10-20T10:00',
  endsAt: '2026-10-20T12:00',
  place: null,
  owner: { id: 'p1', name: '김회장', current: true },
  status,
})
const department: HomeDepartment = {
  id: 'd1',
  name: '기획부',
  counts: { todo: 3, inProgress: 2, overdue: 1, unassigned: 1 },
  overdue: { tasks: [lateTask], total: 1 },
  unassigned: { tasks: [task('free', 'soon', { assignee: null })], total: 1 },
}
const council: HomeCouncil = {
  events: [
    {
      event: event('e1', 'ended'),
      tasks: { done: 1, total: 4, overdue: 2, unassigned: 1 },
      settlement: { remaining: 3, settled: false },
    },
    {
      event: event('e2', 'ended'),
      tasks: { done: 2, total: 2, overdue: 0, unassigned: 0 },
      settlement: { remaining: 0, settled: true },
    },
    { event: event('e3', 'upcoming'), tasks: { done: 0, total: 5, overdue: 0, unassigned: 2 } },
  ],
  truncated: false,
  endedTotal: 14,
  blocked: [
    { department: { id: 'd1', name: '기획부' }, overdue: 2, unassigned: 0 },
    { department: null, overdue: 0, unassigned: 3 },
  ],
  overdue: { tasks: [lateTask], total: 11 },
  unassignedMembers: 2,
}
const request: PurchaseRequestSummary = {
  id: 'r1',
  title: `${unbroken} 구매 요청`,
  status: 'pending',
  requestedBy: { id: 'p2', name: '박부원' },
  neededBy: null,
  itemCount: 2,
  createdAt: '2026-10-20T03:00:00.000Z',
  payable: false,
  event: null,
}

export function HomeOtherSection() {
  return (
    <Section title="홈 · 부서, 학생회, 받은 것, 정산할 행사">
      <div className="flex w-80 flex-col gap-3">
        <ReceivedSection
          received={{ requests: [request], total: 12, truncated: false }}
          onOpenRequest={noop}
          onSeeAll={noop}
        />
        <ReceivedSection
          received={{ requests: [], total: 0, truncated: false }}
          onOpenRequest={noop}
          onSeeAll={noop}
        />
        <CouncilEvents council={council} today={today} onOpenEvent={noop} onSeeEvents={noop} />
        <CouncilBlocked
          council={council}
          today={today}
          mineIds={none}
          onOpenTask={noop}
          onSeeTasks={noop}
        />
        <CouncilEvents
          council={{ ...council, events: [], endedTotal: 0, blocked: [], overdue: noTasks }}
          today={today}
          onOpenEvent={noop}
          onSeeEvents={noop}
        />
        <DepartmentsSection
          departments={[department]}
          today={today}
          mineIds={none}
          onOpenTask={noop}
          onSeeAll={noop}
        />
        <SettlingSection
          settling={{
            events: [{ event: event('e1', 'ended'), settlement: { remaining: 2, settled: false } }],
            total: 12,
          }}
          onOpenEvent={noop}
          onSeeAll={noop}
        />
        <SettlingSection settling={{ events: [], total: 0 }} onOpenEvent={noop} onSeeAll={noop} />
      </div>
    </Section>
  )
}

export function HomeSection() {
  return (
    <Section title="홈 · 숫자 카드, 내 업무, 내 요청">
      <div className="flex w-80 flex-col gap-3">
        <AttentionTiles
          items={[
            { key: 'a', label: '지난 내 업무', count: 2, tone: 'danger', target: 'x' },
            { key: 'b', label: '오늘 마감', count: 0, tone: 'info', target: 'x' },
          ]}
        />
        <MineSection mine={full} today={today} onOpenTask={noop} onSeeAll={noop} />
        <MineSection mine={empty} today={today} onOpenTask={noop} onSeeAll={noop} />
        <RequestsSection
          requests={[request, { ...request, id: 'r2', status: 'rejected' }]}
          onOpenRequest={noop}
          onSeeAll={noop}
        />
      </div>
    </Section>
  )
}

const chatRoom = (id: string, extra: Partial<RoomSummary>): RoomSummary => ({
  id,
  type: 'all_members',
  name: null,
  departmentId: null,
  readOnly: false,
  unread: 1,
  mentions: 0,
  lastMessageAt: '2026-10-23T03:00:00.000Z',
  lastMessage: null,
  memberCount: 3,
  ...extra,
})

// 메시지함은 홈의 두 단 위 전체 폭이라 고정 폭 없이 그린다. 둘째 줄은 긴 이름이 접히는지 본다.
export function HomeInboxSection() {
  return (
    <Section title="홈 · 메시지함">
      <div className="flex w-full flex-col gap-3">
        <MessageInbox
          rooms={[
            chatRoom('a', { type: 'direct', name: '김민준', unread: 2 }),
            chatRoom('b', { type: 'department', name: '기획부', departmentId: 'd1', unread: 120 }),
            chatRoom('c', { unread: 5 }),
          ]}
          onOpenRoom={noop}
          onSeeAll={noop}
        />
        <MessageInbox
          rooms={[chatRoom('d', { type: 'department', name: unbroken, departmentId: 'd2' })]}
          onOpenRoom={noop}
          onSeeAll={noop}
        />
      </div>
    </Section>
  )
}
