import { expect, test } from 'vitest'
import { councilRankLabel, departmentRankLabel, joinedDay, placementsText } from './team-view'

const titles = { president: '위원장', vicePresident: '부위원장', head: '국장', viceHead: '차장' }

test('직급은 학생회가 정한 표시 이름으로 보인다', () => {
  expect([councilRankLabel('president', titles), councilRankLabel('vice_president', titles), councilRankLabel(null, titles)])
    .toEqual(['위원장', '부위원장', null])
  expect([departmentRankLabel('head', titles), departmentRankLabel('vice_head', titles), departmentRankLabel(null, titles)]).toEqual(['국장', '차장', null])
})

test('들어온 날은 한국 날짜다', () => {
  expect(joinedDay('2026-10-18T15:00:00.000Z')).toBe('2026.10.19')
  expect(joinedDay('2026-10-18T14:59:59.000Z')).toBe('2026.10.18')
})

test('부서 글은 부서 이름과 부서 직급을 잇는다', () => {
  const departments = [{ id: 'f', name: '재정부' }, { id: 'p', name: '기획부' }]
  expect(placementsText({ departments: [{ id: 'f', rank: 'head' }, { id: 'p', rank: null }] }, departments, titles)).toBe('재정부 국장 · 기획부')
  expect(placementsText({ departments: [] }, departments, titles)).toBe('')
})
