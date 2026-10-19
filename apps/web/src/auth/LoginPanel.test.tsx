// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import LoginPanel from './LoginPanel'
import { asElement } from '@/test-support/elements'

afterEach(cleanup)
const handlers = () => ({ onLogin: vi.fn(), onLoginInApp: vi.fn() })

test('카카오톡 안에서는 Google 로그인 대신 바깥 브라우저로 가는 길을 보여 준다', () => {
  render(<LoginPanel kakao homeScreenApp={false} busy={false} {...handlers()} />)
  expect(screen.getByRole('button', { name: '바깥 브라우저로 열기' })).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Google로 로그인' })).toBeNull()
})

test('바깥 브라우저에서는 Google 로그인을 부르고, 로그인 중에는 막는다', () => {
  const props = handlers()
  const view = render(<LoginPanel kakao={false} homeScreenApp={false} busy={false} {...props} />)
  fireEvent.click(screen.getByRole('button', { name: 'Google로 로그인' }))
  expect(props.onLogin).toHaveBeenCalledTimes(1)
  expect(screen.queryByRole('button', { name: '다른 방법으로 로그인' })).toBeNull()
  view.rerender(<LoginPanel kakao={false} homeScreenApp={false} busy {...props} />)
  expect(
    asElement(screen.getByRole('button', { name: 'Google로 이동 중…' }), HTMLButtonElement)
      .disabled,
  ).toBe(true)
})

test('아이폰 홈 화면 앱은 앱 안 창 로그인을 기본으로, 지금 방식을 둘째로 둔다', () => {
  const props = handlers()
  render(<LoginPanel kakao={false} homeScreenApp busy={false} {...props} />)
  fireEvent.click(screen.getByRole('button', { name: 'Google로 로그인' }))
  expect(props.onLoginInApp).toHaveBeenCalledTimes(1)
  fireEvent.click(screen.getByRole('button', { name: '다른 방법으로 로그인' }))
  expect(props.onLogin).toHaveBeenCalledTimes(1)
  expect(
    screen.getByText(
      '로그인이 안 되면 사파리에서 VADA에 로그인한 뒤, 홈 화면의 VADA를 지우고 다시 추가해 주세요.',
    ),
  ).toBeTruthy()
})
