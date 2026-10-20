// @vitest-environment jsdom
import { expect, test } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { isAtBottom, useStickToBottom } from './useStickToBottom'

const box = (scrollTop: number) => {
  const el = document.createElement('div')
  Object.defineProperty(el, 'scrollHeight', { value: 1000, configurable: true })
  Object.defineProperty(el, 'clientHeight', { value: 400, configurable: true })
  el.scrollTop = scrollTop
  return el
}

test('맨 아래에서 몇 픽셀 안이면 맨 아래로 본다', () => {
  expect(isAtBottom({ scrollTop: 600, scrollHeight: 1000, clientHeight: 400 })).toBe(true)
  expect(isAtBottom({ scrollTop: 590, scrollHeight: 1000, clientHeight: 400 })).toBe(true)
  expect(isAtBottom({ scrollTop: 500, scrollHeight: 1000, clientHeight: 400 })).toBe(false)
})

test('맨 아래에 있을 때만 새 메시지를 따라 내려간다', () => {
  const el = box(600)
  const { result, rerender } = renderHook(({ id }) => useStickToBottom(id), {
    initialProps: { id: 'a' },
  })
  act(() => {
    result.current.ref(el)
  })
  rerender({ id: 'b' })
  expect(el.scrollTop).toBe(1000)

  el.scrollTop = 100
  result.current.onScroll()
  rerender({ id: 'c' })
  expect(el.scrollTop).toBe(100)

  el.scrollTop = 600
  result.current.onScroll()
  rerender({ id: 'd' })
  expect(el.scrollTop).toBe(1000)
})
