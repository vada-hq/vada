import { afterEach, expect, test, vi } from 'vitest'
import { CreateExpenseSchema } from '@vada/contracts'
import { newCommandId, reuseCommandId, withCommandId, type CommandMemo } from './command-id'

const commandId = CreateExpenseSchema.shape.commandId

afterEach(() => vi.unstubAllGlobals())

test('randomUUID가 없는 곳에서도 계약이 받는 v4 꼴 번호를 만든다', () => {
  vi.stubGlobal('crypto', { getRandomValues: crypto.getRandomValues.bind(crypto) })
  const ids = Array.from({ length: 50 }, () => newCommandId())
  for (const id of ids) expect(commandId.safeParse(id).success).toBe(true)
  expect(new Set(ids).size).toBe(ids.length)
})

test('randomUUID가 있으면 그것을 쓴다', () => {
  expect(commandId.safeParse(newCommandId()).success).toBe(true)
})

test('같은 본문이면 같은 번호, 본문이 바뀌면 새 번호다', () => {
  const memo: { current: CommandMemo } = { current: null }
  const first = reuseCommandId(memo, '{"a":1}')
  expect(reuseCommandId(memo, '{"a":1}')).toBe(first)
  const second = reuseCommandId(memo, '{"a":2}')
  expect(second).not.toBe(first)
  expect(commandId.safeParse(second).success).toBe(true)
  // 앞 본문으로 돌아가도 이미 버린 번호다.
  expect(reuseCommandId(memo, '{"a":1}')).not.toBe(first)
})

test('withCommandId는 자리 값을 빼고 본문이 같으면 같은 번호로 바꾼다', () => {
  const memo: { current: CommandMemo } = { current: null }
  const first = withCommandId(memo, { commandId: 'x', amount: 1 })
  expect(first.commandId).not.toBe('x')
  expect(first.amount).toBe(1)
  expect(withCommandId(memo, { commandId: 'y', amount: 1 }).commandId).toBe(first.commandId)
  expect(withCommandId(memo, { commandId: 'x', amount: 2 }).commandId).not.toBe(first.commandId)
})
