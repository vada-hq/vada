import { expect, test } from 'vitest'
import { councilView } from '@/test-support/council-fixtures'
import { homeTask } from '@/test-support/home-fixtures'
import { inHomeTaskScope, type HomeTaskScope } from './home-task-scope'

const planning = { id: 'd1', name: '기획부', rank: 'head' as const, role: null }
const ordinary = { id: 'd2', name: '홍보부', rank: null, role: null }
const council = councilView('c1', { councilRank: null, departments: [planning, ordinary] })
const defaults: HomeTaskScope = { heads: true, attention: false, week: false, assignee: null }
const task = homeTask('t1', 'soon', { department: planning, dueDate: '2026-11-01' })
test('담당자 없음 칩은 빈 담당자와 떠난 담당자의 열린 업무만 남긴다', () => {
  const scope = { ...defaults, heads: false, assignee: 'none' }
  expect(inHomeTaskScope(task, scope, council, '2026-10-25')).toBe(false)
  expect(inHomeTaskScope({ ...task, assignee: null }, scope, council, '2026-10-25')).toBe(true)
  expect(
    inHomeTaskScope(
      { ...task, assignee: { id: 'left', name: '떠난 사람', current: false } },
      scope,
      council,
      '2026-10-25',
    ),
  ).toBe(true)
  expect(
    inHomeTaskScope({ ...task, assignee: null, status: 'done' }, scope, council, '2026-10-25'),
  ).toBe(false)
})
test('홈 직급 부서 도착은 일반 소속 부서 업무를 섞지 않는다', () => {
  expect(inHomeTaskScope(task, defaults, council, '2026-10-25')).toBe(true)
  expect(inHomeTaskScope({ ...task, department: ordinary }, defaults, council, '2026-10-25')).toBe(
    false,
  )
})
test('확인할 일 도착은 지남과 담당자 없음의 합집합이고 끝난 업무를 빼며 조건을 풀 수 있다', () => {
  const scope = { ...defaults, attention: true }
  expect(inHomeTaskScope(task, scope, council, '2026-10-25')).toBe(false)
  expect(inHomeTaskScope({ ...task, overdue: true }, scope, council, '2026-10-25')).toBe(true)
  expect(inHomeTaskScope({ ...task, assignee: null }, scope, council, '2026-10-25')).toBe(true)
  expect(
    inHomeTaskScope({ ...task, assignee: null, status: 'done' }, scope, council, '2026-10-25'),
  ).toBe(false)
})
test('마감 몰림 도착은 그 담당자의 오늘~7일째 열린 업무만 보인다', () => {
  const scope = { ...defaults, assignee: 'p1', week: true }
  expect(inHomeTaskScope(task, scope, council, '2026-10-25')).toBe(true)
  for (const dueDate of ['2026-10-24', '2026-11-02', null])
    expect(inHomeTaskScope({ ...task, dueDate }, scope, council, '2026-10-25')).toBe(false)
  expect(
    inHomeTaskScope(
      { ...task, assignee: { id: 'p2', name: '다른 사람', current: true } },
      scope,
      council,
      '2026-10-25',
    ),
  ).toBe(false)
})
