import { expect, test } from 'vitest'
import { teamResponse } from '@/test-support/council-fixtures'
import { detailAssigneeChoices, detailDepartmentChoices } from './task-form-options'

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
