import { useState } from 'react'
import type { TaskStatus, TaskSummary } from '@vada/contracts'
import { groupByDepartment } from '@/tasks/task-groups'
import { TaskRow } from '@/tasks/TaskRow'
import { TaskSectionList } from '@/tasks/TaskSectionList'
import { TaskStatusTabs } from '@/tasks/TaskStatusTabs'
import { Section } from './GallerySection'
import { TaskScopeExample } from './TaskMenuSection'
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
  assignee: { id: '00000000-0000-4000-8000-000000000001', name: '김새내', current: true },
  actions: ['task.change_status'],
  ...extra,
})
const list = (tasks: TaskSummary[], truncated = false) => ({
  state: { kind: 'ready' as const, tasks, truncated },
  reload: () => Promise.resolve(),
})
const OPEN = [
  task('s1', {}),
  task('s2', { title: unbroken, assignee: null, overdue: true, dueDate: '2026-10-20' }),
  task('s3', { department: { id: 'd2', name: '홍보부' }, title: '포스터 시안', actions: [] }),
  task('s4', {
    status: 'in_progress',
    next: 'done',
    title: longName,
    assignee: { id: 'p2', name: longName, current: false },
  }),
]
const DONE = [task('s5', { status: 'done', next: null, title: '현수막 주문' })]
const noop = () => {}

function Example({ start, truncated = false }: { start: TaskStatus; truncated?: boolean }) {
  const [column, setColumn] = useState(start)
  return (
    <div className="flex w-full flex-col gap-3">
      <TaskScopeExample menu />
      <TaskStatusTabs
        open={list(OPEN)}
        done={list(DONE, truncated)}
        column={column}
        onColumn={setColumn}
        councilEmpty={false}
        emptyText="업무 없음"
        body={(shown, filter) =>
          shown.state.kind === 'ready' && (
            <TaskSectionList
              sections={groupByDepartment(shown.state.tasks)}
              summary={filter === 'open'}
              row={item => (
                <TaskRow
                  key={item.id}
                  task={item}
                  show={{ assignee: true, department: false, event: true }}
                  busy={false}
                  onChangeStatus={noop}
                  onOpen={noop}
                />
              )}
            />
          )
        }
      />
    </div>
  )
}

// 1024px 아래 업무 화면(026 조각 4): 칩 줄 아래 상태 탭 셋과 고른 상태의 줄. 띄어쓰기 없는 긴 제목이 줄 안에서 접히는지 본다.
export function TaskStatusTabsSection() {
  return (
    <Section title="업무 상태 탭">
      <Example start="todo" />
      <Example start="done" truncated />
    </Section>
  )
}
