import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { Actor } from '../access/actor.js'
import { actionsOf, decide, factsOf, placementActionsOf } from './policy.js'

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
const vice = actor('vice', 'vice_president')
const head = actor('head', null, [{ departmentId: 'planning', role: null, rank: 'head' }])
const plain = actor('plain', null)

const target = (
  memberId: string,
  councilRank: Actor['councilRank'] = null,
  ranks: ('head' | 'vice_head' | null)[] = [],
) =>
  factsOf(
    memberId,
    { councilRank },
    ranks.map(rank => ({ rank })),
  )

test('운영진 줄의 동작: 회장은 남에게 넷 다, 자기 줄에는 부서 배정과 직급만 받는다', () => {
  assert.deepEqual(actionsOf(president, target('x')), [
    'member.assign_department',
    'member.change_rank',
    'member.hand_over_president',
    'member.remove',
  ])
  assert.deepEqual(actionsOf(president, target('president', 'president')), [
    'member.assign_department',
  ])
})

test('운영진 줄의 동작: 회장 줄은 직급 바꾸기와 내보내기가 없고, 부회장은 회장 넘기기가 없다', () => {
  const ofPresident = target('president', 'president')
  assert.deepEqual(actionsOf(vice, ofPresident), ['member.assign_department'])
  assert.equal(decide(vice, ofPresident, 'member.change_rank'), 'PRESIDENT_REQUIRED')
  assert.equal(decide(vice, ofPresident, 'member.remove'), 'PRESIDENT_CANNOT_LEAVE')
  assert.equal(decide(vice, target('x'), 'member.hand_over_president'), 'FORBIDDEN')
  assert.equal(
    decide(president, target('president'), 'member.hand_over_president'),
    'ALREADY_PRESIDENT',
  )
})

test('운영진 줄의 동작: 스스로는 내보내지 못하고, 직급 없는 운영진과 부장은 줄 동작이 없다', () => {
  assert.equal(
    decide(vice, target('vice', 'vice_president'), 'member.remove'),
    'CANNOT_REMOVE_SELF',
  )
  for (const who of [head, plain]) {
    assert.deepEqual(actionsOf(who, target('x')), [], who.memberId)
    assert.equal(decide(who, target('x'), 'member.remove'), 'FORBIDDEN', who.memberId)
  }
})

test('부서 소속의 동작: 빼기는 member.manage이고, 직급이 붙은 소속은 rank.manage도 본다', () => {
  assert.deepEqual(placementActionsOf(vice, 'head'), ['placement.remove'])
  assert.deepEqual(placementActionsOf(vice, null), ['placement.remove'])
  for (const who of [head, plain]) {
    assert.deepEqual(placementActionsOf(who, null), [], who.memberId)
    assert.deepEqual(placementActionsOf(who, 'vice_head'), [], who.memberId)
  }
})

test('직급이 붙은 사람을 내보내는 판정은 직급 칸이 있어야 한다(부서 직급 하나만 붙어도)', () => {
  // 지금 권한표에서 member.manage와 rank.manage는 같은 회장단이라, 판정 함수의 직급 칸 분기는 사실로 본다.
  assert.equal(decide(vice, target('x', null, ['vice_head']), 'member.remove'), null)
  assert.equal(decide(vice, target('x', 'vice_president'), 'member.remove'), null)
  assert.equal(decide(head, target('x', null, ['head']), 'member.remove'), 'FORBIDDEN')
})
