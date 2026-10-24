import assert from 'node:assert/strict'
import { test } from 'node:test'
import { TASK_ACTIONS } from '@vada/contracts'
import type { Actor } from '../access/actor.js'
import { actionsOf, canLinkResult, decide, factsOf } from './policy.js'

// 판정은 순수하다: 같은 사실이면 읽기 actions와 쓰기의 거절이 같은 결과를 낸다(기능 015, 012 policy.test와 같은 꼴).
const member = (memberId: string): Actor => ({
  memberId,
  councilId: 'c',
  cohortId: 'h',
  membershipId: 'm',
  councilRank: null,
  departments: [],
})
const facts = (extra: Partial<Parameters<typeof factsOf>[0]> = {}) =>
  factsOf({ departmentId: 'd', assigneeId: 'a', createdBy: 'a', eventOwnerId: null, ...extra })

test('actions는 decide가 허용하는 동작과 같다', () => {
  for (const who of ['a', 'b']) {
    const actor = member(who)
    const f = facts()
    assert.deepEqual(
      actionsOf(actor, f),
      TASK_ACTIONS.filter(action => decide(actor, f, action) === null),
    )
  }
})

test('만든 사실을 읽지 않았으면 담당자도 지우지 못한다(막는 쪽)', () => {
  assert.equal(decide(member('a'), facts(), 'task.remove'), null)
  assert.equal(decide(member('a'), facts({ createdBy: null }), 'task.remove'), 'FORBIDDEN')
  assert.equal(decide(member('a'), facts({ createdBy: 'b' }), 'task.remove'), 'FORBIDDEN')
})

test('결과물을 이을 수 있는 업무: 끝나지 않았고 내가 상태를 바꿀 수 있을 때만', () => {
  assert.equal(canLinkResult(member('a'), facts(), 'todo'), true)
  assert.equal(canLinkResult(member('a'), facts(), 'in_progress'), true)
  assert.equal(canLinkResult(member('a'), facts(), 'done'), false)
  assert.equal(canLinkResult(member('b'), facts(), 'todo'), false)
})
