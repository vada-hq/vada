import { useState } from 'react'
import type { TaskFilter, TaskSummary } from '@vada/contracts'
import { MyTasksView } from './MyTasksView'

const EVENT_ID = '00000000-0000-4000-8000-0000000000e1'
const DEPARTMENT_ID = '00000000-0000-4000-8000-0000000000d1'
const RESULT_COUNT = 2
const DATES = ['2026-10-24', '2026-10-25', '2026-10-28', '2026-11-14', null]
const tasks: TaskSummary[] = DATES.map((dueDate, index) => ({
  id: `00000000-0000-4000-8000-00000000000${index}`,
  title: ['간식 구매', '장소 대관', '포스터 시안 확인', '만족도 조사', '창고 정리'][index]!,
  status: index === 0 ? 'in_progress' : 'todo',
  next: index === 0 ? 'done' : 'in_progress',
  dueDate,
  overdue: index === 0,
  department: { id: DEPARTMENT_ID, name: '기획부' },
  event: { id: EVENT_ID, name: '신입생 환영회' },
  assignee: null,
  actions: ['task.change_status'],
  latestResult:
    index === 0
      ? { kind: 'request', stage: 'in_progress', changedAt: '2026-10-25T01:00:00Z' }
      : null,
  resultCount: index === 0 ? RESULT_COUNT : 0,
}))

// API 없이 거르기·검색·완료 이동을 확인하는 MY-01 갤러리 견본. 날짜는 스냅숏을 위해 고정한다.
export function MyTasksPreview({
  empty = false,
  filtered = false,
}: {
  empty?: boolean
  filtered?: boolean
}) {
  const [items, setItems] = useState(empty ? [] : tasks)
  const [filter, setFilter] = useState<TaskFilter>('open')
  const [scope, setScope] = useState<string | null>(null)
  const [state, setState] = useState<string | null>(null)
  const [search, setSearch] = useState(filtered ? '없는 업무' : '')
  const list = (done: boolean) => ({
    state: {
      kind: 'ready' as const,
      tasks: items.filter(task => (task.status === 'done') === done && scope !== 'council'),
      truncated: false,
    },
    reload: () => Promise.resolve(),
  })
  return (
    <MyTasksView
      open={list(false)}
      done={list(true)}
      filter={filter}
      scope={scope}
      state={state}
      search={search}
      today="2026-10-25"
      events={[{ id: EVENT_ID, name: '신입생 환영회' }]}
      onFilter={setFilter}
      onScope={setScope}
      onState={setState}
      onSearch={setSearch}
      onReset={() => {
        setScope(null)
        setState(null)
        setSearch('')
      }}
      onOpenTask={() => {}}
      change={{
        busy: new Set(),
        errors: {},
        change: (id, status) => {
          setItems(before =>
            before.map(task =>
              task.id === id ? { ...task, status, next: null, overdue: false } : task,
            ),
          )
          return Promise.resolve()
        },
      }}
    />
  )
}
