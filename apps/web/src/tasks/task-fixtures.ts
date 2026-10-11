import type { TaskDetail, TaskSummary } from '@vada/contracts'

export const taskSummary = (overrides: Partial<TaskSummary> = {}): TaskSummary => ({ id: 't1', event: { id: 'e1', name: '체육대회' },
  title: '현수막 디자인', description: '시안 두 개', status: 'todo', department: { id: 'd1', name: '기획부' },
  assignee: { membershipId: 'm2', name: '윤태민' }, dueOn: '2026-10-20', completedAt: null, createdBy: { id: 'u1', name: '테스터' },
  createdAt: '2026-10-01T00:00:00Z', version: 1, ...overrides })
export const taskDetail = (overrides: Partial<TaskDetail> = {}): TaskDetail => ({ ...taskSummary(overrides),
  history: [{ id: 'h1', action: 'created', actor: { id: 'u1', name: '테스터' }, changes: {}, createdAt: '2026-10-01T00:00:00Z' }], ...overrides })
