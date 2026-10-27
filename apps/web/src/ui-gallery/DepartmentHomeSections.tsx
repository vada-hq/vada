import type { HomeDepartmentBoard, HomeResponse, TaskSummary } from '@vada/contracts'
import DepartmentHome from '@/home/DepartmentHome'
import { Section } from './GallerySection'
import { noop, Width } from './home-frame-samples'

const department = { id: '01900000-0000-7000-8000-000000000011', name: '기획부' }
const person = { id: '01900000-0000-7000-8000-000000000012', name: '정하늘' }
const task: TaskSummary = {
  id: '01900000-0000-7000-8000-000000000013',
  title: '새내기 배움터 프로그램 확정',
  department,
  event: { id: '01900000-0000-7000-8000-000000000014', name: '새내기 배움터' },
  dueDate: '2026-10-25',
  assignee: { ...person, current: true },
  overdue: true,
  status: 'todo',
  next: 'in_progress',
  actions: [],
}
const board: HomeDepartmentBoard = {
  departments: [department],
  purchases: {
    requests: [
      {
        id: '01900000-0000-7000-8000-000000000015',
        title: '프로그램 진행 물품',
        status: 'rejected',
        requestedBy: person,
        neededBy: '2026-10-29',
        itemCount: 2,
        createdAt: '2026-10-25T03:00:00Z',
        payable: false,
        event: task.event,
      },
    ],
    total: 1,
  },
  ownedEnded: [
    {
      event: { ...task.event!, startsAt: '2026-10-20T10:00', endsAt: null, status: 'ended' },
      endedDays: 6,
      remaining: { tasks: 1, settlement: 2 },
    },
  ],
  attention: {
    items: [
      { task, reason: 'overdue' },
      {
        task: {
          ...task,
          id: '01900000-0000-7000-8000-000000000016',
          title: '현장 스태프 배정',
          assignee: null,
        },
        reason: 'unassigned',
      },
    ],
    total: 2,
  },
  congestion: {
    member: person,
    departmentIds: [department.id],
    count: 3,
    firstDue: '2026-10-27',
    lastDue: '2026-10-30',
  },
}
const home: HomeResponse = {
  today: '2026-10-26',
  kind: 'department',
  financeView: false,
  asOf: '2026-10-26T14:05',
  myTasks: { open: 3, overdue: 1, nearest: task },
  featuredEvents: [],
  participating: { events: [], total: 0 },
  upcoming: {
    items: [
      { kind: 'task_due', date: '2026-10-27', time: null, task: { ...task, overdue: false } },
    ],
    total: 1,
  },
  myRequests: { requests: [], total: 0 },
  mine: { tasks: [], counts: { overdue: 0, today: 0, soon: 0, later: 0, noDue: 0 } },
}
const widths = [
  ['1280', 'w-248'],
  ['420', 'w-97'],
] as const

export function DepartmentHomeSection() {
  return (
    <Section title="부서장 홈(HOME-01D) · 부서 하나와 둘">
      {widths.flatMap(([width, className]) =>
        [false, true].map(multiple => (
          <Width
            key={`${width}-${multiple}`}
            label={`${width}px 창 · ${multiple ? '부서 둘' : '부서 하나'}`}
            className={className}
          >
            <DepartmentHome
              home={home}
              board={{
                ...board,
                departments: multiple
                  ? [department, { id: '01900000-0000-7000-8000-000000000017', name: '소통부' }]
                  : board.departments,
              }}
              councilId="01900000-0000-7000-8000-000000000001"
              memberId="01900000-0000-7000-8000-000000000002"
              name="김바다"
              rooms={{ kind: 'ready', data: { rooms: [], unreadTotal: 0, mentionTotal: 0 } }}
              onOpenEvent={noop}
              onOpenPage={noop}
              onNewEvent={noop}
            />
          </Width>
        )),
      )}
    </Section>
  )
}
