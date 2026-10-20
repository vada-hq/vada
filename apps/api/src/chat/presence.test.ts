import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createPresence } from './presence.js'

const at = (ms: number) => new Date(1_000_000 + ms)

test('본 지 10초 안이면 보는 중이고 10초가 지나면 아니다', () => {
  const presence = createPresence()
  presence.see('r1', 'm1', at(0))
  assert.equal(presence.isViewing('r1', 'm1', at(9_999)), true)
  assert.equal(presence.isViewing('r1', 'm1', at(10_000)), false)
  assert.equal(presence.isViewing('r2', 'm1', at(0)), false)
  assert.equal(presence.isViewing('r1', 'm2', at(0)), false)
})

test('기록이 많이 쌓이면 지난 기록을 쓸어 내고 새 기록은 남긴다', () => {
  const presence = createPresence()
  for (let n = 0; n < 1000; n++) presence.see('r', `m${n}`, at(0))
  presence.see('r', 'late', at(20_000))
  assert.equal(presence.isViewing('r', 'late', at(20_000)), true)
  assert.equal(presence.isViewing('r', 'm1', at(0)), false)
})
