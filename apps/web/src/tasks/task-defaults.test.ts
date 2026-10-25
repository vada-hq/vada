import { expect, test } from 'vitest'
import type { TaskCreateOptionsResponse, TaskView } from '@vada/contracts'
import { councilView, MEMBER_PERMISSIONS } from '@/test-support/council-fixtures'
import { defaultPlacement, visibleInView, type QuickAddContext } from './task-defaults'

const person = (id: string) => ({ id, name: id })
const NONE = { id: null, name: null }
// 회장단: 모든 부서와 학생회 업무에 없음과 모두. 부원: 내 부서와 학생회 업무에 나만.
const leadership: TaskCreateOptionsResponse = {
  departments: [
    { id: 'd1', name: '재정부', assignees: [NONE, person('m1'), person('m2')] },
    { id: 'd2', name: '기획부', assignees: [NONE, person('m1'), person('m2')] },
    { id: null, name: null, assignees: [NONE, person('m1'), person('m2')] },
  ],
  linkableEvents: [],
}
const member: TaskCreateOptionsResponse = {
  departments: [
    { id: 'd1', name: '재정부', assignees: [person('m2')] },
    { id: null, name: null, assignees: [person('m2')] },
  ],
  linkableEvents: [],
}

const memberView = (...ranks: ('head' | null)[]) => {
  const view = councilView('c1', { councilRank: null, permissions: MEMBER_PERMISSIONS })
  const departments = ranks.map((rank, index) => ({
    id: `d${index + 1}`,
    name: `부서${index + 1}`,
    role: null,
    rank,
  }))
  return { ...view, me: { ...view.me, memberId: 'm2', departments } }
}
const context = (taskView: TaskView, extra: Partial<QuickAddContext> = {}): QuickAddContext => ({
  view: memberView(null),
  taskView,
  dept: null,
  eventId: undefined,
  ...extra,
})

test('내 업무: 담당자는 나, 부서는 내 부서', () => {
  expect(defaultPlacement(member, context('mine'))).toEqual({
    departmentId: 'd1',
    assigneeId: 'm2',
  })
})

test('담당자 없음·전체·내 부서: 담당자 없음이 선택지에 있으면 없음, 없으면 나', () => {
  const head = { ...context('all'), view: memberView('head') }
  expect(defaultPlacement(leadership, { ...head, dept: 'd1' })).toEqual({
    departmentId: 'd1',
    assigneeId: null,
  })
  expect(defaultPlacement(member, context('unassigned'))).toEqual({
    departmentId: 'd1',
    assigneeId: 'm2',
  })
})

test('회장단은 부서 거르기가 없으면 학생회 업무, 있으면 그 부서', () => {
  const president = { ...context('all'), view: councilView('c1', { councilRank: 'president' }) }
  expect(defaultPlacement(leadership, president)).toEqual({ departmentId: null, assigneeId: null })
  expect(defaultPlacement(leadership, { ...president, dept: 'd2' })).toEqual({
    departmentId: 'd2',
    assigneeId: null,
  })
})

test('부원은 부장인 부서를 먼저 고른다', () => {
  const view = memberView(null, 'head')
  const options: TaskCreateOptionsResponse = {
    departments: [
      { id: 'd1', name: '부서1', assignees: [person('m2')] },
      { id: 'd2', name: '부서2', assignees: [NONE, person('m2')] },
    ],
    linkableEvents: [],
  }
  expect(defaultPlacement(options, { ...context('all'), view })).toEqual({
    departmentId: 'd2',
    assigneeId: null,
  })
})

test('고른 부서가 선택지에 없으면 선택지의 첫 부서로 돌린다', () => {
  expect(defaultPlacement(member, { ...context('mine'), dept: 'd9' })).toEqual({
    departmentId: 'd1',
    assigneeId: 'm2',
  })
  expect(defaultPlacement({ departments: [], linkableEvents: [] }, context('mine'))).toBeNull()
})

test('행사의 업무 탭에서 고를 부서가 없으면(학생회 업무만) 자리가 없고, 행사 밖에서는 학생회 업무다', () => {
  const councilOnly: TaskCreateOptionsResponse = {
    departments: [{ id: null, name: null, assignees: [person('m2')] }],
    linkableEvents: [],
  }
  expect(defaultPlacement(councilOnly, context('all', { eventId: 'e1' }))).toBeNull()
  expect(defaultPlacement(councilOnly, context('all'))).toEqual({
    departmentId: null,
    assigneeId: 'm2',
  })
  expect(defaultPlacement(member, context('all', { eventId: 'e1' }))).toEqual({
    departmentId: 'd1',
    assigneeId: 'm2',
  })
  // 학생회 업무를 바라는 사람(회장단, 부서 없는 운영진)은 행사에서도 학생회 업무로 만든다.
  for (const view of [councilView('c1', { councilRank: 'president' }), memberView()])
    expect(defaultPlacement(councilOnly, { ...context('all', { eventId: 'e1' }), view })).toEqual({
      departmentId: null,
      assigneeId: 'm2',
    })
})

test('만든 업무가 지금 보기에 있는지 본다', () => {
  const mine = {
    department: { id: 'd1', name: '재정부' },
    assignee: { ...person('m2'), current: true },
    event: null,
  }
  const open = { ...mine, assignee: null }
  expect(visibleInView(mine, context('mine'))).toBe(true)
  expect(visibleInView(mine, context('unassigned'))).toBe(false)
  expect(visibleInView(open, context('unassigned'))).toBe(true)
  expect(visibleInView(open, context('mine'))).toBe(false)
  expect(visibleInView(mine, context('department'))).toBe(true)
  expect(visibleInView({ ...mine, department: null }, context('department'))).toBe(false)
  expect(visibleInView(mine, context('all', { dept: 'd2' }))).toBe(false)
  expect(visibleInView(mine, context('all', { eventId: 'e1' }))).toBe(false)
  expect(
    visibleInView(
      { ...mine, event: { id: 'e1', name: '행사' } },
      context('all', { eventId: 'e1' }),
    ),
  ).toBe(true)
})
