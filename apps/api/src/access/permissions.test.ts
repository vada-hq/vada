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
  ['chat.notice', vicePresident, planningHead],
  ['chat.direct', plain, plain],
]
for (const [action, allowed, denied] of cells) {
  test(`조직 칸 ${action}: ${allowed.memberId}는 되고${action === 'council.view' || action === 'chat.direct' ? '' : ` ${denied.memberId}는 안 된다`}`, () => {
    assert.equal(can(allowed, action), true)
    if (action !== 'council.view' && action !== 'chat.direct')
      assert.equal(can(denied, action), false)
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

// chat.use는 그 방의 참여자인지에 달려 있어 직급만으로 정해지지 않는다. 방을 아는 라우트가 방 참여를 넘겨 묻는다(회장단도 물려받지 않는다).
test('chat.use는 그 방 참여자만 된다: 회장도 참여하지 않은 방은 안 되고, 직급 없는 참여자는 된다', () => {
  for (const who of [president, vicePresident, planningHead, plain]) {
    assert.equal(can(who, 'chat.use'), false, who.memberId)
    assert.equal(can(who, 'chat.use', { inRoom: false }), false, who.memberId)
    assert.equal(can(who, 'chat.use', { inRoom: true }), true, who.memberId)
  }
})

test('내 권한 목록: 방에 달린 chat.use와 재정·요청한 사람 칸은 빼고, 회장은 나머지 전부, 부회장은 회장 넘기기만 빼고, 직급 없는 운영진은 보기와 1:1과 구매 요청만 가진다', () => {
  const listed = ACTIONS.filter(
    action =>
      !['chat.use', 'purchase.cancel', 'purchase.approve', 'finance.manage'].includes(action),
  )
  assert.deepEqual(permissionsOf(president), listed)
  assert.deepEqual(
    permissionsOf(vicePresident),
    listed.filter(action => action !== 'president.transfer'),
  )
  assert.deepEqual(permissionsOf(planningHead), ['council.view', 'chat.direct', 'purchase.request'])
  assert.deepEqual(permissionsOf(plain), ['council.view', 'chat.direct', 'purchase.request'])
})

// 구매와 재정 칸(DEC-27 기준 3·5, DEC-28, DEC-41). 재정은 직급으로 물려받지 않고, 결재에는 직무 분리가 없다.
test('구매 칸: 요청은 모든 운영진이 한다', () => {
  for (const who of [president, planningHead, planningMember, financeMember, plain])
    assert.equal(can(who, 'purchase.request'), true, who.memberId)
})

test('구매 칸: 취소는 요청한 사람만이고 회장단도 물려받지 않으며, 맥락이 없으면 거부한다', () => {
  for (const who of [president, vicePresident, planningHead, financeMember, plain]) {
    assert.equal(can(who, 'purchase.cancel', { requestedBy: who.memberId }), true, who.memberId)
    assert.equal(can(who, 'purchase.cancel', { requestedBy: 'someone' }), false, who.memberId)
    assert.equal(can(who, 'purchase.cancel'), false, who.memberId)
  }
})

test('재정 칸: 결재와 재정 관리는 재정부만이고 회장단과 부장도 물려받지 않으며, 자기 요청도 결재한다', () => {
  for (const action of ['purchase.approve', 'finance.manage'] as const) {
    assert.equal(can(financeMember, action), true, action)
    for (const denied of [
      president,
      vicePresident,
      planningHead,
      planningViceHead,
      planningMember,
      plain,
    ])
      assert.equal(can(denied, action), false, `${action} ${denied.memberId}`)
  }
  assert.equal(can(financeMember, 'purchase.approve', { requestedBy: 'finance' }), true)
  assert.equal(can(financeMember, 'purchase.approve', { requestedBy: 'other' }), true)
})

test('내 권한 목록: 재정부원은 구매 요청, 결재, 재정 관리를 받고 회장단과 부장은 구매 요청만 받는다', () => {
  const purchases = (who: Actor) =>
    permissionsOf(who).filter(
      action => action.startsWith('purchase.') || action.startsWith('finance.'),
    )
  assert.deepEqual(purchases(financeMember), [
    'purchase.request',
    'purchase.approve',
    'finance.manage',
  ])
  for (const who of [president, vicePresident, planningHead, planningViceHead])
    assert.deepEqual(purchases(who), ['purchase.request'])
})

// 업무 칸(DEC-28). 맥락은 업무의 부서(departmentId)와 담당자(assigneeId)다. 담당자 기준은 회장단도 물려받지 않는다.
test('업무 칸: 부장 기준은 그 부서 부장과 회장단, 부서 없는 업무는 회장단만이다', () => {
  for (const action of ['task.manage', 'task.assign', 'task.status'] as const) {
    for (const allowed of [president, vicePresident, planningHead, planningViceHead])
      assert.equal(can(allowed, action, { departmentId: 'planning' }), true, action)
    for (const denied of [planningMember, financeMember, plain])
      assert.equal(can(denied, action, { departmentId: 'planning' }), false, action)
    assert.equal(can(planningHead, action, { departmentId: 'finance' }), false, action)
    assert.equal(can(vicePresident, action, {}), true, action)
    assert.equal(can(planningHead, action, {}), false, action)
  }
})

test('업무 칸: 담당자는 고치기와 상태 바꾸기만 되고 맡기기는 안 되며, 맥락의 담당자가 나일 때만 맞다', () => {
  const mine = { departmentId: 'planning', assigneeId: 'member' }
  assert.equal(can(planningMember, 'task.manage', mine), true)
  assert.equal(can(planningMember, 'task.status', mine), true)
  assert.equal(can(planningMember, 'task.assign', mine), false)
  assert.equal(can(planningMember, 'task.set_department', mine), false)
  assert.equal(
    can(planningMember, 'task.manage', { departmentId: 'planning', assigneeId: 'x' }),
    false,
  )
  assert.equal(can(planningMember, 'task.manage', { departmentId: 'planning' }), false)
  assert.equal(can(planningMember, 'task.manage'), false)
  // 회장도 담당자 기준을 물려받지 않는다.
  assert.equal(allows(president, { who: ['assignee'] }, { assigneeId: 'x' }), false)
  assert.equal(allows(president, { who: ['assignee'] }, { assigneeId: 'president' }), true)
})

test('업무 칸: 부서 정하기는 회장단만이다', () => {
  for (const allowed of [president, vicePresident])
    assert.equal(can(allowed, 'task.set_department', { departmentId: 'planning' }), true)
  for (const denied of [planningHead, planningViceHead, planningMember, plain])
    assert.equal(can(denied, 'task.set_department', { departmentId: 'planning' }), false)
})

test('내 권한 목록: 회장단은 업무 넷을 받고, 부장과 직급 없는 운영진은 받지 않는다', () => {
  const tasks = ['task.manage', 'task.set_department', 'task.assign', 'task.status']
  const taskActions = (who: Actor) =>
    permissionsOf(who).filter(action => action.startsWith('task.'))
  for (const who of [president, vicePresident]) assert.deepEqual(taskActions(who), tasks)
  for (const who of [planningHead, planningViceHead, planningMember, financeMember, plain])
    assert.deepEqual(taskActions(who), [])
})
