import type { TaskAction, TaskDetail } from '@vada/contracts'

const ALL_TASK_ACTIONS: TaskAction[] = [
  'task.manage',
  'task.set_department',
  'task.assign',
  'task.status',
]

// 화면 시험이 같이 쓰는 업무 응답. 값은 서버 응답과 같은 모양이다.
export function taskDetail(overrides: Partial<TaskDetail> = {}): TaskDetail {
  return {
    id: 't1',
    title: '현수막 주문',
    status: 'todo',
    dueDate: '2026-10-25',
    overdue: false,
    department: { id: 'd1', name: '재정부' },
    event: null,
    assignee: { id: 'm2', name: '이재정', current: true },
    actions: ALL_TASK_ACTIONS,
    body: '크기는 3m로 해 주세요.',
    createdBy: { id: 'm1', name: '김회장' },
    createdAt: '2026-10-20T05:03:00.000Z',
    history: [
      {
        versionNo: 1,
        at: '2026-10-20T05:03:00.000Z',
        by: { id: 'm1', name: '김회장' },
        changes: [{ field: 'created' }],
      },
    ],
    ...overrides,
  }
}
