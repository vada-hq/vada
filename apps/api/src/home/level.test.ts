import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { Actor } from '../access/actor.js'
import type { HomeKind } from '@vada/contracts'
import { hasFinanceView, homeKindOf, levelOf } from './level.js'

const base: Actor = {
  memberId: 'm',
  councilId: 'c',
  cohortId: 'h',
  membershipId: 's',
  councilRank: null,
  departments: [],
}

test('학생회 직급이 있으면 회장단이다', () => {
  assert.deepEqual(levelOf({ ...base, councilRank: 'vice_president' }), {
    council: true,
    departmentIds: [],
    finance: false,
  })
})

test('부서 직급이 있는 부서만 부장 계층이고 소속만 있는 부서는 아니다', () => {
  const level = levelOf({
    ...base,
    departments: [
      { departmentId: 'a', role: null, rank: 'head' },
      { departmentId: 'b', role: null, rank: 'vice_head' },
      { departmentId: 'c', role: null, rank: null },
    ],
  })
  assert.deepEqual(level, { council: false, departmentIds: ['a', 'b'], finance: false })
})

test('재정 역할 부서 소속이면 재정이고 회장단이라고 재정이 되지는 않는다', () => {
  const finance = { departmentId: 'f', role: 'finance' as const, rank: null }
  assert.equal(levelOf({ ...base, departments: [finance] }).finance, true)
  assert.equal(levelOf({ ...base, councilRank: 'president' }).finance, false)
})

// 홈 종류(DEC-95): 학생회 직급 → 재정 역할 부서 → 부서 직급 → 그 밖의 차례다.
test('홈 종류는 여덟 경우에 DEC-95의 차례와 같다', () => {
  const finance = { departmentId: 'f', role: 'finance' as const, rank: null }
  const planning = { departmentId: 'p', role: null, rank: null }
  const cases: [string, Actor, HomeKind, boolean][] = [
    ['회장', { ...base, councilRank: 'president' }, 'council', false],
    ['부회장', { ...base, councilRank: 'vice_president' }, 'council', false],
    ['재정부원', { ...base, departments: [finance] }, 'finance', false],
    ['재정부장', { ...base, departments: [{ ...finance, rank: 'head' }] }, 'finance', false],
    ['부장', { ...base, departments: [{ ...planning, rank: 'head' }] }, 'department', false],
    ['부부장', { ...base, departments: [{ ...planning, rank: 'vice_head' }] }, 'department', false],
    ['부원', { ...base, departments: [planning] }, 'member', false],
    ['부서 없는 운영진', base, 'member', false],
    [
      '회장단+재정',
      { ...base, councilRank: 'vice_president', departments: [finance] },
      'council',
      true,
    ],
  ]
  for (const [name, actor, kind, financeView] of cases) {
    assert.equal(homeKindOf(actor), kind, name)
    assert.equal(hasFinanceView(actor), financeView, name)
  }
})

test('재정 역할 부서 소속이면 다른 부서의 부장이어도 재정부 홈이다', () => {
  const finance = { departmentId: 'f', role: 'finance' as const, rank: null }
  const head = { departmentId: 'p', role: null, rank: 'head' as const }
  assert.equal(homeKindOf({ ...base, departments: [head, finance] }), 'finance')
})
