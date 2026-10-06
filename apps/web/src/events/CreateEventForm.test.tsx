// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import CreateEventForm from './CreateEventForm'

afterEach(cleanup)
test('labels its input, delegates edits and disables creation while saving', () => {
  const onNameChange = vi.fn()
  const props = { name: '', saving: false, disabled: false, error: '', onNameChange, onSubmit: vi.fn() }
  const view = render(<CreateEventForm {...props} />)
  expect(screen.getByRole('button', { name: '행사 만들기' }).hasAttribute('disabled')).toBe(true)
  fireEvent.change(screen.getByLabelText('행사 이름'), { target: { value: '축제' } })
  expect(onNameChange).toHaveBeenCalledWith('축제')
  view.rerender(<CreateEventForm {...props} name="축제" saving />)
  expect(screen.getByLabelText('행사 이름').hasAttribute('disabled')).toBe(true)
  expect(screen.getByRole('button', { name: '만드는 중…' }).hasAttribute('disabled')).toBe(true)
})

test('이름이 100자를 넘으면 만들기 버튼을 막고 글자 수를 보여 준다', () => {
  const props = { onNameChange: () => {}, saving: false, disabled: false, error: '', onSubmit: () => {} }
  const view = render(<CreateEventForm {...props} name={'😀'.repeat(100)} />)
  expect((screen.getByRole('button', { name: '행사 만들기' }) as HTMLButtonElement).disabled).toBe(false)
  expect(screen.getByText('100 / 100자')).toBeTruthy()
  view.rerender(<CreateEventForm {...props} name={'😀'.repeat(101)} />)
  expect((screen.getByRole('button', { name: '행사 만들기' }) as HTMLButtonElement).disabled).toBe(true)
})
