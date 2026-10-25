import { expect, test } from 'vitest'
import { menuPath, recordPath } from '@vada/contracts'
import { backLabel } from './event-back'

const C = '0199d1a0-0000-7000-8000-0000000000c1'
const T = '3f2b8c1e-6a4d-4e0b-9c57-1a2b3c4d5e6f'

test('들어온 곳이 행사 목록이거나 모르면 행사 목록이다', () => {
  expect(backLabel(null)).toBe('행사 목록')
  expect(backLabel(menuPath('events', C))).toBe('행사 목록')
  expect(backLabel('/nope')).toBe('행사 목록')
})

test('다른 메뉴에서 들어왔으면 그 메뉴의 이름이다', () => {
  expect(backLabel(menuPath('home', C))).toBe('홈')
  expect(backLabel(menuPath('tasks', C, { view: 'all' }))).toBe('업무')
  expect(backLabel(recordPath('tasks', C, T))).toBe('업무')
  expect(backLabel(recordPath('purchases', C, T))).toBe('재정')
})
