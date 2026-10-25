// @vitest-environment jsdom
import { useRef } from 'react'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { useScrollMemory } from './use-scroll-memory'

const VIEW = 100
// jsdom은 배치를 계산하지 않아서 스크롤 위치와 높이를 흉내 낸다. 위치는 내용 높이를 넘지 못한다(브라우저처럼 잘린다).
const layout = { content: 1000 }
function fakeLayout(element: HTMLElement) {
  let top = 0
  Object.defineProperty(element, 'scrollTop', {
    configurable: true,
    get: () => top,
    set: (value: number) => {
      top = Math.max(0, Math.min(value, layout.content - VIEW))
    },
  })
  Object.defineProperty(element, 'scrollHeight', { configurable: true, get: () => layout.content })
  Object.defineProperty(element, 'clientHeight', { configurable: true, get: () => VIEW })
}

function Page({ spot }: { spot: string }) {
  const ref = useRef<HTMLElement | null>(null)
  useScrollMemory(ref, spot)
  return (
    <main
      data-testid="main"
      ref={element => {
        if (element && !('scrollHeight' in Object.getOwnPropertyDescriptors(element)))
          fakeLayout(element)
        ref.current = element
      }}
    />
  )
}
const main = () => screen.getByTestId('main')
const scrollTo = (top: number) => {
  main().scrollTop = top
  fireEvent.scroll(main())
}
const stored = (spot: string) => window.sessionStorage.getItem(`vada.scroll.${spot}`)

beforeEach(() => {
  layout.content = 1000
  window.sessionStorage.clear()
  vi.useFakeTimers()
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

test('기록 복원을 브라우저에 맡기지 않고 직접 한다', () => {
  render(<Page spot="a" />)
  expect(window.history.scrollRestoration).toBe('manual')
})

test('스크롤하면 그 칸의 위치를 sessionStorage에 둔다', () => {
  render(<Page spot="a" />)
  scrollTo(400)
  expect(stored('a')).toBe('400')
})

test('새 칸은 맨 위에서 열린다', () => {
  const view = render(<Page spot="a" />)
  scrollTo(400)
  view.rerender(<Page spot="b" />)
  expect(main().scrollTop).toBe(0)
  expect(stored('a')).toBe('400')
})

test('뒤로 돌아오면 있던 자리로 간다', () => {
  const view = render(<Page spot="a" />)
  scrollTo(400)
  view.rerender(<Page spot="b" />)
  scrollTo(50)
  view.rerender(<Page spot="a" />)
  expect(main().scrollTop).toBe(400)
  expect(stored('b')).toBe('50')
})

test('목록을 그리는 데 시간이 걸려도 그린 뒤에 그 자리로 간다', () => {
  const view = render(<Page spot="a" />)
  scrollTo(400)
  view.rerender(<Page spot="b" />)
  layout.content = 100
  view.rerender(<Page spot="a" />)
  expect(main().scrollTop).toBe(0)
  layout.content = 1000
  act(() => {
    main().append(document.createElement('div'))
  })
  return vi.advanceTimersByTimeAsync(0).then(() => expect(main().scrollTop).toBe(400))
})

test('되돌아오는 동안의 스크롤 알림이 저장된 자리를 덮어쓰지 않는다', () => {
  const view = render(<Page spot="a" />)
  scrollTo(400)
  view.rerender(<Page spot="b" />)
  layout.content = 100
  view.rerender(<Page spot="a" />)
  fireEvent.scroll(main())
  expect(stored('a')).toBe('400')
})

test('복원하는 동안 사용자가 스크롤하면 그 뜻을 따르고 더는 끌어당기지 않는다', async () => {
  const view = render(<Page spot="a" />)
  scrollTo(400)
  view.rerender(<Page spot="b" />)
  layout.content = 100
  view.rerender(<Page spot="a" />)
  fireEvent.wheel(main())
  layout.content = 1000
  act(() => {
    main().append(document.createElement('div'))
  })
  await vi.advanceTimersByTimeAsync(0)
  expect(main().scrollTop).toBe(0)
})

test('끝내 닿을 수 없는 자리는 한동안 기다리다 포기한다', async () => {
  const view = render(<Page spot="a" />)
  scrollTo(400)
  view.rerender(<Page spot="b" />)
  layout.content = 100
  view.rerender(<Page spot="a" />)
  await vi.advanceTimersByTimeAsync(10_000)
  layout.content = 1000
  act(() => {
    main().append(document.createElement('div'))
  })
  await vi.advanceTimersByTimeAsync(0)
  expect(main().scrollTop).toBe(0)
  scrollTo(30)
  expect(stored('a')).toBe('30')
})

test('sessionStorage를 못 쓰는 브라우저에서도 던지지 않는다', () => {
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('blocked')
  })
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw new Error('blocked')
  })
  expect(() => {
    render(<Page spot="a" />)
    scrollTo(10)
  }).not.toThrow()
})
