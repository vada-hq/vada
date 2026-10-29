import { expect, test } from 'vitest'
import { cn } from './utils'

test('홈 구역의 이름 붙은 글자 크기는 부품의 글자 크기를 바꾸고 글자색은 남긴다', () => {
  expect(cn('text-sm text-fg', 'text-row-title')).toBe('text-fg text-row-title')
  expect(cn('text-xs', 'text-row-sub', 'text-primary-strong')).toBe(
    'text-row-sub text-primary-strong',
  )
  expect(cn('rounded-md', 'rounded-tray')).toBe('rounded-tray')
})
