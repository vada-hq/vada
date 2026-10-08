import { expect, test } from 'vitest'
import { groupMembers, moveWarning } from './members-view'

const lead = { id: 'lead', name: '회장단', isLeadership: true, handlesFinance: false }
const fin = { id: 'fin', name: '총무실', isLeadership: false, handlesFinance: true }
const plan = { id: 'plan', name: '기획부', isLeadership: false, handlesFinance: false }

test('권한이 바뀌는 이동만 문장을 만들고, 받침에 맞는 조사를 붙인다', () => {
  const member = { id: 'm', name: '김바다', title: '회장', departmentId: 'lead' }
  expect(moveWarning(member, lead, plan)).toBe('김바다를 기획부로 옮기면 조직 관리와 구매 승인을 할 수 없게 돼요. 직책은 지워져요.')
  expect(moveWarning({ ...member, name: '김민준', title: null }, fin, lead)).toBe('김민준을 회장단으로 옮기면 조직 관리를 할 수 있게 돼요.')
  expect(moveWarning({ ...member, title: null }, null, fin)).toBe('김바다를 총무실로 옮기면 구매 승인을 할 수 있게 돼요.')
  expect(moveWarning({ ...member, title: null }, fin, null)).toBe('김바다를 미배정으로 옮기면 구매 승인을 할 수 없게 돼요.')
  expect(moveWarning({ ...member, title: null }, plan, null)).toBeNull()
  expect(moveWarning({ ...member, title: null }, fin, { ...plan, handlesFinance: true })).toBeNull()
})

test('묶음은 미배정, 회장단, 가나다순이고 안에서는 직책이 있는 사람이 먼저다', () => {
  const members = [
    { id: '1', name: '하늘', title: null, departmentId: 'plan' }, { id: '2', name: '가람', title: null, departmentId: 'plan' },
    { id: '3', name: '나래', title: '부장', departmentId: 'plan' }, { id: '4', name: '다솜', title: null, departmentId: null },
  ]
  const groups = groupMembers([plan, fin, lead], members)
  expect(groups.map(group => group.department?.name ?? '미배정')).toEqual(['미배정', '회장단', '기획부', '총무실'])
  expect(groups[2]!.members.map(member => member.name)).toEqual(['나래', '가람', '하늘'])
  expect(groupMembers([plan], []).map(group => group.key)).toEqual(['plan'])
})
