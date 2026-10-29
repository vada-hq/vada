import { expect, test } from 'vitest'
import type { TaskSummary } from '@vada/contracts'
import { sortTasks } from './task-sort'

const task = (
  id: string,
  dept: string | null,
  dueDate: string | null,
  createdAt: string,
): TaskSummary => ({
  id,
  title: id,
  status: 'todo',
  next: 'in_progress',
  dueDate,
  overdue: false,
  department: dept ? { id: dept, name: `부서 ${dept}` } : null,
  event: null,
  assignee: null,
  actions: [],
  createdAt: `2026-10-${createdAt}T00:00:00.000Z`,
})

// 조직의 부서 차례는 d2 → d1이다(이름순이나 번호순이 아니다).
const ORDER = [{ id: 'd2' }, { id: 'd1' }]
const TASKS = [
  task('학생회-마감', null, '2026-10-26', '01'),
  task('d1-없음', 'd1', null, '02'),
  task('d1-늦음', 'd1', '2026-11-01', '03'),
  task('d2-없음-먼저', 'd2', null, '04'),
  task('d1-일찍', 'd1', '2026-10-27', '05'),
  task('d2-없음-나중', 'd2', null, '06'),
  task('d2-일찍', 'd2', '2026-10-28', '07'),
]
const ids = (tasks: TaskSummary[]) => tasks.map(item => item.id)

test('부서별은 조직의 부서 차례, 같은 부서 안은 마감 임박 순(마감 없음은 뒤), 그다음 만든 순이고 부서 없는 업무는 맨 뒤다', () => {
  expect(ids(sortTasks(TASKS, 'department', ORDER))).toEqual([
    'd2-일찍',
    'd2-없음-먼저',
    'd2-없음-나중',
    'd1-일찍',
    'd1-늦음',
    'd1-없음',
    '학생회-마감',
  ])
})

test('조직에 없는 부서는 아는 부서 뒤, 부서 없는 업무 앞이다', () => {
  const lost = task('사라진', 'd9', '2026-10-20', '08')
  expect(ids(sortTasks([...TASKS, lost], 'department', ORDER)).slice(-2)).toEqual([
    '사라진',
    '학생회-마감',
  ])
})

test('마감 임박 순은 부서와 상관없이 마감이 이른 것부터, 마감 없음은 만든 순으로 뒤다', () => {
  expect(ids(sortTasks(TASKS, 'due', ORDER))).toEqual([
    '학생회-마감',
    'd1-일찍',
    'd2-일찍',
    'd1-늦음',
    'd1-없음',
    'd2-없음-먼저',
    'd2-없음-나중',
  ])
})

test('최신순은 최근에 만든 것부터다', () => {
  expect(ids(sortTasks(TASKS, 'recent', ORDER))).toEqual([
    'd2-일찍',
    'd2-없음-나중',
    'd1-일찍',
    'd2-없음-먼저',
    'd1-늦음',
    'd1-없음',
    '학생회-마감',
  ])
})

test('받은 목록을 바꾸지 않는다', () => {
  const before = ids(TASKS)
  sortTasks(TASKS, 'recent', ORDER)
  expect(ids(TASKS)).toEqual(before)
})
