// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import LoginPanel from './LoginPanel'

afterEach(cleanup)

test('카카오톡 안에서는 Google 로그인 대신 바깥 브라우저로 가는 길을 보여 준다', () => {
  render(<LoginPanel kakao busy={false} onLogin={vi.fn()} />)
  expect(screen.getByRole('button', { name: '바깥 브라우저로 열기' })).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Google로 로그인' })).toBeNull()
})

test('바깥 브라우저에서는 Google 로그인을 부르고, 로그인 중에는 막는다', () => {
  const onLogin = vi.fn()
  const view = render(<LoginPanel kakao={false} busy={false} onLogin={onLogin} />)
  fireEvent.click(screen.getByRole('button', { name: 'Google로 로그인' }))
  expect(onLogin).toHaveBeenCalledTimes(1)
  view.rerender(<LoginPanel kakao={false} busy onLogin={onLogin} />)
  expect((screen.getByRole('button', { name: 'Google로 이동 중…' }) as HTMLButtonElement).disabled).toBe(true)
})
