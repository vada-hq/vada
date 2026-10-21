import { expect, test } from 'vitest'
import { councilView, MEMBER_PERMISSIONS, teamResponse } from '@/test-support/council-fixtures'
import {
  assigneeChoices,
  defaultDepartmentId,
  departmentChoices,
  detailAssigneeChoices,
  detailDepartmentChoices,
  keepAssignee,
} from './task-form-options'

const team = teamResponse()
const withDepartments = (rank: 'head' | 'vice_head' | null) => {
  const view = councilView('c1', { councilRank: null, permissions: MEMBER_PERMISSIONS })
  return {
    ...view,
    me: {
      ...view.me,
      memberId: 'm2',
      departments: [{ id: 'd1', name: '재정부', role: 'finance' as const, rank }],
    },
  }
}
const labels = (choices: { label: string }[]) => choices.map(item => item.label)

test('회장단은 모든 부서와 학생회 업무, 모든 운영진과 담당자 없음을 고른다', () => {
  const view = councilView('c1', { councilRank: 'president' })
  expect(labels(departmentChoices(view, team))).toEqual(['재정부', '기획부', '학생회 업무'])
  expect(labels(assigneeChoices(view, team, null))).toEqual([
    '담당자 없음',
    '김회장',
    '이재정',
    '박새내',
  ])
  expect(defaultDepartmentId(view)).toBeNull()
})

test('부원은 내 부서들과 학생회 업무를 고르고 담당자는 나뿐이다', () => {
  const view = withDepartments(null)
  expect(labels(departmentChoices(view, team))).toEqual(['재정부', '학생회 업무'])
  expect(assigneeChoices(view, team, 'd1')).toEqual([{ id: 'm2', label: '나' }])
  expect(assigneeChoices(view, team, null)).toEqual([{ id: 'm2', label: '나' }])
  expect(defaultDepartmentId(view)).toBe('d1')
})

test('고른 부서의 부장이면 모든 운영진을 고르고 다른 부서에서는 나뿐이다', () => {
  const view = withDepartments('head')
  expect(labels(assigneeChoices(view, team, 'd1'))).toContain('박새내')
  expect(assigneeChoices(view, team, null)).toEqual([{ id: 'm2', label: '나' }])
  expect(assigneeChoices(view, team, 'd2')).toEqual([{ id: 'm2', label: '나' }])
})

test('부서가 없는 운영진의 기본은 학생회 업무다', () => {
  expect(defaultDepartmentId(councilView('c1', { councilRank: null }))).toBeNull()
})

test('부서를 바꾸면 선택지에 없는 담당자는 첫 선택지로 돌아간다', () => {
  const choices = [{ id: 'm2', label: '나' }]
  expect(keepAssignee(choices, 'm1')).toBe('m2')
  expect(keepAssignee(choices, 'm2')).toBe('m2')
  expect(keepAssignee([], 'm1')).toBeNull()
})

test('상세의 부서 선택지는 모든 부서와 학생회 업무다', () => {
  expect(labels(detailDepartmentChoices(team))).toEqual(['재정부', '기획부', '학생회 업무'])
})

test('상세의 담당자 선택지는 그 부서의 부서원을 먼저 두고 담당자 없음이 맨 뒤다', () => {
  expect(labels(detailAssigneeChoices(team, { department: { id: 'd1', name: '재정부' } }))).toEqual(
    ['이재정', '김회장', '박새내', '담당자 없음'],
  )
  expect(labels(detailAssigneeChoices(team, { department: null }))).toEqual([
    '김회장',
    '이재정',
    '박새내',
    '담당자 없음',
  ])
})
