// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import LeaveConfirm from '@/components/LeaveConfirm'
import { leave, navigate } from './app-location'
import { LEAVE_TITLE, LEAVE_CONFIRM } from './messages'
import { resetLeaveGuard, useUnsavedInput } from './leave-guard'
import {
  adoptTag,
  resetWindowHistory,
  useWindowHistory,
  windowHistoryIdle,
} from './use-window-history'

const C = '0199d1a0-0000-7000-8000-0000000000c1'
const HOME = `/home/${C}`
const PEOPLE = `/people/${C}`
const TASKS = `/tasks/${C}`
const pathNow = () => window.location.pathname + window.location.search

function Form({ dirty }: { dirty: boolean }) {
  useUnsavedInput(dirty)
  return <p>양식</p>
}
const mount = (dirty: boolean) =>
  render(
    <>
      <Form dirty={dirty} />
      <LeaveConfirm />
    </>,
  )
const dialogs = () => screen.queryByRole('dialog')
const settle = () =>
  act(async () => {
    await windowHistoryIdle()
  })

beforeEach(() => {
  navigate(HOME, { replace: true, force: true })
  resetLeaveGuard()
})
afterEach(async () => {
  cleanup()
  await windowHistoryIdle()
  resetWindowHistory()
  vi.restoreAllMocks()
})

test('입력이 없으면 확인 없이 바로 옮겨 간다', () => {
  mount(false)
  navigate(PEOPLE)
  expect(pathNow()).toBe(PEOPLE)
  expect(dialogs()).toBeNull()
})

test('저장하지 않은 입력이 있으면 메뉴 이동 전에 확인 창이 먼저 뜬다', async () => {
  mount(true)
  navigate(PEOPLE)
  expect(pathNow()).toBe(HOME)
  expect(await screen.findByText(LEAVE_TITLE)).toBeTruthy()
})

test('계속 쓰기(닫기)면 그대로고 기록도 쌓이지 않는다', async () => {
  mount(true)
  const push = vi.spyOn(window.history, 'pushState')
  navigate(PEOPLE)
  fireEvent.click((await screen.findAllByRole('button', { name: '닫기' }))[0]!)
  await waitFor(() => expect(dialogs()).toBeNull())
  await settle()
  expect(pathNow()).toBe(HOME)
  expect(push.mock.calls.some(call => call[2] === PEOPLE)).toBe(false)
})

test('나가기를 고르면 옮겨 가고, 뒤로 한 번이면 떠난 화면이다(확인 창의 기록 칸이 남지 않는다)', async () => {
  mount(true)
  navigate(PEOPLE)
  fireEvent.click(await screen.findByRole('button', { name: LEAVE_CONFIRM }))
  await waitFor(() => expect(pathNow()).toBe(PEOPLE))
  await settle()
  act(() => window.history.back())
  await waitFor(() => expect(pathNow()).toBe(HOME))
})

test('탭이나 거르기를 바꾸는 바꿔 쓰기도 같은 확인을 거친다', async () => {
  mount(true)
  navigate(`${HOME}`.replace('/home/', '/tasks/') + '?view=all', { replace: true })
  expect(pathNow()).toBe(HOME)
  fireEvent.click(await screen.findByRole('button', { name: LEAVE_CONFIRM }))
  await waitFor(() => expect(pathNow()).toBe(`${TASKS}?view=all`))
})

test('권한이나 소속을 잃어 어쩔 수 없이 떠나는 이동(force)은 묻지 않는다', () => {
  mount(true)
  navigate(PEOPLE, { replace: true, force: true })
  expect(pathNow()).toBe(PEOPLE)
  expect(dialogs()).toBeNull()
})

test('확인 창이 떠 있는 채 강제로 떠나면 그 요청은 사라져, 새 작업 공간이 옛 확인을 띄우지 않는다', async () => {
  const view = mount(true)
  navigate(PEOPLE)
  expect(await screen.findByText(LEAVE_TITLE)).toBeTruthy()
  navigate(TASKS, { replace: true, force: true })
  await waitFor(() => expect(dialogs()).toBeNull())
  expect(pathNow()).toBe(TASKS)
  view.unmount()
  render(<LeaveConfirm />)
  expect(dialogs()).toBeNull()
})

test('화면 안 뒤로(leave)는 앱 안에서 쌓은 칸이면 확인 뒤 한 칸 뒤로 간다', async () => {
  const view = mount(false)
  navigate(PEOPLE)
  view.rerender(
    <>
      <Form dirty />
      <LeaveConfirm />
    </>,
  )
  leave(HOME)
  expect(pathNow()).toBe(PEOPLE)
  fireEvent.click(await screen.findByRole('button', { name: LEAVE_CONFIRM }))
  await waitFor(() => expect(pathNow()).toBe(HOME))
})

test('기기 뒤로는 한 칸 되돌려 놓고 묻는다: 계속 쓰기면 그 자리, 나가기면 앞 화면', async () => {
  const view = mount(false)
  navigate(PEOPLE)
  await settle()
  view.rerender(
    <>
      <Form dirty />
      <LeaveConfirm />
    </>,
  )
  act(() => window.history.back())
  expect(await screen.findByText(LEAVE_TITLE)).toBeTruthy()
  await waitFor(() => expect(pathNow()).toBe(PEOPLE))
  fireEvent.click(screen.getAllByRole('button', { name: '닫기' })[0]!)
  await waitFor(() => expect(dialogs()).toBeNull())
  await settle()
  expect(pathNow()).toBe(PEOPLE)
  act(() => window.history.back())
  fireEvent.click(await screen.findByRole('button', { name: LEAVE_CONFIRM }))
  await waitFor(() => expect(pathNow()).toBe(HOME))
  await waitFor(() => expect(dialogs()).toBeNull())
})

test('기기 앞으로 가기도 같은 확인을 거친다', async () => {
  const view = mount(false)
  navigate(PEOPLE)
  await settle()
  act(() => window.history.back())
  await waitFor(() => expect(pathNow()).toBe(HOME))
  view.rerender(
    <>
      <Form dirty />
      <LeaveConfirm />
    </>,
  )
  act(() => window.history.forward())
  expect(await screen.findByText(LEAVE_TITLE)).toBeTruthy()
  await waitFor(() => expect(pathNow()).toBe(HOME))
})

function Dialoglike({ onBack, adopts }: { onBack: () => void; adopts?: string }) {
  useWindowHistory(onBack, adopts)
  return null
}

test('013 창이 쓴 기록 칸을 거두는 뒤로는 확인을 거치지 않는다(뒤로가 두 번 걸리지 않는다)', async () => {
  const onBack = vi.fn()
  render(
    <>
      <Form dirty />
      <Dialoglike onBack={onBack} />
      <LeaveConfirm />
    </>,
  )
  await settle()
  act(() => window.history.back())
  await waitFor(() => expect(onBack).toHaveBeenCalledTimes(1))
  expect(dialogs()).toBeNull()
  expect(pathNow()).toBe(HOME)
})

test('beforeunload는 입력이 있을 때만 걸린다', () => {
  const add = vi.spyOn(window, 'addEventListener')
  const remove = vi.spyOn(window, 'removeEventListener')
  const types = (spy: typeof add) => spy.mock.calls.filter(call => call[0] === 'beforeunload')
  const view = mount(false)
  expect(types(add)).toHaveLength(0)
  const quiet = new Event('beforeunload', { cancelable: true })
  window.dispatchEvent(quiet)
  expect(quiet.defaultPrevented).toBe(false)
  view.rerender(
    <>
      <Form dirty />
      <LeaveConfirm />
    </>,
  )
  expect(types(add)).toHaveLength(1)
  const loud = new Event('beforeunload', { cancelable: true })
  window.dispatchEvent(loud)
  expect(loud.defaultPrevented).toBe(true)
  view.rerender(
    <>
      <Form dirty={false} />
      <LeaveConfirm />
    </>,
  )
  expect(types(remove)).toHaveLength(1)
  const after = new Event('beforeunload', { cancelable: true })
  window.dispatchEvent(after)
  expect(after.defaultPrevented).toBe(false)
})

test('입력이 있는 화면이 사라지면(언마운트) 입력도 없는 것이 된다', () => {
  const view = mount(true)
  view.unmount()
  const event = new Event('beforeunload', { cancelable: true })
  window.dispatchEvent(event)
  expect(event.defaultPrevented).toBe(false)
  navigate(PEOPLE)
  expect(pathNow()).toBe(PEOPLE)
})

test('입력이 있는 채 이어받은 창의 칸을 거두는 이동은 막히지 않아, 앱 안 이동이 멈추지 않는다', async () => {
  const task = '3f2b8c1e-6a4d-4e0b-9c57-1a2b3c4d5e6f'
  navigate(`/tasks/${C}/${task}`)
  render(
    <>
      <Form dirty />
      <Dialoglike onBack={vi.fn()} adopts={adoptTag('tasks', task)} />
      <LeaveConfirm />
    </>,
  )
  await settle()
  navigate(PEOPLE, { force: true })
  await waitFor(() => expect(pathNow()).toBe(PEOPLE))
  navigate(HOME, { force: true })
  await waitFor(() => expect(pathNow()).toBe(HOME))
})
