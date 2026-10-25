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
      ![
        'chat.use',
        'purchase.cancel',
        'purchase.approve',
        'finance.manage',
        'fee_payment.manage',
      ].includes(action),
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

test('업무 칸: 지우기는 부장 기준과 담당자이면서 만든 사람이고, 담당자만으로는 안 된다(DEC-73)', () => {
  const mine = { departmentId: 'planning', assigneeId: 'member', createdBy: 'member' }
  assert.equal(can(planningMember, 'task.delete', mine), true)
  assert.equal(can(planningMember, 'task.delete', { ...mine, createdBy: 'x' }), false)
  assert.equal(
    can(planningMember, 'task.delete', { departmentId: 'planning', assigneeId: 'member' }),
    false,
  )
  assert.equal(can(planningMember, 'task.delete', { ...mine, assigneeId: 'x' }), false)
  assert.equal(can(planningMember, 'task.delete', { createdBy: 'member' }), false)
  assert.equal(can(planningHead, 'task.delete', { departmentId: 'planning' }), true)
  assert.equal(can(planningHead, 'task.delete', { departmentId: 'finance' }), false)
  assert.equal(can(president, 'task.delete', {}), true)
  assert.equal(
    can(planningMember, 'task.delete', { departmentId: 'finance', eventOwnerId: 'member' }),
    true,
  )
})

test('업무 칸: 부서 정하기는 회장단만이다', () => {
  for (const allowed of [president, vicePresident])
    assert.equal(can(allowed, 'task.set_department', { departmentId: 'planning' }), true)
  for (const denied of [planningHead, planningViceHead, planningMember, plain])
    assert.equal(can(denied, 'task.set_department', { departmentId: 'planning' }), false)
})

test('내 권한 목록: 회장단은 업무 다섯을 받고, 부장과 직급 없는 운영진은 받지 않는다', () => {
  const tasks = ['task.manage', 'task.delete', 'task.set_department', 'task.assign', 'task.status']
  const taskActions = (who: Actor) =>
    permissionsOf(who).filter(action => action.startsWith('task.'))
  for (const who of [president, vicePresident]) assert.deepEqual(taskActions(who), tasks)
  for (const who of [planningHead, planningViceHead, planningMember, financeMember, plain])
    assert.deepEqual(taskActions(who), [])
})

// 행사 칸(DEC-28 '행사', DEC-79). 만들기는 회장단이고, 고치기는 회장단과 맥락의 책임자가 나일 때다. 책임자 정하기는 없다.
test('행사 칸: 만들기는 회장단만 한다', () => {
  for (const allowed of [president, vicePresident]) assert.equal(can(allowed, 'event.create'), true)
  for (const denied of [planningHead, planningViceHead, planningMember, financeMember, plain])
    assert.equal(can(denied, 'event.create'), false, denied.memberId)
})

test('행사 칸: 고치기는 회장단과 책임자가 나일 때만 맞고 그 밖은 거부한다', () => {
  for (const who of [president, vicePresident]) {
    assert.equal(can(who, 'event.update', { eventOwnerId: 'someone' }), true, who.memberId)
    assert.equal(can(who, 'event.update', {}), true, who.memberId)
    assert.equal(can(who, 'event.update'), true, who.memberId)
  }
  for (const who of [planningHead, financeMember, plain]) {
    assert.equal(can(who, 'event.update', { eventOwnerId: who.memberId }), true, who.memberId)
    assert.equal(can(who, 'event.update', { eventOwnerId: 'someone' }), false, who.memberId)
    assert.equal(can(who, 'event.update', {}), false, who.memberId)
    assert.equal(can(who, 'event.update'), false, who.memberId)
  }
})

test('내 권한 목록: 회장단은 행사 만들기·고치기·완료를 받고, 나머지는 행사 칸이 없다', () => {
  const events = (who: Actor) => permissionsOf(who).filter(action => action.startsWith('event.'))
  for (const who of [president, vicePresident])
    assert.deepEqual(events(who), ['event.create', 'event.update', 'event.complete'])
  for (const who of [planningHead, planningMember, financeMember, plain])
    assert.deepEqual(events(who), [])
})

test('업무 칸: 그 행사의 책임자는 부서와 담당자와 관계없이 업무를 만들고 맡기고 부서를 정하고 상태를 바꾼다', () => {
  const inEvent = { departmentId: 'finance', eventOwnerId: 'member' }
  for (const action of [
    'task.manage',
    'task.assign',
    'task.status',
    'task.set_department',
  ] as const) {
    assert.equal(can(planningMember, action, inEvent), true, action)
    assert.equal(can(planningMember, action, { ...inEvent, eventOwnerId: 'x' }), false, action)
    assert.equal(can(planningMember, action, { departmentId: 'finance' }), false, action)
    assert.equal(can(planningMember, action), false, action)
  }
  // 회장단도 책임자가 아니면 이 기준으로는 맞지 않는다(회장단 기준으로만 맞는다).
  assert.equal(allows(president, { who: ['event_owner'] }, { eventOwnerId: 'x' }), false)
})

// 참가 신청 칸(기능 007, DEC-28 '행사', DEC-25). 관리는 책임자·담당 부서·회장단, 신청자 정보 보기는 거기에 재정부다.
const designHead = actor('designHead', null, [{ departmentId: 'design', role: null, rank: 'head' }])

test('참가 신청 관리: 책임자, 그 행사 담당 부서 사람, 회장단만 하고 재정부와 다른 부서는 못 한다', () => {
  const inEvent = { eventOwnerId: 'owner', eventDepartmentIds: ['planning'] }
  for (const allowed of [president, vicePresident, planningHead, planningViceHead, planningMember])
    assert.equal(can(allowed, 'registration.manage', inEvent), true, allowed.memberId)
  for (const denied of [financeMember, plain, designHead])
    assert.equal(can(denied, 'registration.manage', inEvent), false, denied.memberId)
  // 책임자는 어느 부서든 된다.
  assert.equal(can(actor('owner', null), 'registration.manage', inEvent), true)
})

// 행사 완료는 회장단만(기능 008, DEC-39). 입금 확인은 신청 관리와 같은 기준이라 책임자와 담당 부서, 회장단이다.
test('행사 완료: 회장단만 하고 책임자도 부장도 재정부도 못 한다', () => {
  for (const who of [president, vicePresident]) assert.equal(can(who, 'event.complete'), true)
  for (const who of [planningHead, planningMember, financeMember, plain])
    assert.equal(can(who, 'event.complete', { eventOwnerId: who.memberId }), false, who.memberId)
})

test('입금 확인: 신청 관리와 같은 사람이 하고, 맥락이 없으면 책임자와 담당 부서 기준은 거부한다', () => {
  const inEvent = { eventOwnerId: 'owner', eventDepartmentIds: ['planning'] }
  for (const allowed of [president, vicePresident, planningHead, planningMember])
    assert.equal(can(allowed, 'deposit.confirm', inEvent), true, allowed.memberId)
  assert.equal(can(actor('owner', null), 'deposit.confirm', inEvent), true)
  for (const denied of [financeMember, plain, designHead])
    assert.equal(can(denied, 'deposit.confirm', inEvent), false, denied.memberId)
  for (const context of [undefined, {}, { eventDepartmentIds: [] }, { eventOwnerId: 'x' }]) {
    for (const denied of [planningHead, planningMember, plain, designHead])
      assert.equal(can(denied, 'deposit.confirm', context), false, denied.memberId)
    for (const allowed of [president, vicePresident])
      assert.equal(can(allowed, 'deposit.confirm', context), true, allowed.memberId)
  }
})

test('내 권한 목록: 회장단은 입금 확인을 받고 나머지는 받지 않는다', () => {
  const deposit = (who: Actor) => permissionsOf(who).filter(action => action.startsWith('deposit.'))
  for (const who of [president, vicePresident]) assert.deepEqual(deposit(who), ['deposit.confirm'])
  for (const who of [planningHead, planningMember, financeMember, plain])
    assert.deepEqual(deposit(who), [])
})

test('참가 신청 칸의 행사 담당 부서 기준은 맥락이 없거나 빈 목록이면 거부한다(회장단만 맞는다)', () => {
  for (const action of ['registration.manage', 'registration.view_applicants'] as const) {
    for (const context of [undefined, {}, { eventDepartmentIds: [] }, { eventOwnerId: 'x' }]) {
      for (const denied of [planningHead, planningMember, plain, designHead])
        assert.equal(can(denied, action, context), false, `${action} ${denied.memberId}`)
      for (const allowed of [president, vicePresident])
        assert.equal(can(allowed, action, context), true, `${action} ${allowed.memberId}`)
    }
    // 다른 부서의 업무만 있으면 그 부서만 맞는다.
    assert.equal(can(planningHead, action, { eventDepartmentIds: ['design'] }), false, action)
    assert.equal(can(designHead, action, { eventDepartmentIds: ['design'] }), true, action)
  }
})

test('신청자 정보 보기: 관리하는 사람에 재정부가 더해지고, 재정부는 맥락이 없어도 본다', () => {
  const inEvent = { eventDepartmentIds: ['planning'] }
  for (const allowed of [president, vicePresident, planningHead, planningMember, financeMember])
    assert.equal(can(allowed, 'registration.view_applicants', inEvent), true, allowed.memberId)
  for (const denied of [plain, designHead])
    assert.equal(can(denied, 'registration.view_applicants', inEvent), false, denied.memberId)
  assert.equal(can(financeMember, 'registration.view_applicants'), true)
  assert.equal(can(financeMember, 'registration.manage', inEvent), false)
})

test('학생회비 납부: 올리기와 빼기는 재정부만이고, 보기는 재정부와 회장단이다', () => {
  for (const who of [president, vicePresident, planningHead, planningMember, plain])
    assert.equal(can(who, 'fee_payment.manage'), false, who.memberId)
  assert.equal(can(financeMember, 'fee_payment.manage'), true)
  for (const who of [president, vicePresident, financeMember])
    assert.equal(can(who, 'fee_payment.view'), true, who.memberId)
  for (const who of [planningHead, planningViceHead, planningMember, plain])
    assert.equal(can(who, 'fee_payment.view'), false, who.memberId)
})

test('내 권한 목록: 회장단은 신청 관리·보기와 납부 보기를, 재정부는 신청자 보기와 납부 둘을 받고, 부장과 직급 없는 운영진은 받지 않는다', () => {
  const mine = (who: Actor) =>
    permissionsOf(who).filter(
      action => action.startsWith('registration.') || action.startsWith('fee_payment.'),
    )
  for (const who of [president, vicePresident])
    assert.deepEqual(mine(who), [
      'registration.manage',
      'registration.view_applicants',
      'fee_payment.view',
    ])
  assert.deepEqual(mine(financeMember), [
    'registration.view_applicants',
    'fee_payment.manage',
    'fee_payment.view',
  ])
  for (const who of [planningHead, planningViceHead, planningMember, plain])
    assert.deepEqual(mine(who), [])
})
