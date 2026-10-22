import type { HomeResponse, HomeTask, HomeTaskGroup } from '@vada/contracts'

export const homeTask = (
  id: string,
  group: HomeTaskGroup,
  extra: Partial<HomeTask> = {},
): HomeTask => ({
  id,
  title: `업무 ${id}`,
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

const noCounts = { overdue: 0, today: 0, soon: 0, later: 0, noDue: 0 }

export const homeResponse = (extra: Partial<HomeResponse> = {}): HomeResponse => ({
  today: '2026-10-23',
  mine: { tasks: [], counts: noCounts },
  ...extra,
})

// 줄의 묶음으로 수를 세고, 줄보다 수가 많은 경우는 counts로 덮어쓴다.
export const homeWithTasks = (tasks: HomeTask[], counts: Partial<typeof noCounts> = {}) => {
  const own = { ...noCounts }
  for (const task of tasks) own[task.group] += 1
  return homeResponse({ mine: { tasks, counts: { ...own, ...counts } } })
}
