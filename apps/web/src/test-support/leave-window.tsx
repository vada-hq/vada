import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { expect } from 'vitest'
import LeaveConfirm from '@/components/LeaveConfirm'
import { LEAVE_CONFIRM, LEAVE_TITLE } from '@/lib/messages'
import { settle } from './settle'

// 떠날 때 확인 창은 작업 공간이 하나 둔다(CouncilWorkspace). 창만 그리는 시험은 곁에 이것을 둔다.
export const showLeaveConfirm = () => render(<LeaveConfirm />)

const confirmWindow = () => screen.queryByRole('dialog', { name: LEAVE_TITLE })
const inputWindow = (name: string) => screen.queryByRole('dialog', { name })
const closeButtons = (name: string) =>
  within(screen.getByRole('dialog', { name })).getAllByRole('button', { name: '닫기' })

// 창을 닫는 길 다섯. 화면의 [닫기]가 ×보다 먼저 온다(×는 창의 맨 끝에 그린다).
const exits = (name: string): [string, () => void][] => [
  ['Esc', () => fireEvent.keyDown(screen.getByRole('dialog', { name }), { key: 'Escape' })],
  ['×', () => fireEvent.click(closeButtons(name).at(-1)!)],
  ['[닫기]', () => fireEvent.click(closeButtons(name)[0]!)],
  [
    '바깥 누름',
    () => {
      fireEvent.pointerDown(document.body, { button: 0 })
      fireEvent.pointerUp(document.body, { button: 0 })
      fireEvent.click(document.body)
    },
  ],
  ['뒤로', () => act(() => window.history.back())],
]

// 입력이 있는 창: 어느 길로 닫아도 묻고, 계속 쓰면 창이 그대로 남는다.
export async function expectAsksOnEveryExit(name: string) {
  for (const [way, shut] of exits(name)) {
    await settle()
    shut()
    const asked = await screen.findByRole('dialog', { name: LEAVE_TITLE }).catch(() => {
      throw new Error(`${way}: 확인 창이 뜨지 않았다`)
    })
    fireEvent.click(within(asked).getAllByRole('button', { name: '닫기' })[0]!)
    await waitFor(() => expect(confirmWindow()).toBeNull())
    await settle()
    expect(inputWindow(name), way).not.toBeNull()
  }
}

// 확인 창에서 입력을 버리고 나간다.
export async function leaveWindow(name: string) {
  await settle()
  fireEvent.click(closeButtons(name).at(-1)!)
  fireEvent.click(await screen.findByRole('button', { name: LEAVE_CONFIRM }))
  await waitFor(() => expect(inputWindow(name)).toBeNull())
}

// 입력이 없거나 자동으로 채운 값만 있는 창: 묻지 않고 닫힌다.
export async function expectClosesQuietly(name: string) {
  await settle()
  fireEvent.keyDown(screen.getByRole('dialog', { name }), { key: 'Escape' })
  await waitFor(() => expect(inputWindow(name)).toBeNull())
  await settle()
  expect(confirmWindow()).toBeNull()
}
