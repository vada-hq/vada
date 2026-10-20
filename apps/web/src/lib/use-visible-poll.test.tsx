// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { PUSH_ARRIVED_EVENT } from './service-worker'
import { useVisiblePoll } from './use-visible-poll'

const INTERVAL = 3000

function setVisibility(state: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: state })
  document.dispatchEvent(new Event('visibilitychange'))
}

function Poller({ run }: { run: () => void }) {
  useVisiblePoll(run, INTERVAL)
  return null
}

beforeEach(() => {
  vi.useFakeTimers()
  setVisibility('visible')
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

test('보이는 동안 간격마다 부르고, 숨으면 멈추고, 다시 보이면 바로 한 번 부른다', () => {
  const run = vi.fn()
  render(<Poller run={run} />)
  vi.advanceTimersByTime(INTERVAL * 2)
  expect(run).toHaveBeenCalledTimes(2)

  setVisibility('hidden')
  vi.advanceTimersByTime(INTERVAL * 5)
  expect(run).toHaveBeenCalledTimes(2)

  setVisibility('visible')
  expect(run).toHaveBeenCalledTimes(3)
  vi.advanceTimersByTime(INTERVAL)
  expect(run).toHaveBeenCalledTimes(4)
})

test('처음부터 숨어 있으면 부르지 않고, 화면을 떠나면 멈춘다', () => {
  setVisibility('hidden')
  const run = vi.fn()
  const view = render(<Poller run={run} />)
  vi.advanceTimersByTime(INTERVAL * 3)
  expect(run).not.toHaveBeenCalled()

  setVisibility('visible')
  expect(run).toHaveBeenCalledTimes(1)
  view.unmount()
  vi.advanceTimersByTime(INTERVAL * 3)
  setVisibility('hidden')
  setVisibility('visible')
  expect(run).toHaveBeenCalledTimes(1)
})

test('푸시가 왔다는 알림이 오면 보일 때만 바로 한 번 더 부른다', () => {
  const run = vi.fn()
  render(<Poller run={run} />)
  window.dispatchEvent(new Event(PUSH_ARRIVED_EVENT))
  expect(run).toHaveBeenCalledTimes(1)
  setVisibility('hidden')
  window.dispatchEvent(new Event(PUSH_ARRIVED_EVENT))
  expect(run).toHaveBeenCalledTimes(1)
})
