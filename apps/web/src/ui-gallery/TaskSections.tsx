import type { TaskSummary } from '@vada/contracts'
import { Badge } from '@/components/ui/badge'
import { countOf } from '@/tasks/task-view'
import { cardClass } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { departmentColorOf } from '@/tasks/department-color'
import { TaskBoard } from '@/tasks/TaskBoard'
import { TaskCard } from '@/tasks/TaskCard'
import { TaskResults } from '@/tasks/TaskResults'
import { QuickAddView } from '@/tasks/TaskQuickAdd'
import { TaskRow } from '@/tasks/TaskRow'
import { TaskTable } from '@/tasks/TaskTable'
import { TaskUndoBar } from '@/tasks/TaskUndoBar'
import { groupByDepartment } from '@/tasks/task-groups'
import { Section } from './GallerySection'
import { longName, unbroken } from './sample-text'

const task = (id: string, extra: Partial<TaskSummary>): TaskSummary => ({
  id,
  title: '신입생 환영회 장소 예약',
  status: 'todo',
  next: 'in_progress',
  dueDate: '2026-10-25',
  overdue: false,
  department: { id: 'd1', name: '기획부' },
  event: null,
  assignee: { id: 'p1', name: '김새내', current: true },
  actions: ['task.change_status'],
  ...extra,
})

const noop = () => {}
const rowProps = {
  show: { assignee: true, department: true, event: true },
  busy: false,
  onChangeStatus: noop,
  onOpen: noop,
  onOpenEvent: noop,
}

export function TaskSection() {
  const overdue = countOf([task('a', { overdue: true })], false)
  const open = countOf([task('b', {}), task('c', {})], true)
  return (
    <Section title="업무 줄·수 배지">
      <div className="flex w-full items-center gap-2">
        {overdue && <Badge tone={overdue.tone}>{overdue.label}</Badge>}
        {open && <Badge tone={open.tone}>{open.label}</Badge>}
      </div>
      <ul className={cn(cardClass, 'w-96 divide-y')}>
        <TaskRow task={task('1', {})} {...rowProps} />
        <TaskRow
          task={task('2', { status: 'in_progress', next: 'done', overdue: true })}
          {...rowProps}
          busy
        />
        <TaskRow
          task={task('3', {
            status: 'done',
            next: null,
            actions: [],
            assignee: null,
            dueDate: null,
          })}
          {...rowProps}
        />
        <TaskRow task={task('5', { event: { id: 'e1', name: '신입생 환영회' } })} {...rowProps} />
        <TaskRow
          task={task('4', {
            title: `${unbroken} ${longName}`,
            assignee: { id: 'p2', name: longName, current: false },
          })}
          {...rowProps}
          error="상태를 바꾸지 못했어요. 다시 시도해 주세요."
        />
      </ul>
    </Section>
  )
}

const tableCells = {
  busy: new Set(['3|status']),
  errors: { '4': '너무 빨리 보내고 있어요. 잠시 뒤에 다시 시도해 주세요.' },
  patches: {},
  save: () => Promise.resolve(true),
  fail: noop,
  clearPatches: noop,
}
const tableLookups = {
  team: {
    members: [
      {
        id: 'p1',
        name: '김새내',
        councilRank: null,
        departments: [],
        joinedAt: '2026-10-01T01:00:00.000Z',
      },
    ],
    departments: [{ id: 'd1', name: '기획부', role: null, memberCount: 1 }],
  },
  events: [],
  linkable: [],
}

// 넓은 화면(lg 이상)의 업무 표. 고르는 칸, 글자 칸(aria-readonly), 보내는 중, 칸 오류, 긴 글.
export function TaskTableSection() {
  const tasks = [
    task('1', {
      actions: [
        'task.change_status',
        'task.change_assignee',
        'task.change_department',
        'task.edit',
      ],
    }),
    task('2', { status: 'in_progress', next: 'done', overdue: true, assignee: null }),
    task('3', { actions: ['task.change_status'], event: { id: 'e1', name: '신입생 환영회' } }),
    task('4', {
      title: `${unbroken} ${longName}`,
      assignee: { id: 'p2', name: longName, current: false },
      department: null,
    }),
  ]
  return (
    <Section title="업무 표">
      <div className="w-full max-w-5xl">
        <TaskTable
          sections={groupByDepartment(tasks)}
          summary
          inEvent={false}
          lookups={tableLookups}
          cells={tableCells}
          onOpenTask={noop}
          onOpenEvent={noop}
        />
      </div>
    </Section>
  )
}

// 담당자를 바꾼 뒤 화면 아래에 남는 띠: 보통, 되돌리는 중, 되돌리기 실패, 긴 이름.
export function TaskUndoBarSection() {
  const change = {
    taskId: '1',
    previousId: 'p1',
    assignee: { id: 'p2', name: '박새내', current: true },
  }
  const bars = [
    { ...change, busy: false, error: null },
    { ...change, busy: true, error: null },
    {
      ...change,
      busy: false,
      error: '이전 담당자가 지금은 운영진이 아니에요. 다른 사람을 골라 주세요.',
    },
    { ...change, assignee: { id: 'p3', name: longName, current: true }, busy: false, error: null },
    { ...change, assignee: null, busy: false, error: null },
  ]
  return (
    <Section title="담당자 되돌리기 띠">
      <div className="flex w-full max-w-xl flex-col gap-3">
        {bars.map((bar, index) => (
          <TaskUndoBar key={index} bar={bar} dismiss={noop} undo={noop} />
        ))}
      </div>
    </Section>
  )
}

export function TaskResultsSection() {
  return (
    <Section title="업무 상세 결과물">
      <div className="flex w-96 flex-col gap-6">
        <TaskResults
          task={{
            results: [
              { kind: 'request', id: 'r1', title: '현수막 구매', stage: 'in_progress' },
              { kind: 'message', id: 'm1', title: `${unbroken} ${longName}`, stage: 'finished' },
              { kind: 'request', id: 'r2', title: '옛 요청', stage: 'excluded' },
              { kind: 'event', id: 'e1', title: '신입생 환영회', stage: 'none' },
            ],
            canMake: ['request', 'registration_form', 'message', 'event'],
          }}
          saving={false}
          onMake={noop}
        />
        <TaskResults task={{ results: [], canMake: ['request'] }} saving onMake={noop} />
        <TaskResults task={{ results: [], canMake: [] }} saving={false} onMake={noop} />
      </div>
    </Section>
  )
}

export function TaskQuickAddSection() {
  return (
    <Section title="업무 빠른 추가">
      <div className="flex w-96 flex-col gap-6">
        <QuickAddView title="" onTitle={noop} onSubmit={noop} onOpenTask={noop} />
        <QuickAddView
          title="청소"
          onTitle={noop}
          onSubmit={noop}
          onOpenTask={noop}
          busy
          hiddenId="t1"
        />
        <QuickAddView
          title=""
          onTitle={noop}
          onSubmit={noop}
          onOpenTask={noop}
          error="제목을 입력해 주세요"
          problem="너무 빨리 보내고 있어요. 잠시 뒤에 다시 시도해 주세요."
        />
      </div>
    </Section>
  )
}

const boardList = (tasks: TaskSummary[], truncated = false) => ({
  state: { kind: 'ready' as const, tasks, truncated },
  reload: () => Promise.resolve(),
})
const boardChange = {
  busy: new Set(['b2']),
  errors: { b3: '상태를 바꾸지 못했어요. 다시 시도해 주세요.' },
  change: () => Promise.resolve(),
}
const boardDepartments = [{ id: 'd1' }, { id: 'd2' }, { id: 'd3' }]
const boardOpen = [
  task('b1', {}),
  task('b2', { department: { id: 'd2', name: '홍보부' }, title: '포스터 시안' }),
  task('b3', { overdue: true, assignee: null, dueDate: '2026-10-20', department: null }),
  task('b4', {
    status: 'in_progress',
    next: 'done',
    title: `${unbroken} ${longName}`,
    department: { id: 'd3', name: longName },
    assignee: { id: 'p2', name: longName, current: false },
  }),
  task('b5', { status: 'in_progress', next: 'done', dueDate: null, actions: [] }),
]
const boardDone = [task('b6', { status: 'done', next: null })]
const boardProps = {
  departments: boardDepartments,
  change: boardChange,
  onOpenTask: noop,
  onShowDoneTable: noop,
}

// 넓은 화면의 업무 보드(OPS-TASK-01): 1280px 화면의 본문 폭과 1024px 화면의 본문 폭(옆 메뉴 240px와 여백을 뺀 736px). 끝남 열이 넘친 보드와 빈 보드,
// 이어진 결과물의 문서 그림이 있는 카드.
export function TaskBoardSection() {
  return (
    <Section title="업무 보드">
      <div className="w-full">
        <TaskBoard open={boardList(boardOpen)} done={boardList(boardDone)} {...boardProps} />
      </div>
      <div className="w-full max-w-184">
        <TaskBoard
          open={boardList(boardOpen, true)}
          done={boardList(boardDone, true)}
          {...boardProps}
        />
      </div>
      <div className="w-full max-w-184">
        <TaskBoard open={boardList([])} done={boardList([])} {...boardProps} onAddFirst={noop} />
      </div>
      <ul className="w-72">
        <TaskCard
          task={task('b7', { title: '결과물이 이어진 업무' })}
          color={departmentColorOf('d1', boardDepartments)}
          busy={false}
          hasResult
          onOpen={noop}
          onChangeStatus={noop}
        />
      </ul>
    </Section>
  )
}
