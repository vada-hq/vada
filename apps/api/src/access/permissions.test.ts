import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ACTIONS, type Action } from '@vada/contracts'
import type { Actor } from './actor.js'
import { allows, can, permissionsOf, PERMISSIONS } from './permissions.js'

const actor = (
  memberId: string,
  councilRank: Actor['councilRank'],
  departments: Actor['departments'] = [],
): Actor => ({
  memberId,
  councilId: 'c',
  cohortId: 'k',
  membershipId: `m-${memberId}`,
  councilRank,
  departments,
})
const president = actor('president', 'president')
const vicePresident = actor('vice', 'vice_president')
const financeMember = actor('finance', null, [
  { departmentId: 'finance', role: 'finance', rank: null },
])
const planningHead = actor('head', null, [{ departmentId: 'planning', role: null, rank: 'head' }])
const planningViceHead = actor('viceHead', null, [
  { departmentId: 'planning', role: null, rank: 'vice_head' },
])
const planningMember = actor('member', null, [{ departmentId: 'planning', role: null, rank: null }])
const plain = actor('plain', null)

test('권한표는 계약의 동작을 빠짐없이 한 칸씩 가진다', () => {
  assert.deepEqual(Object.keys(PERMISSIONS).sort(), [...ACTIONS].sort())
})

// 조직 칸마다 허용 한 사람과 거부 한 사람(바탕 spec '테스트'). 보기의 거부(운영진이 아닌 사람)는 actor.test.ts의 authorize가 본다.
const cells: [Action, Actor, Actor][] = [
  ['council.view', plain, plain],
  ['council.update', vicePresident, planningHead],
  ['cohort.update', vicePresident, planningHead],
  ['department.manage', vicePresident, financeMember],
  ['invite.manage', vicePresident, planningHead],
  ['member.manage', vicePresident, planningViceHead],
  ['rank.manage', vicePresident, planningHead],
  ['president.transfer', president, vicePresident],
]
for (const [action, allowed, denied] of cells) {
  test(`조직 칸 ${action}: ${allowed.memberId}는 되고${action === 'council.view' ? '' : ` ${denied.memberId}는 안 된다`}`, () => {
    assert.equal(can(allowed, action), true)
    if (action !== 'council.view') assert.equal(can(denied, action), false)
  })
}

test('상속: 회장단은 모든 부서에서 부장 권한을 가지고, 부부장은 부장과 같다. 다른 부서의 부장과 부원은 아니다', () => {
  const rule = { who: ['department_head'] as const }
  const planning = { departmentId: 'planning' }
  for (const allowed of [president, vicePresident, planningHead, planningViceHead])
    assert.equal(allows(allowed, rule, planning), true, allowed.memberId)
  for (const denied of [planningMember, financeMember, plain])
    assert.equal(allows(denied, rule, planning), false, denied.memberId)
  assert.equal(allows(planningHead, rule, { departmentId: 'finance' }), false)
})

test('재정 권한은 직급으로 물려받지 않는다: 회장은 재정 칸이 안 되고, 직급 없는 재정부원은 된다', () => {
  const rule = { who: ['finance'] as const }
  assert.equal(allows(president, rule), false)
  assert.equal(allows(vicePresident, rule), false)
  assert.equal(allows(financeMember, rule), true)
})

test('합치기: 여러 기준 중 하나라도 맞으면 된다', () => {
  const rule = { who: ['leadership', 'finance'] as const }
  assert.equal(allows(financeMember, rule), true)
  assert.equal(allows(vicePresident, rule), true)
  assert.equal(allows(planningHead, rule), false)
})

test('직무 분리: 요청한 사람은 자기 요청을 승인하지 않는다. 재정부는 예외가 아니다(구매 결재 칸만 직무 분리를 두지 않는다, DEC-41)', () => {
  const byHead = { who: ['department_head'] as const, notOwnRequest: true }
  assert.equal(
    allows(planningHead, byHead, { departmentId: 'planning', requestedBy: 'head' }),
    false,
  )
  assert.equal(
    allows(planningHead, byHead, { departmentId: 'planning', requestedBy: 'member' }),
    true,
  )
  const byFinance = { who: ['finance'] as const, notOwnRequest: true }
  assert.equal(allows(financeMember, byFinance, { requestedBy: 'finance' }), false)
  assert.equal(allows(financeMember, byFinance, { requestedBy: 'member' }), true)
  // 구매 결재 칸은 notOwnRequest를 두지 않아 재정부가 스스로 결재한다.
  assert.equal(
    allows(financeMember, { who: ['finance'] as const }, { requestedBy: 'finance' }),
    true,
  )
})

test('직무 분리 칸은 요청한 사람을 모르면 막는다(기본 거부): requestedBy가 없으면 누구도 승인하지 못한다', () => {
  const byHead = { who: ['department_head'] as const, notOwnRequest: true }
  const byFinance = { who: ['finance'] as const, notOwnRequest: true }
  assert.equal(allows(planningHead, byHead, { departmentId: 'planning' }), false)
  assert.equal(allows(president, byHead), false)
  assert.equal(allows(financeMember, byFinance), false)
  assert.equal(allows(financeMember, byFinance, {}), false)
  // 직무 분리를 두지 않은 칸은 requestedBy 없이도 된다.
  assert.equal(allows(financeMember, { who: ['finance'] as const }), true)
})

test('직무 분리: 재정부를 겸한 부장은 부장 칸에서, 재정부를 겸한 부회장은 회장단 칸에서 자기 요청을 승인하지 못한다', () => {
  const inFinance = { departmentId: 'finance', role: 'finance' as const, rank: null }
  const financeHead = actor('financeHead', null, [
    { departmentId: 'planning', role: null, rank: 'head' },
    inFinance,
  ])
  const financeVice = actor('financeVice', 'vice_president', [inFinance])
  const headCell = { who: ['department_head'] as const, notOwnRequest: true }
  const leadershipCell = { who: ['leadership'] as const, notOwnRequest: true }
  assert.equal(
    allows(financeHead, headCell, { departmentId: 'planning', requestedBy: 'financeHead' }),
    false,
  )
  assert.equal(
    allows(financeHead, headCell, { departmentId: 'planning', requestedBy: 'member' }),
    true,
  )
  assert.equal(allows(financeVice, leadershipCell, { requestedBy: 'financeVice' }), false)
  assert.equal(allows(financeVice, leadershipCell, { requestedBy: 'member' }), true)
})

test('내 권한 목록: 회장은 조직 칸 전부, 부회장은 회장 넘기기만 빼고, 직급 없는 운영진은 보기만 가진다', () => {
  assert.deepEqual(permissionsOf(president), [...ACTIONS])
  assert.deepEqual(
    permissionsOf(vicePresident),
    ACTIONS.filter(action => action !== 'president.transfer'),
  )
  assert.deepEqual(permissionsOf(planningHead), ['council.view'])
  assert.deepEqual(permissionsOf(plain), ['council.view'])
})
