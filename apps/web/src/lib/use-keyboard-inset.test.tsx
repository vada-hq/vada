// @vitest-environment jsdom
import { act, cleanup, render } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { useKeyboardInset } from './use-keyboard-inset'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

// iOS Safari처럼 키보드가 올라오면 비주얼 뷰포트만 줄고 레이아웃 뷰포트(clientHeight)는 그대로다.
function fakeViewport(height: number, offsetTop = 0) {
  const target = new EventTarget()
  const viewport = Object.assign(target, { height, offsetTop })
  vi.stubGlobal('visualViewport', viewport)
  return viewport
}

function Sheet() {
  useKeyboardInset()
  return null
}

const root = () => document.documentElement.style
const LAYOUT = document.documentElement.clientHeight

test('키보드가 올라오면 시트를 키보드 위로 올릴 값을 두고, 창이 모두 닫히면 지운다', () => {
  const viewport = fakeViewport(LAYOUT)
  const first = render(<Sheet />)
  const second = render(<Sheet />)
  expect(root().getPropertyValue('--keyboard-inset')).toBe('0px')
  act(() => {
    Object.assign(viewport, { height: LAYOUT - 300, offsetTop: 100 })
    viewport.dispatchEvent(new Event('resize'))
  })
  expect(root().getPropertyValue('--keyboard-inset')).toBe('200px')
  expect(root().getPropertyValue('--visual-viewport-height')).toBe(`${LAYOUT - 300}px`)
  second.unmount()
  expect(root().getPropertyValue('--keyboard-inset')).toBe('200px')
  first.unmount()
  expect(root().getPropertyValue('--keyboard-inset')).toBe('')
  expect(root().getPropertyValue('--visual-viewport-height')).toBe('')
})

test('visualViewport가 없는 브라우저에서는 아무것도 두지 않는다', () => {
  vi.stubGlobal('visualViewport', undefined)
  render(<Sheet />)
  expect(root().getPropertyValue('--keyboard-inset')).toBe('')
})
