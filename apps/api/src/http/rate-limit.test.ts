import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createRateLimiter } from './rate-limit.js'

const at = (ms: number) => new Date(1_000_000 + ms)

test('창 안에서 한도까지는 받고 그다음은 막는다. 다른 계정은 막히지 않는다', () => {
  const limiter = createRateLimiter({ limit: 20, windowMs: 10_000 })
  for (let index = 0; index < 20; index++) assert.equal(limiter.take('a', at(index)), true)
  assert.equal(limiter.take('a', at(20)), false)
  assert.equal(limiter.take('b', at(20)), true)
})

test('막힌 시도는 세지 않고, 가장 오래된 것이 창을 벗어나면 다시 받는다', () => {
  const limiter = createRateLimiter({ limit: 2, windowMs: 1000 })
  assert.equal(limiter.take('a', at(0)), true)
  assert.equal(limiter.take('a', at(500)), true)
  assert.equal(limiter.take('a', at(900)), false)
  assert.equal(limiter.take('a', at(999)), false)
  // 정확히 창만큼 지난 시각(0)은 창 밖이다.
  assert.equal(limiter.take('a', at(1000)), true)
  assert.equal(limiter.take('a', at(1001)), false)
  assert.equal(limiter.take('a', at(1500)), true)
})

test('계정이 많이 쌓이면 지난 기록을 쓸어 내고도 새 계정을 받는다', () => {
  const limiter = createRateLimiter({ limit: 1, windowMs: 1000 })
  for (let index = 0; index < 1000; index++) assert.equal(limiter.take(`u${index}`, at(0)), true)
  assert.equal(limiter.take('u0', at(10)), false)
  assert.equal(limiter.take('u0', at(5000)), true)
  assert.equal(limiter.take('late', at(5000)), true)
})
