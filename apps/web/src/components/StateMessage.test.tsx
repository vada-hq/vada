// @vitest-environment jsdom
import { afterEach, expect, test } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import StateMessage from './StateMessage'

afterEach(cleanup)
test('loading and notices use a polite status without owning async state', () => {
  const view = render(<StateMessage kind="loading">불러오는 중…</StateMessage>)
  expect(screen.getByRole('status').textContent).toBe('불러오는 중…')
  view.rerender(<StateMessage kind="notice">저장했어요.</StateMessage>)
  expect(screen.getByRole('status').textContent).toBe('저장했어요.')
})
test('errors are alerts and accept layout classes without losing their role', () => {
  render(
    <StateMessage kind="error" className="app-notice">
      연결 실패
    </StateMessage>,
  )
  expect(screen.getByRole('alert').classList.contains('app-notice')).toBe(true)
})
test('empty states are ordinary text, not errors or loading announcements', () => {
  render(<StateMessage kind="empty">목록이 없어요.</StateMessage>)
  expect(screen.getByText('목록이 없어요.')).toBeTruthy()
  expect(screen.queryByRole('alert')).toBeNull()
  expect(screen.queryByRole('status')).toBeNull()
})
