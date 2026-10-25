import { expect, test } from 'vitest'
import type { TeamMember } from '@vada/contracts'
import {
  councilRankLabel,
  departmentRankLabel,
  holdsRank,
  orgGroups,
  placementsText,
} from './team-view'

const titles = { president: '위원장', vicePresident: '부위원장', head: '국장', viceHead: '차장' }

test('직급은 학생회가 정한 표시 이름으로 보인다', () => {
  expect([
    councilRankLabel('president', titles),
    councilRankLabel('vice_president', titles),
    councilRankLabel(null, titles),
  ]).toEqual(['위원장', '부위원장', null])
  expect([
    departmentRankLabel('head', titles),
    departmentRankLabel('vice_head', titles),
    departmentRankLabel(null, titles),
  ]).toEqual(['국장', '차장', null])
})

test('부서 글은 부서 이름과 부서 직급을 잇는다', () => {
  const departments = [
    { id: 'f', name: '재정부' },
    { id: 'p', name: '기획부' },
  ]
  expect(
    placementsText(
      {
        departments: [
          { id: 'f', rank: 'head' },
          { id: 'p', rank: null },
        ],
      },
      departments,
      titles,
    ),
  ).toBe('재정부 국장 · 기획부')
  expect(placementsText({ departments: [] }, departments, titles)).toBe('')
})

test('학생회 직급이나 부서 직급이 하나라도 있으면 직급이 붙은 사람이다', () => {
  expect(holdsRank({ councilRank: null, departments: [{ id: 'f', rank: null }] })).toBe(false)
  expect(holdsRank({ councilRank: 'vice_president', departments: [] })).toBe(true)
  expect(
    holdsRank({
      councilRank: null,
      departments: [
        { id: 'f', rank: null },
        { id: 'p', rank: 'vice_head' },
      ],
    }),
  ).toBe(true)
})

const person = (
  id: string,
  councilRank: TeamMember['councilRank'],
  departments: TeamMember['departments'] = [],
): TeamMember => ({ id, name: id, councilRank, departments, joinedAt: '2026-10-01T01:00:00.000Z' })

test('조직 묶음: 회장단은 회장과 부회장 모두, 부서마다 그 부서 사람, 겸직자는 든 묶음마다, 차례는 받은 차례다', () => {
  const departments = [
    { id: 'f', name: '재정부', role: 'finance' as const, memberCount: 2 },
    { id: 'p', name: '기획부', role: null, memberCount: 2 },
  ]
  const members = [
    person('vice1', 'vice_president', [{ id: 'p', rank: null }]),
    person('pres', 'president'),
    person('both', null, [
      { id: 'f', rank: 'head' },
      { id: 'p', rank: 'head' },
    ]),
    person('vice2', 'vice_president'),
    person('new', null),
    person('fin', null, [{ id: 'f', rank: null }]),
  ]
  const groups = orgGroups(members, departments)
  const ids = (list: TeamMember[]) => list.map(member => member.id)
  expect(ids(groups.council)).toEqual(['vice1', 'pres', 'vice2'])
  expect(
    groups.departments.map(group => [group.department.id, ids(group.members), ids(group.heads)]),
  ).toEqual([
    ['f', ['both', 'fin'], ['both']],
    ['p', ['vice1', 'both'], ['both']],
  ])
  expect(ids(groups.unassigned)).toEqual(['new'])
})

test('목록에 없는 부서에만 든 사람은 미배정으로 보여 화면에서 사라지지 않는다', () => {
  const groups = orgGroups([person('lost', null, [{ id: 'gone', rank: null }])], [])
  expect(groups.unassigned.map(member => member.id)).toEqual(['lost'])
  expect(groups.departments).toEqual([])
})
