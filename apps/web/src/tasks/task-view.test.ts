import { expect, test } from 'vitest'
import type { TaskSummary } from '@vada/contracts'
import { assigneeLabel, countOf, dueLabel, groupByDepartment } from './task-view'

const task = (id: string, extra: Partial<TaskSummary> = {}): TaskSummary => ({
  id,
  title: id,
  status: 'todo',
  dueDate: null,
  overdue: false,
  department: null,
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

test('옆 메뉴 수: 지난 것이 있으면 지남, 없으면 남은 수, 0이면 없고, 넘치면 +', () => {
  expect(countOf([], false)).toBeNull()
  expect(countOf([task('a'), task('b')], false)).toMatchObject({ label: '2', tone: 'info' })
  expect(countOf([task('a'), task('b', { overdue: true })], false)).toMatchObject({
    label: '지남 1',
    tone: 'danger',
  })
  expect(countOf([task('a')], true)?.label).toBe('1+')
  expect(countOf([task('a', { overdue: true })], true)?.label).toBe('지남 1+')
})

test('부서 이름순으로 묶고 학생회 업무는 맨 뒤다. 묶음 안 순서는 그대로다', () => {
  const groups = groupByDepartment([
    task('a'),
    task('b', { department: { id: 'd2', name: '홍보부' } }),
    task('c', { department: { id: 'd1', name: '기획부' } }),
    task('d', { department: { id: 'd2', name: '홍보부' } }),
  ])
  expect(groups.map(group => group.name)).toEqual(['기획부', '홍보부', '학생회 업무'])
  expect(groups[1]?.tasks.map(item => item.id)).toEqual(['b', 'd'])
})
