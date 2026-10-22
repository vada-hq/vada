import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { Actor } from '../access/actor.js'
import { levelOf } from './level.js'

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
