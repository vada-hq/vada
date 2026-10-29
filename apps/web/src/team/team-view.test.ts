import { expect, test } from 'vitest'
import type { TeamMember } from '@vada/contracts'
import {
  councilRankLabel,
  departmentRankLabel,
  orgGroups,
  placementsText,
  sidebarRoleLine,
  sidebarRoleParts,
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

const person = (
  id: string,
  councilRank: TeamMember['councilRank'],
  departments: Omit<TeamMember['departments'][number], 'actions'>[] = [],
): TeamMember => ({
  id,
  name: id,
  councilRank,
  departments: departments.map(item => ({ ...item, actions: [] })),
  joinedAt: '2026-10-01T01:00:00.000Z',
  actions: [],
})

test('조직 묶음: 회장단은 회장과 부회장 모두, 부서마다 그 부서 사람, 겸직자는 든 묶음마다, 묶음 안은 직급 순이다', () => {
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
    person('zed', null),
    person('new', null),
    person('fin', null, [{ id: 'f', rank: null }]),
  ]
  const groups = orgGroups(members, departments)
  const ids = (list: TeamMember[]) => list.map(member => member.id)
  // 받은 차례(들어온 순서)가 아니라 회장, 부회장(이름순), 부장, 직급 없음 순이다. 차례는 contracts sortByRank 하나가 정한다.
  expect(ids(groups.council)).toEqual(['pres', 'vice1', 'vice2'])
  expect(
    groups.departments.map(group => [group.department.id, ids(group.members), ids(group.heads)]),
  ).toEqual([
    ['f', ['both', 'fin'], ['both']],
    ['p', ['vice1', 'both'], ['both']],
  ])
  expect(ids(groups.unassigned)).toEqual(['new', 'zed'])
})

test('목록에 없는 부서에만 든 사람은 미배정으로 보여 화면에서 사라지지 않는다', () => {
  const groups = orgGroups([person('lost', null, [{ id: 'gone', rank: null }])], [])
  expect(groups.unassigned.map(member => member.id)).toEqual(['lost'])
  expect(groups.departments).toEqual([])
})

test('옆 메뉴 발의 둘째 줄은 부서 이름을 가운뎃점으로 잇고 직급을 붙인다. 부서가 없으면 직급만, 둘 다 없으면 없다', () => {
  const planning = { id: 'p', name: '기획부', role: null, rank: 'head' as const }
  const promo = { id: 'r', name: '홍보부', role: null, rank: 'head' as const }
  expect(sidebarRoleLine({ councilRank: null, departments: [planning, promo] }, titles)).toBe(
    '기획부 · 홍보부 · 국장',
  )
  expect(sidebarRoleLine({ councilRank: 'president', departments: [] }, titles)).toBe('위원장')
  expect(sidebarRoleLine({ councilRank: null, departments: [] }, titles)).toBeNull()
  expect(
    sidebarRoleLine({ councilRank: null, departments: [{ ...planning, rank: null }] }, titles),
  ).toBe('기획부')
  // 한 부서의 차장이고 다른 부서의 부장이면 높은 직급 하나만 붙인다.
  expect(
    sidebarRoleLine(
      { councilRank: null, departments: [{ ...planning, rank: 'vice_head' }, promo] },
      titles,
    ),
  ).toBe('기획부 · 홍보부 · 국장')
  expect(sidebarRoleLine({ councilRank: 'vice_president', departments: [planning] }, titles)).toBe(
    '기획부 · 부위원장',
  )
})

test('발 둘째 줄은 부서 칸과 직급 칸으로 나뉜다(좁으면 부서 칸만 줄인다)', () => {
  const planning = { id: 'p', name: '기획부', role: null, rank: 'head' as const }
  const promo = { id: 'r', name: '홍보부', role: null, rank: null }
  expect(sidebarRoleParts({ councilRank: null, departments: [planning, promo] }, titles)).toEqual({
    departments: '기획부 · 홍보부',
    rank: '국장',
  })
  expect(sidebarRoleParts({ councilRank: 'president', departments: [] }, titles)).toEqual({
    departments: '',
    rank: '위원장',
  })
  expect(sidebarRoleParts({ councilRank: null, departments: [] }, titles)).toBeNull()
})
