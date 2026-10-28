// @vitest-environment jsdom
import { afterEach, expect, test } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import type { TeamMember } from '@vada/contracts'
import { teamResponse } from '@/test-support/council-fixtures'
import { snapshotHtml } from '@/test-support/snapshot-html'
import MemberDepartmentsDialog from './MemberDepartmentsDialog'

// 부서 배정 대화상자를 나누기 전의 겉 모양을 그대로 적어 둔 특성 시험이다(docs/features/r01-maintainability.md 조각 5).
// 나눈 뒤에도 이 스냅숏 파일은 바뀌지 않아야 한다.
afterEach(cleanup)
const titles = { president: '위원장', vicePresident: '부위원장', head: '국장', viceHead: '차장' }
const { members, departments } = teamResponse()
const placed = members[1] as TeamMember
const free = members[2] as TeamMember

function show(
  member: TeamMember,
  options: { canRank?: boolean; saving?: boolean; error?: string; none?: boolean } = {},
) {
  render(
    <MemberDepartmentsDialog
      member={member}
      departments={options.none ? [] : departments}
      titles={titles}
      saving={options.saving ?? false}
      canRank={options.canRank ?? true}
      error={options.error ?? ''}
      onAssign={() => {}}
      onRemove={() => {}}
      onClose={() => {}}
    />,
  )
}

test('부서가 있는 사람', () => {
  show(placed)
  expect(snapshotHtml()).toMatchSnapshot()
})

test('부서가 없는 사람', () => {
  show(free)
  expect(snapshotHtml()).toMatchSnapshot()
})

// 직급 칸이 없으면 서버는 직급이 붙은 소속에 빼기(placement.remove)를 주지 않는다.
test('직급 권한 없음', () => {
  show(
    { ...placed, departments: placed.departments.map(item => ({ ...item, actions: [] })) },
    { canRank: false },
  )
  expect(snapshotHtml()).toMatchSnapshot()
})

test('저장 중', () => {
  show(placed, { saving: true })
  expect(snapshotHtml()).toMatchSnapshot()
})

test('오류', () => {
  show(placed, { error: '저장하지 못했어요.' })
  expect(snapshotHtml()).toMatchSnapshot()
})

test('만들어 둔 부서가 없음', () => {
  show(free, { none: true })
  expect(snapshotHtml()).toMatchSnapshot()
})

test('모든 부서에 들어 있음', () => {
  show({
    ...placed,
    departments: [
      { id: 'd1', rank: null, actions: ['placement.remove'] },
      { id: 'd2', rank: 'vice_head', actions: ['placement.remove'] },
    ],
  })
  expect(snapshotHtml()).toMatchSnapshot()
})
