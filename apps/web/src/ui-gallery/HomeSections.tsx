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
} from '@vada/contracts'
import CouncilSection from '@/home/CouncilSection'
import DepartmentsSection from '@/home/DepartmentsSection'
import MineSection from '@/home/MineSection'
import ReceivedSection from '@/home/ReceivedSection'
import SettlingSection from '@/home/SettlingSection'
import { Section } from './GallerySection'
import { longName, unbroken } from './sample-text'

const task = (id: string, group: HomeTaskGroup, extra: Partial<HomeTask> = {}): HomeTask => ({
  id,
  title: '신입생 환영회 장소 예약',
  status: 'todo',
  dueDate: '2026-10-25',
  overdue: group === 'overdue',
  department: null,
  event: null,
  assignee: { id: 'p1', name: '김새내', current: true },
  actions: ['task.status'],
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
}
const request: PurchaseRequestSummary = {
  id: 'r1',
  title: `${unbroken} 구매 요청`,
  status: 'pending',
  requestedBy: { id: 'p2', name: '박부원' },
  neededBy: null,
  itemCount: 2,
  createdAt: '2026-10-20T03:00:00.000Z',
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
        <CouncilSection
          council={council}
          onOpenTask={noop}
          onOpenEvent={noop}
          onSeeTasks={noop}
          onSeeEvents={noop}
        />
        <CouncilSection
          council={{ ...council, events: [], endedTotal: 0, blocked: [], overdue: noTasks }}
          onOpenTask={noop}
          onOpenEvent={noop}
          onSeeTasks={noop}
          onSeeEvents={noop}
        />
        <DepartmentsSection departments={[department]} onOpenTask={noop} onSeeAll={noop} />
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
    <Section title="홈 · 내 업무">
      <div className="flex w-80 flex-col gap-3">
        <MineSection mine={full} onOpenTask={noop} onSeeAll={noop} />
        <MineSection mine={empty} onOpenTask={noop} onSeeAll={noop} />
      </div>
    </Section>
  )
}
