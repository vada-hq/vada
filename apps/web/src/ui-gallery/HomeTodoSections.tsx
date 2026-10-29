import type { HomeOpsPerson, HomeTodo, HomeTodoRow, HomeWeek, TaskSummary } from '@vada/contracts'
import AvailableLine from '@/home/AvailableLine'
import TodoCard from '@/home/TodoCard'
import WeekCard from '@/home/WeekCard'
import { Section } from './GallerySection'
import { noop, Width } from './home-frame-samples'

// 회장단 홈 ③ 내가 할 일, ⑤ 이번 주, 사용 가능 한 줄(c35 확정 시안, ⑤·사용 가능은 안 b '아이콘 띠').
// 폭은 시안의 358(1280 창 오른쪽 단·휴대폰 구역)과 716이다.

const TINT = { me: 0, vice: 1, finance: 2 } as const
const VICE: HomeOpsPerson = {
  memberId: 'm-vice',
  name: '이도윤',
  role: { kind: 'council', title: '부회장' },
  tint: TINT.vice,
}
const FINANCE: HomeOpsPerson = {
  memberId: 'm-finance',
  name: '정하늘',
  role: { kind: 'finance_head', department: '재정부', title: '부장' },
  tint: TINT.finance,
}
const task = (id: string, title: string, dueDate: string): TaskSummary => ({
  id,
  title,
  status: 'todo',
  next: 'in_progress',
  dueDate,
  overdue: true,
  department: null,
  event: null,
  assignee: null,
  actions: [],
})

const ROWS: HomeTodoRow[] = [
  {
    kind: 'minutes',
    meeting: { id: 'm1', title: '10월 4주 운영진 회의', endsAt: '2026-10-22T20:00' },
    decisions: 2,
    followUps: 2,
  },
  {
    kind: 'event_tidy',
    event: {
      id: 'e4',
      name: '신입생 환영회',
      startsAt: '2026-10-17T18:00',
      endsAt: null,
      status: 'ended',
    },
    endedDays: 9,
    remaining: { tasks: 0, settlement: 1 },
    settlementContact: FINANCE,
    actions: [],
  },
  {
    kind: 'event_tidy',
    event: {
      id: 'e5',
      name: '중간고사 간식 행사',
      startsAt: '2026-10-21T12:00',
      endsAt: null,
      status: 'ended',
    },
    endedDays: 5,
    remaining: { tasks: 0, settlement: 0 },
    settlementContact: null,
    actions: [],
  },
  {
    kind: 'task_late',
    task: task('t1', '학생회 운영 세칙 개정안 정리', '2026-10-25'),
    days: 1,
    owner: VICE,
  },
  {
    kind: 'task_today',
    task: task('t2', '총학생회 대표자 회의 자료 제출', '2026-10-26'),
    days: 0,
    owner: null,
  },
  {
    kind: 'task_today',
    task: task('t3', '동아리 연합 안내문 검토', '2026-10-26'),
    days: 0,
    owner: VICE,
  },
]
export const mainTodo: HomeTodo = {
  rows: ROWS,
  counts: { minutes: 1, event_tidy: 2, task_late: 1, task_today: 2 },
  total: 6,
  meTint: TINT.me,
}
const normalTodo: HomeTodo = {
  rows: ROWS.filter(row => row.kind === 'event_tidy' && row.remaining.settlement > 0),
  counts: { minutes: 0, event_tidy: 1, task_late: 0, task_today: 0 },
  total: 1,
  meTint: TINT.me,
}
const emptyTodo: HomeTodo = {
  rows: [],
  counts: { minutes: 0, event_tidy: 0, task_late: 0, task_today: 0 },
  total: 0,
  meTint: TINT.me,
}

export const mainWeek: HomeWeek = {
  items: [
    {
      kind: 'schedule',
      item: { id: 's1', title: '총학생회 대표자 회의', type: 'external' },
      date: '2026-10-30',
      time: '18:00',
    },
    {
      kind: 'meeting',
      meeting: {
        id: 'm2',
        title: '11월 1주 운영진 회의',
        heldAt: '2026-11-02T19:00',
        agendaCount: 3,
        actions: ['meeting.edit', 'meeting.minutes'],
      },
    },
    {
      kind: 'schedule',
      item: { id: 's2', title: '2학기 학생회비 집행 내역 제출', type: 'deadline' },
      date: '2026-11-04',
      time: '17:00',
    },
  ],
  total: 4,
}

const WIDTHS = [
  ['358px 칸(오른쪽 단)', 'w-90'],
  ['716px 칸', 'w-179'],
] as const
const AMOUNT = { minus: -120000, plus: 470000 } as const

export function HomeTodoSection() {
  const samples = [
    ['주(6건, 5줄 + 전체 보기)', mainTodo],
    ['평소(정산 남음 1)', normalTodo],
    ['0건', emptyTodo],
  ] as const
  return (
    <Section title="회장단 홈 ③ 내가 할 일(c35)">
      {samples.flatMap(([name, todo]) =>
        WIDTHS.map(([label, width]) => (
          <Width
            key={`${name}-${label}`}
            label={`${name} · ${label}`}
            className={`${width} shrink-0`}
          >
            <TodoCard todo={todo} name="김바다" onOpen={noop} />
          </Width>
        )),
      )}
    </Section>
  )
}

export function HomeWeekSection() {
  return (
    <Section title="회장단 홈 ⑤ 이번 주·사용 가능(c35 안 b)">
      {WIDTHS.map(([label, width]) => (
        <Width
          key={label}
          label={`주 · ${label}`}
          className={`flex ${width} shrink-0 flex-col gap-4`}
        >
          <WeekCard week={mainWeek} onOpen={noop} onAgenda={noop} onSeeCalendar={noop} />
          <AvailableLine amount={AMOUNT.minus} onFinance={noop} />
        </Width>
      ))}
      <Width label="0건 · 358px 칸(사용 가능 양수)" className="flex w-90 shrink-0 flex-col gap-4">
        <WeekCard
          week={{ items: [], total: 0 }}
          onOpen={noop}
          onAgenda={noop}
          onSeeCalendar={noop}
        />
        <AvailableLine amount={AMOUNT.plus} onFinance={noop} />
      </Width>
    </Section>
  )
}
