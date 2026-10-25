import { expect, test } from 'vitest'
import { councilRankLabel, departmentRankLabel, holdsRank, placementsText } from './team-view'

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
