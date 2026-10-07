// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import InviteShare from './InviteShare'

afterEach(() => { cleanup(); Reflect.deleteProperty(navigator, 'clipboard') })
const clipboard = (writeText: (value: string) => Promise<void>) =>
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
const link = () => `${window.location.origin}/join/ABCD2345`

test('copies the invite link and the code separately', async () => {
  const writeText = vi.fn(async (_value: string) => {})
  clipboard(writeText)
  render(<InviteShare code="ABCD2345" />)
  fireEvent.click(screen.getByRole('button', { name: '초대 링크 복사' }))
  expect((await screen.findByRole('status')).textContent).toBe('초대 링크를 복사했어요')
  expect(writeText).toHaveBeenLastCalledWith(link())
  fireEvent.click(screen.getByRole('button', { name: '코드 복사' }))
  expect((await screen.findByText('초대 코드를 복사했어요'))).toBeTruthy()
  expect(writeText).toHaveBeenLastCalledWith('ABCD2345')
})

test('shows the link and code to copy by hand when copying is refused', async () => {
  clipboard(vi.fn(async () => { throw new Error('denied') }))
  render(<InviteShare code="ABCD2345" />)
  fireEvent.click(screen.getByRole('button', { name: '초대 링크 복사' }))
  expect((await screen.findByRole('alert')).textContent).toContain('복사하지 못했어요')
  expect((screen.getByLabelText('초대 링크') as HTMLInputElement).value).toBe(link())
  expect((screen.getByLabelText('초대 코드') as HTMLInputElement).value).toBe('ABCD2345')
})

test('a browser without the clipboard API falls back the same way', async () => {
  render(<InviteShare code="ABCD2345" />)
  fireEvent.click(screen.getByRole('button', { name: '코드 복사' }))
  expect(await screen.findByLabelText('초대 코드')).toBeTruthy()
})
