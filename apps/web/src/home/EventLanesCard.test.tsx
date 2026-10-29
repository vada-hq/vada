// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { eventLane } from '@/test-support/home-fixtures'
import EventLanesCard from './EventLanesCard'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const props = { today: '2026-10-23', onOpen: vi.fn(), onSignal: vi.fn(), onSeeAll: vi.fn() }

test('0건이던 구역에 행사가 생기면(홈을 다시 읽음) 시간 축 폭을 다시 재기 시작한다', () => {
  const observe = vi.fn()
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe = observe
      disconnect = vi.fn()
    },
  )
  const { rerender } = render(<EventLanesCard lanes={{ events: [], total: 0 }} {...props} />)
  expect(observe).not.toHaveBeenCalled()
  rerender(<EventLanesCard lanes={{ events: [eventLane('e1')], total: 1 }} {...props} />)
  expect(observe).toHaveBeenCalledTimes(1)
})
