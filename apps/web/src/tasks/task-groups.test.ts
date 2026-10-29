import { expect, test } from 'vitest'
import type { TaskSummary } from '@vada/contracts'
import { dueGroupOf, groupByDepartment, groupByDue, sectionSummary } from './task-groups'

const task = (id: string, extra: Partial<TaskSummary> = {}): TaskSummary => ({
  id,
  title: id,
  status: 'todo',
  next: 'in_progress',
  dueDate: null,
  overdue: false,
  department: null,
  event: null,
  assignee: { id: 'm1', name: '김회장', current: true },
  actions: [],
  ...extra,
})
const TODAY = '2026-10-24'

test('내 업무는 지남, 오늘, 7일 안, 나중, 마감 없음으로 나누고 묶음 안은 받은 차례(고른 정렬) 그대로다', () => {
  expect(dueGroupOf(task('a', { overdue: true, dueDate: '2026-10-20' }), TODAY)).toBe('overdue')
  expect(dueGroupOf(task('b', { dueDate: TODAY }), TODAY)).toBe('today')
  expect(dueGroupOf(task('c', { dueDate: '2026-10-31' }), TODAY)).toBe('week')
  expect(dueGroupOf(task('d', { dueDate: '2026-11-01' }), TODAY)).toBe('later')
  expect(dueGroupOf(task('e'), TODAY)).toBe('none')
  const sections = groupByDue(
    [
      task('w2', { dueDate: '2026-10-30' }),
      task('n'),
      task('w1', { dueDate: '2026-10-26' }),
      task('o', { overdue: true, dueDate: '2026-10-01' }),
    ],
    TODAY,
  )
  expect(sections.map(section => section.title)).toEqual(['지남', '7일 안', '마감 없음'])
  expect(sections[1]?.tasks.map(item => item.id)).toEqual(['w2', 'w1'])
})

test('조직의 부서 차례로 묶고, 조직에 없는 부서는 그 뒤에 이름순, 학생회 업무는 맨 뒤다. 묶음 안은 받은 차례다', () => {
  const tasks = [
    task('a'),
    task('b', { department: { id: 'd2', name: '홍보부' }, dueDate: '2026-11-02' }),
    task('c', { department: { id: 'd1', name: '기획부' } }),
    task('d', { department: { id: 'd2', name: '홍보부' }, dueDate: '2026-10-25' }),
    task('e', { department: { id: 'd9', name: '가상부' } }),
    task('f', { department: { id: 'd8', name: '나중부' } }),
  ]
  const groups = groupByDepartment(tasks, [{ id: 'd2' }, { id: 'd1' }])
  expect(groups.map(group => group.title)).toEqual([
    '홍보부',
    '기획부',
    '가상부',
    '나중부',
    '학생회 업무',
  ])
  expect(groups[0]?.tasks.map(item => item.id)).toEqual(['b', 'd'])
  // 조직을 아직 모르면 이름순이다.
  expect(groupByDepartment(tasks).map(group => group.title)).toEqual([
    '가상부',
    '기획부',
    '나중부',
    '홍보부',
    '학생회 업무',
  ])
})

test('묶음 머리의 수: 진행 중, 지남, 담당자 없음(끝난 업무는 담당자 없음에 세지 않는다)', () => {
  expect(
    sectionSummary([
      task('a', { status: 'in_progress' }),
      task('b', { overdue: true }),
      task('c', { assignee: null }),
      task('d', { assignee: null, status: 'done' }),
      task('e', { assignee: { id: 'left', name: '떠난 담당자', current: false } }),
      task('f', {
        assignee: { id: 'left', name: '떠난 담당자', current: false },
        status: 'done',
      }),
    ]),
  ).toEqual({ inProgress: 1, overdue: 1, unassigned: 2 })
})
