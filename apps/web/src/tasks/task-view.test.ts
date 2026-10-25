import { expect, test } from 'vitest'
import type { TaskSummary } from '@vada/contracts'
import { assigneeLabel, dueLabel, overdueOf } from './task-view'

const task = (id: string, extra: Partial<TaskSummary> = {}): TaskSummary => ({
  id,
  title: id,
  status: 'todo',
  next: 'in_progress',
  dueDate: null,
  overdue: false,
  department: null,
  event: null,
  assignee: null,
  actions: [],
  ...extra,
})

test('마감과 담당자 문구', () => {
  expect(dueLabel('2026-10-05')).toBe('10월 5일')
  expect(dueLabel(null)).toBe('마감 없음')
  expect(assigneeLabel(null)).toBe('담당자 없음')
  expect(assigneeLabel({ id: 'm1', name: '김준호', current: true })).toBe('김준호')
  expect(assigneeLabel({ id: 'm1', name: '김준호', current: false })).toBe('떠난 사람: 김준호')
})

test('옆 메뉴 수는 지난 업무만 센다: 남은 업무가 있어도 지난 것이 없으면 0, 목록이 잘렸으면 more', () => {
  expect(overdueOf([], false)).toEqual({ count: 0, more: false })
  expect(overdueOf([task('a'), task('b')], false)).toEqual({ count: 0, more: false })
  expect(overdueOf([task('a'), task('b', { overdue: true })], false)).toEqual({
    count: 1,
    more: false,
  })
  expect(overdueOf([task('a', { overdue: true })], true)).toEqual({ count: 1, more: true })
})
