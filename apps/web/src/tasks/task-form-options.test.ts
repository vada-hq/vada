import { expect, test } from 'vitest'
import { teamResponse } from '@/test-support/council-fixtures'
import { eventSummary } from '@/test-support/event-fixtures'
import {
  detailAssigneeChoices,
  detailDepartmentChoices,
  eventChoices,
  linkableEventsOf,
} from './task-form-options'

test('고치기의 행사는 그 업무 부서로 이을 수 있는 행사만이고, 지금 이은 행사는 남는다', () => {
  const events = ['e1', 'e2', 'e3'].map(id => eventSummary({ id, name: id }))
  const linkable = [
    { departmentId: 'd1', eventIds: ['e1'] },
    { departmentId: null, eventIds: ['e1', 'e2', 'e3'] },
  ]
  const ids = (list: { id: string }[]) => list.map(item => item.id)
  expect(ids(linkableEventsOf(events, linkable, 'd1'))).toEqual(['e1'])
  expect(ids(linkableEventsOf(events, linkable, null))).toEqual(['e1', 'e2', 'e3'])
  // 선택지에 없는 부서(지운 부서 등)는 이을 행사가 없다(기본 거부).
  expect(linkableEventsOf(events, linkable, 'd9')).toEqual([])
  const current = { id: 'e3', name: 'e3' }
  expect(labels(eventChoices(linkableEventsOf(events, linkable, 'd1'), current))).toEqual([
    '행사 없음',
    'e1',
    'e3',
  ])
})

const team = teamResponse()
const labels = (choices: { label: string }[]) => choices.map(item => item.label)

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
