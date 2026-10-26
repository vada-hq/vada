// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import PersonName from './PersonName'

afterEach(cleanup)

test('여는 동작이 없으면 누를 수 없는 이름 글이다', () => {
  render(<PersonName name="이재정" />)
  expect(screen.getByText('이재정')).toBeTruthy()
  expect(screen.queryByRole('button')).toBeNull()
})

test('여는 동작이 있으면 1:1 대화를 여는 버튼이고, 둘레 카드의 누르기로 번지지 않는다', () => {
  const onOpen = vi.fn()
  const onCard = vi.fn()
  render(
    <div onClick={onCard}>
      <PersonName name="이재정" onOpen={onOpen} />
    </div>,
  )
  const button = screen.getByRole('button', { name: '이재정 1:1 대화' })
  expect(button.textContent).toBe('이재정')
  fireEvent.click(button)
  expect(onOpen).toHaveBeenCalledTimes(1)
  expect(onCard).not.toHaveBeenCalled()
})

test('줄이는 이름은 줄임표로 자르고 전체 이름은 title에 둔다', () => {
  render(<PersonName name="아주긴이름을가진운영진" truncate onOpen={() => {}} />)
  const text = screen.getByText('아주긴이름을가진운영진')
  expect(text.className).toContain('truncate')
  expect(screen.getByRole('button').getAttribute('title')).toBe('아주긴이름을가진운영진')
})
