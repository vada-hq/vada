import { expect, test } from 'vitest'
import type { TaskSummary } from '@vada/contracts'
import { chipChange, chipCounts, matchesTaskChips } from './task-chips'

const task = (extra: Partial<TaskSummary> = {}): TaskSummary => ({
  id: 'task',
  title: '업무',
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

test('칩 수는 열린 업무만 세고 떠난 담당자도 담당자 없음에 넣는다', () => {
  const tasks = [
    task({ overdue: true, dueDate: '2026-10-20' }),
    task({ assignee: { id: 'me', name: '나', current: true } }),
    task({ assignee: { id: 'left', name: '떠남', current: false } }),
    task({ status: 'done', overdue: true }),
  ]
  expect(chipCounts(tasks, 'me')).toEqual({ overdue: 1, mine: 1, unassigned: 2, noDue: 2 })
  expect(chipCounts([], 'me')).toEqual({ overdue: 0, mine: 0, unassigned: 0, noDue: 0 })
})

test('부서 없음·내 업무·마감 칩을 겹치며 끝난 업무는 마감 칩에서 빠진다', () => {
  const mine = task({ assignee: { id: 'me', name: '나', current: true } })
  expect(matchesTaskChips(mine, 'none', { view: 'mine', due: 'none' }, 'me')).toBe(true)
  expect(matchesTaskChips(mine, 'other', { view: 'mine', due: 'none' }, 'me')).toBe(false)
  expect(matchesTaskChips(mine, null, { view: 'mine', due: null }, 'other')).toBe(false)
  expect(matchesTaskChips(task({ status: 'done' }), null, { due: 'none' }, 'me')).toBe(false)
  expect(matchesTaskChips(task({ overdue: true }), null, { due: 'overdue' }, 'me')).toBe(true)
  expect(
    matchesTaskChips(task({ overdue: true, status: 'done' }), null, { due: 'overdue' }, 'me'),
  ).toBe(false)
  expect(matchesTaskChips(mine, null, { due: 'week' }, 'me')).toBe(true)
})

test('담당자 없음과 마감 칩은 교체하고, 담당자 UUID와 마감 칩은 겹친다', () => {
  expect(chipChange({ due: null, assignee: 'none' }, 'overdue')).toEqual({
    due: 'overdue',
    assignee: null,
  })
  expect(chipChange({ due: 'overdue', assignee: null }, 'unassigned')).toEqual({
    due: null,
    assignee: 'none',
  })
  expect(chipChange({ due: 'overdue', assignee: 'me' }, 'none')).toEqual({ due: 'none' })
  expect(chipChange({ due: 'none', assignee: 'me' }, 'none')).toEqual({ due: null })
  expect(chipChange({ due: null, assignee: 'none' }, 'unassigned')).toEqual({
    due: null,
    assignee: null,
  })
})
