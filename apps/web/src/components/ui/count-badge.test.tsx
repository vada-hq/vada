// @vitest-environment jsdom
import { afterEach, expect, test } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { CountBadge } from './count-badge'

afterEach(cleanup)

test('0이면 그리지 않는다', () => {
  const { container } = render(<CountBadge count={0} label="안 읽은 메시지 0개" />)
  expect(container.innerHTML).toBe('')
})

test('99까지는 수 그대로, 넘으면 99+이고 읽는 이름을 받는다', () => {
  render(
    <>
      <CountBadge count={99} label="안 읽은 메시지 99개" />
      <CountBadge count={120} label="안 읽은 메시지 120개" />
    </>,
  )
  expect(screen.getByLabelText('안 읽은 메시지 99개').textContent).toBe('99')
  const many = screen.getByLabelText('안 읽은 메시지 120개')
  expect(many.textContent).toBe('99+')
  expect(many.className).toContain('bg-red-600')
  expect(many.className).toContain('text-white')
})

test('앞 글을 붙이고, 목록이 잘렸으면 +를 붙인다', () => {
  render(
    <>
      <CountBadge count={2} prefix="지남" label="지난 업무 2개" />
      <CountBadge count={3} prefix="지남" more label="지난 업무 3개 이상" />
    </>,
  )
  expect(screen.getByLabelText('지난 업무 2개').textContent).toBe('지남 2')
  expect(screen.getByLabelText('지난 업무 3개 이상').textContent).toBe('지남 3+')
})
