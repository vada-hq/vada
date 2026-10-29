import type { TaskSummary } from '@vada/contracts'
import { useState } from 'react'
import type { TaskView } from '@vada/contracts'
import { TaskBoard } from '@/tasks/TaskBoard'
import { TaskTabs } from '@/tasks/TaskTabs'
import type { TaskSort } from '@/tasks/task-sort'
import { QuickAddView } from '@/tasks/TaskQuickAdd'
import { DEPARTMENTS, type Sample, type Task } from '../data'

// 지금 구현(실제 TaskBoard·TaskCard)에 견본을 넣어 그린다. 넓은 화면 두 고침(열 폭 상한, 카드 정보 오른쪽까지)을 보는 판.
// 배포본과 같은 저장색(재정부 초록, 기획부 하늘, 홍보부 분홍)
const COLORS = { finance: 'emerald', planning: 'sky', promo: 'pink', outreach: 'violet', welfare: 'orange' } as const
const DEPTS = Object.keys(DEPARTMENTS).map(id => ({ id, color: COLORS[id as keyof typeof COLORS] ?? null }))
const STATUS = { todo: 'todo', doing: 'in_progress', done: 'done' } as const
const noop = () => {}

// '2월 10일' → 2027-02-10, '10월 30일' → 2026-10-30(오늘 10월 30일 기준 앞뒤)
function isoOf(text: string | null) {
  if (!text) return null
  const [m, d] = text.match(/\d+/g)!.map(Number)
  const year = m! >= 10 ? 2026 : 2027
  return `${year}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

const summaryOf = (t: Task): TaskSummary => ({
  id: t.id,
  title: t.title,
  status: STATUS[t.status],
  next: t.status === 'todo' ? 'in_progress' : t.status === 'doing' ? 'done' : null,
  dueDate: isoOf(t.due),
  overdue: t.overdue ?? false,
  department: t.dept ? { id: t.dept, name: DEPARTMENTS[t.dept]!.name } : null,
  event: null,
  assignee: t.assignee ? { id: `p-${t.assignee}`, name: t.assignee, current: true } : null,
  actions: ['task.change_status'],
})

const list = (tasks: TaskSummary[]) => ({
  state: { kind: 'ready' as const, tasks, truncated: false },
  reload: () => Promise.resolve(),
})

export function NowBoard({ sample }: { sample: Sample }) {
  const tasks = sample.tasks.map(summaryOf)
  return (
    <div className="flex flex-col gap-4">
      <EventTabControls />
      <QuickAddView title="" onTitle={noop} onSubmit={noop} onOpenTask={noop} onDetails={noop} />
      <TaskBoard
        open={list(tasks.filter(t => t.status !== 'done'))}
        done={list(tasks.filter(t => t.status === 'done'))}
        departments={DEPTS}
        change={{ busy: new Set(), errors: {}, change: () => Promise.resolve() }}
        onOpenTask={noop}
        onShowDoneTable={noop}
        councilEmpty={false}
        emptyText="업무 없음"
        cardMenu={() => [{ label: '링크 복사', onSelect: noop }]}
      />
    </div>
  )
}

// 행사 업무 탭의 조작 줄. TasksPage가 행사 탭에서 TaskTabs를 부르는 것과 같은 값(달력 허용, 배치 고르기, 정렬, 그 행사의 부서 칩)이다.
function EventTabControls() {
  const [view, setView] = useState<TaskView>('all')
  const [layout, setLayout] = useState<'board' | 'list' | 'calendar'>('board')
  const [sort, setSort] = useState<TaskSort>('department')
  return (
    <TaskTabs
      allowCalendar
      view={view}
      filter="open"
      onView={setView}
      onFilter={noop}
      chips={{
        counts: { overdue: 1, mine: 3, unassigned: 2, noDue: 1 },
        truncated: false,
        departments: ['finance', 'planning', 'promo'].map(id => ({ id, name: DEPARTMENTS[id]!.name })),
        members: [],
      }}
      showFilter={false}
      layout={{ value: layout, onChange: setLayout }}
      sort={{ value: sort, onChange: setSort }}
      scope={{
        inMenu: false,
        dept: null,
        due: null,
        assignee: null,
        includeEvents: false,
        setDept: noop,
        setAssignee: noop,
        toggleChip: noop,
        toggleEvents: noop,
      }}
    />
  )
}
