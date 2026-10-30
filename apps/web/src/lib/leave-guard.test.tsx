// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { useLayoutEffect, useState } from 'react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import LeaveConfirm from '@/components/LeaveConfirm'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { leave, navigate } from './app-location'
import { LEAVE_TITLE, LEAVE_CONFIRM } from './messages'
import { hasUnsavedInput, resetLeaveGuard, useUnsavedInput, useWindowLeave } from './leave-guard'
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

// 저장 응답처럼 이벤트 밖에서 온 갱신은 화면을 그린 뒤 effect를 따로 돌린다. 부하가 크면 그 사이에 이동이나 beforeunload가 끼어,
// '저장했어요.'가 보이는데도 확인이 뜬다(App.leave 시험이 CI에서만 흔들린 원인). 지킴은 화면이 그려지는 그때 같이 바뀌어야 한다.
test('입력이 생기거나 풀린 화면이 그려진 그때 지킴도 이미 바뀌어 있다', () => {
  const seen: boolean[] = []
  function Probe() {
    useLayoutEffect(() => {
      seen.push(hasUnsavedInput())
    })
    return null
  }
  const view = render(
    <>
      <Form dirty />
      <Probe />
    </>,
  )
  view.rerender(
    <>
      <Form dirty={false} />
      <Probe />
    </>,
  )
  expect(seen).toEqual([true, false])
})

// 입력 창 하나: 닫는 길(Esc, ×, 바깥, 뒤로)은 모두 onOpenChange로 오고, [끝내기]는 화면의 [닫기] 버튼이다.
function InputWindow({
  dirty,
  sending = false,
  onClose,
}: {
  dirty: boolean
  sending?: boolean
  onClose: () => void
}) {
  const leave = useWindowLeave(onClose)
  useUnsavedInput(dirty, leave.holder)
  return (
    <Dialog
      open
      onOpenChange={open => {
        if (!open && !sending) leave.close()
      }}
    >
      <DialogContent aria-describedby={undefined}>
        <DialogTitle>입력 창</DialogTitle>
        <button onClick={leave.close}>끝내기</button>
      </DialogContent>
    </Dialog>
  )
}

function Shown({ dirty, sending, page }: { dirty: boolean; sending?: boolean; page?: boolean }) {
  const [open, setOpen] = useState(true)
  return (
    <>
      {page && <Form dirty />}
      {open && (
        <InputWindow
          dirty={dirty}
          {...(sending === undefined ? {} : { sending })}
          onClose={() => setOpen(false)}
        />
      )}
      <LeaveConfirm />
    </>
  )
}

const inputWindow = () => screen.queryByRole('dialog', { name: '입력 창', hidden: true })
const asked = () => screen.findByRole('dialog', { name: LEAVE_TITLE })
const depth = () => (window.history.state as { vadaWindow?: number } | null)?.vadaWindow ?? 0
const nextTask = () =>
  act(async () => {
    await new Promise(resolve => setTimeout(resolve, 0))
  })
// Radix는 바깥 누름 듣기를 다음 작업에서 건다. 그 뒤에 눌러야 바깥 누름이 닿는다.
const opened = async () => {
  await waitFor(() => expect(depth()).toBe(1))
  await nextTask()
}
const stay = async () => {
  fireEvent.click(within(await asked()).getAllByRole('button', { name: '닫기' })[0]!)
  await waitFor(() => expect(screen.queryByRole('dialog', { name: LEAVE_TITLE })).toBeNull())
  await settle()
}
const userBack = () => act(() => window.history.back())

test('입력이 없는 창은 묻지 않고 닫히고 기록 칸도 거둔다', async () => {
  render(<Shown dirty={false} />)
  await opened()
  fireEvent.keyDown(document.activeElement!, { key: 'Escape' })
  await waitFor(() => expect(inputWindow()).toBeNull())
  await waitFor(() => expect(depth()).toBe(0))
  expect(screen.queryByRole('dialog', { name: LEAVE_TITLE })).toBeNull()
})

test.each([
  ['Esc', () => fireEvent.keyDown(document.activeElement!, { key: 'Escape' })],
  ['×', () => fireEvent.click(screen.getAllByRole('button', { name: '닫기' })[0]!)],
  ['화면의 닫기', () => fireEvent.click(screen.getByRole('button', { name: '끝내기' }))],
  [
    '바깥 누름',
    () => {
      fireEvent.pointerDown(document.body, { button: 0 })
      fireEvent.pointerUp(document.body, { button: 0 })
      fireEvent.click(document.body)
    },
  ],
  ['기기 뒤로', userBack],
])('입력이 있는 창을 %s(으)로 닫으면 같은 확인을 거치고, 칸은 하나로 남는다', async (_, shut) => {
  render(<Shown dirty />)
  await opened()
  shut()
  await stay()
  expect(inputWindow()).not.toBeNull()
  expect(depth()).toBe(1)
  shut()
  fireEvent.click(await screen.findByRole('button', { name: LEAVE_CONFIRM }))
  await waitFor(() => expect(inputWindow()).toBeNull())
  await waitFor(() => expect(depth()).toBe(0))
  expect(pathNow()).toBe(HOME)
  expect(hasUnsavedInput()).toBe(false)
})

test('뒤로로 뜬 확인 창에서 또 뒤로를 누르면 확인 창만 닫히고 입력 창은 남는다', async () => {
  render(<Shown dirty />)
  await opened()
  userBack()
  await asked()
  await settle()
  await waitFor(() => expect(depth()).toBe(2))
  userBack()
  await waitFor(() => expect(screen.queryByRole('dialog', { name: LEAVE_TITLE })).toBeNull())
  await settle()
  expect(inputWindow()).not.toBeNull()
  expect(depth()).toBe(1)
})

test('보내는 중인 창은 뒤로에도 묻지 않고 그대로 남고 칸을 다시 채운다', async () => {
  render(<Shown dirty sending />)
  await opened()
  const pop = vi.fn()
  window.addEventListener('popstate', pop, { once: true })
  userBack()
  await waitFor(() => expect(pop).toHaveBeenCalled())
  await nextTask()
  await waitFor(() => expect(depth()).toBe(1))
  expect(inputWindow()).not.toBeNull()
  expect(screen.queryByRole('dialog', { name: LEAVE_TITLE })).toBeNull()
})

test('입력 없는 창은 뒤 화면에 입력이 있어도 묻지 않고, 뒤 화면의 지킴은 남는다', async () => {
  render(<Shown dirty={false} page />)
  await opened()
  fireEvent.keyDown(document.activeElement!, { key: 'Escape' })
  await waitFor(() => expect(inputWindow()).toBeNull())
  expect(screen.queryByRole('dialog', { name: LEAVE_TITLE })).toBeNull()
  expect(hasUnsavedInput()).toBe(true)
})

test('창의 입력만 버리고 나가도 뒤 화면의 입력은 계속 지킨다', async () => {
  render(<Shown dirty page />)
  await opened()
  fireEvent.keyDown(document.activeElement!, { key: 'Escape' })
  fireEvent.click(await screen.findByRole('button', { name: LEAVE_CONFIRM }))
  await waitFor(() => expect(inputWindow()).toBeNull())
  await waitFor(() => expect(depth()).toBe(0))
  expect(hasUnsavedInput()).toBe(true)
  const event = new Event('beforeunload', { cancelable: true })
  window.dispatchEvent(event)
  expect(event.defaultPrevented).toBe(true)
})

test('기록 상세 창 위의 입력 창을 버리고 나가도 기록 주소를 떠나지 않는다', async () => {
  const task = '3f2b8c1e-6a4d-4e0b-9c57-1a2b3c4d5e6f'
  navigate(`/tasks/${C}`)
  navigate(`/tasks/${C}/${task}`)
  render(
    <>
      <Dialoglike onBack={vi.fn()} adopts={adoptTag('tasks', task)} />
      <Shown dirty />
    </>,
  )
  await settle()
  fireEvent.keyDown(document.activeElement!, { key: 'Escape' })
  fireEvent.click(await screen.findByRole('button', { name: LEAVE_CONFIRM }))
  await waitFor(() => expect(inputWindow()).toBeNull())
  await settle()
  expect(pathNow()).toBe(`/tasks/${C}/${task}`)
})
