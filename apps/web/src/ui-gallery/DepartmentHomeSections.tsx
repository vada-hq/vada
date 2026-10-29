import type {
  HomeDepartmentBoard,
  HomeOpsPerson,
  HomeOpsRow,
  HomeResponse,
  TaskSummary,
} from '@vada/contracts'
import DepartmentHome from '@/home/DepartmentHome'
import { Section } from './GallerySection'
import { mainWeek } from './HomeTodoSections'
import { noop, today, Width } from './home-frame-samples'

// 부장 홈(HOME-01D, 10/30 확정): 회장단 홈과 같은 배치·부품에 부장 범위의 데이터. 폭은 실제 화면의 본문 폭이다(Width).

const department = { id: 'd1', name: '기획부' }
const FESTIVAL = { id: 'e1', name: '가을 축제' }
const assignee = (name: string, tint: number): HomeOpsPerson => ({
  memberId: `m-${name}`,
  name,
  role: { kind: 'assignee' },
  tint,
})
// 얼굴 색 번호(서버가 사람마다 정한다)
const TINT = { lee: 0, me: 3, choi: 4 } as const
const LEE = assignee('이서연', TINT.lee)
const CHOI = assignee('최윤아', TINT.choi)
const row = (
  id: string,
  kind: HomeOpsRow['kind'],
  title: string,
  extra: Partial<HomeOpsRow>,
): HomeOpsRow => ({
  kind,
  target: { kind: 'task', id },
  title,
  days: 0,
  event: FESTIVAL,
  contact: LEE,
  noHead: null,
  actions: [],
  ...extra,
})
const task = (id: string, title: string, dueDate: string, overdue: boolean): TaskSummary => ({
  id,
  title,
  status: 'todo',
  next: 'in_progress',
  dueDate,
  overdue,
  department,
  event: FESTIVAL,
  assignee: { id: 'm-me', name: '김민준', current: true },
  actions: [],
})
const DAYS = { late: 2, end: 1 } as const

// 신호 많은 날: 지남 1, 오늘 1, 내일 1, 담당자 없음 2 = 5건
const busy: HomeDepartmentBoard = {
  ops: {
    rows: [
      row('t1', 'late', '체험 부스 구성안 확정', { days: DAYS.late }),
      row('t2', 'today', '부스 전기 사용 신청', { contact: CHOI }),
      row('t3', 'tomorrow', '현장 운영 순서표 만들기', { days: 1, event: null, contact: CHOI }),
    ],
    counts: { late: 1, today: 1, tomorrow: 1, approval: 0 },
    assign: { by: 'head', noAssignee: 2, departments: [department] },
    total: 5,
  },
  todo: {
    rows: [
      {
        kind: 'task_late',
        task: task('t4', '축제 부스 배치도 확정', '2026-10-24', true),
        days: DAYS.late,
        owner: null,
      },
      {
        kind: 'task_today',
        task: task('t5', '스태프 명단 공유', today, false),
        days: 0,
        owner: null,
      },
    ],
    counts: { minutes: 0, event_tidy: 0, task_late: 1, task_today: 1 },
    total: 2,
    meTint: TINT.me,
  },
  week: mainWeek,
  lanes: {
    events: [
      {
        event: {
          ...FESTIVAL,
          startsAt: '2026-10-25T10:00',
          endsAt: '2026-10-27T18:00',
          status: 'ongoing',
          color: 'sky',
        },
        milestone: { kind: 'event_end', date: '2026-10-27', days: DAYS.end },
        registration: null,
        undecided: [],
        late: [{ department, overdue: 1 }],
        budget: null,
      },
    ],
    total: 1,
  },
  budget: { name: '기말고사 간식행사 간식비', amount: 300_000, remaining: 300_000 },
}

// 평소: ① 0건(머리 한 문장), 할 일 없음, 시연 학생회가 아니라 예산 한 줄 없음
const calm: HomeDepartmentBoard = {
  ...busy,
  ops: {
    rows: [],
    counts: { late: 0, today: 0, tomorrow: 0, approval: 0 },
    assign: { by: 'head', noAssignee: 0, departments: [department] },
    total: 0,
  },
  todo: {
    ...busy.todo,
    rows: [],
    counts: { ...busy.todo.counts, task_late: 0, task_today: 0 },
    total: 0,
  },
  budget: null,
}

const home: HomeResponse = {
  today,
  kind: 'department',
  financeView: false,
  asOf: '2026-10-26T14:05',
  myTasks: { open: 2, overdue: 1, nearest: null },
  featuredEvents: [],
  participating: { events: [], total: 0 },
  upcoming: { items: [], total: 0 },
  myRequests: { requests: [], total: 0 },
  mine: { tasks: [], counts: { overdue: 0, today: 0, soon: 0, later: 0, noDue: 0 } },
}

function Sample({ board }: { board: HomeDepartmentBoard }) {
  return (
    <DepartmentHome
      home={{ ...home, departmentBoard: board }}
      board={board}
      councilId="c1"
      name="김민준"
      onOpenEvent={noop}
      onOpenPage={noop}
    />
  )
}

export function DepartmentHomeSection() {
  return (
    <Section title="부장 홈(HOME-01D)">
      <Width label="1280px 창(신호 많은 날, 시연 예산 한 줄)" className="w-248 shrink-0">
        <Sample board={busy} />
      </Width>
      <Width label="420px 창(신호 많은 날)" className="w-97 shrink-0">
        <Sample board={busy} />
      </Width>
      <Width label="1280px 창(평소)" className="w-248 shrink-0">
        <Sample board={calm} />
      </Width>
    </Section>
  )
}
