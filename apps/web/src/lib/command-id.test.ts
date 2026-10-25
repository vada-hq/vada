import { afterEach, expect, test, vi } from 'vitest'
import { CreateExpenseSchema } from '@vada/contracts'
import { newCommandId } from './command-id'

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
