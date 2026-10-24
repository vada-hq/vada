import assert from 'node:assert/strict'
import { test } from 'node:test'
import { TASK_STATUSES, type TaskStatus } from '@vada/contracts'
import { autoMoveOf, humanMoveOf, isRaised, nextOf, targetOf } from './lifecycle.js'

test('카드의 다음 단계: 할 일 → 진행 중 → 끝남, 끝남은 없다', () => {
  assert.equal(nextOf('todo'), 'in_progress')
  assert.equal(nextOf('in_progress'), 'done')
  assert.equal(nextOf('done'), null)
})

test('사람의 이동: 셋 사이 어디로든 되고 같은 값은 옮기지 않는다', () => {
  for (const from of TASK_STATUSES)
    for (const to of TASK_STATUSES)
      assert.equal(humanMoveOf(from, to), from === to ? null : to, `${from} → ${to}`)
})

test('저절로 이동: 목표가 지금보다 앞일 때만 목표로 옮긴다', () => {
  const rank = (status: TaskStatus) => TASK_STATUSES.indexOf(status)
  for (const from of TASK_STATUSES)
    for (const target of TASK_STATUSES)
      assert.equal(
        autoMoveOf(from, target),
        rank(target) > rank(from) ? target : null,
        `${from} → ${target}`,
      )
})

test('단계가 올랐는가: 오른 것만 참이고 같거나 내려가거나 빠짐이 되면 거짓이다', () => {
  assert.equal(isRaised('none', 'in_progress'), true)
  assert.equal(isRaised('in_progress', 'finished'), true)
  assert.equal(isRaised('none', 'finished'), true)
  assert.equal(isRaised('finished', 'finished'), false)
  assert.equal(isRaised('finished', 'in_progress'), false)
  assert.equal(isRaised('in_progress', 'excluded'), false)
})

test('업무의 목표: 빠지지 않은 결과물 중 가장 낮은 단계, 모두 빠지면 목표 없음', () => {
  assert.equal(targetOf([]), null)
  assert.equal(targetOf(['excluded']), null)
  assert.equal(targetOf(['none']), 'todo')
  assert.equal(targetOf(['in_progress']), 'in_progress')
  assert.equal(targetOf(['finished']), 'done')
  assert.equal(targetOf(['finished', 'in_progress']), 'in_progress')
  assert.equal(targetOf(['finished', 'finished']), 'done')
  assert.equal(targetOf(['finished', 'none']), 'todo')
  assert.equal(targetOf(['finished', 'excluded']), 'done')
})
