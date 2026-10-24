// @vitest-environment jsdom
import { StrictMode, useState } from 'react'
import { afterEach, beforeEach, expect, test } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { Dialog, DialogContent, DialogTitle } from './dialog'
import { Sheet, SheetContent } from './sheet'

const KEY = 'vadaWindow'

function depth() {
  const state = window.history.state as Record<string, unknown> | null
  return state?.[KEY] ?? null
}

async function userBack() {
  const popped = new Promise<void>(resolve =>
    window.addEventListener('popstate', () => resolve(), { once: true }),
  )
  window.history.back()
  await popped
}

// 끝난 일 대신 시간을 기다리는 곳은 '일어나지 않아야 하는 일'을 볼 때와 정리뿐이다.
async function settle() {
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 20))
  })
}

// busy가 켜져 있으면 닫기를 거절하는 창(보내는 중)
function Window({
  title,
  busy = false,
  child,
}: {
  title: string
  busy?: boolean
  child?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [childOpen, setChildOpen] = useState(false)
  return (
    <>
      <button onClick={() => setOpen(true)}>{title} 열기</button>
      <Dialog open={open} onOpenChange={next => (busy && !next ? undefined : setOpen(next))}>
        <DialogContent>
          <DialogTitle>{title}</DialogTitle>
          {child && <button onClick={() => setChildOpen(true)}>확인 열기</button>}
          <Dialog open={childOpen} onOpenChange={setChildOpen}>
            <DialogContent>
              <DialogTitle>확인</DialogTitle>
            </DialogContent>
          </Dialog>
        </DialogContent>
      </Dialog>
    </>
  )
}

beforeEach(() => {
  window.history.replaceState(null, '', '/')
})
afterEach(async () => {
  cleanup()
  await settle()
})

test('창을 열면 같은 주소로 기록 한 칸이 생기고, 뒤로 가기가 그 창만 닫는다', async () => {
  render(<Window title="창" />)
  fireEvent.click(screen.getByText('창 열기'))
  await waitFor(() => expect(depth()).toBe(1))
  expect(window.location.pathname).toBe('/')
  await userBack()
  await waitFor(() => expect(screen.queryByText('창', { selector: 'h2' })).toBeNull())
  expect(depth()).toBeNull()
  expect(screen.getByText('창 열기')).toBeTruthy()
})

test('닫기 버튼으로 닫으면 자기 칸을 거둬 다음 뒤로 가기가 헛돌지 않는다', async () => {
  render(<Window title="창" />)
  fireEvent.click(screen.getByText('창 열기'))
  await waitFor(() => expect(depth()).toBe(1))
  fireEvent.click(screen.getByRole('button', { name: '닫기' }))
  await waitFor(() => expect(depth()).toBeNull())
  expect(screen.queryByText('창', { selector: 'h2' })).toBeNull()
})

test('Esc로 닫아도 칸을 거두고 다시 열 수 있다', async () => {
  render(<Window title="창" />)
  fireEvent.click(screen.getByText('창 열기'))
  await waitFor(() => expect(depth()).toBe(1))
  fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' })
  await waitFor(() => expect(depth()).toBeNull())
  fireEvent.click(screen.getByText('창 열기'))
  await waitFor(() => expect(depth()).toBe(1))
  await userBack()
  await waitFor(() => expect(depth()).toBeNull())
})

test('창 위의 창은 칸을 쌓고 뒤로 가기가 하나씩 닫는다', async () => {
  render(<Window title="상세" child />)
  fireEvent.click(screen.getByText('상세 열기'))
  await waitFor(() => expect(depth()).toBe(1))
  fireEvent.click(screen.getByText('확인 열기'))
  await waitFor(() => expect(depth()).toBe(2))
  await userBack()
  await waitFor(() => expect(screen.queryByText('확인', { selector: 'h2' })).toBeNull())
  expect(screen.getByText('상세', { selector: 'h2' })).toBeTruthy()
  expect(depth()).toBe(1)
  await userBack()
  await waitFor(() => expect(screen.queryByText('상세', { selector: 'h2' })).toBeNull())
  expect(depth()).toBeNull()
})

test('개발 모드(StrictMode)에서도 칸은 하나이고 창은 바로 닫히지 않는다', async () => {
  render(
    <StrictMode>
      <Window title="창" />
    </StrictMode>,
  )
  fireEvent.click(screen.getByText('창 열기'))
  await waitFor(() => expect(depth()).toBe(1))
  expect(screen.getByText('창', { selector: 'h2' })).toBeTruthy()
  // 칸이 둘이면 첫 뒤로 가기가 창을 닫지 못하고 깊이 1에 남는다.
  await userBack()
  await waitFor(() => expect(screen.queryByText('창', { selector: 'h2' })).toBeNull())
  expect(depth()).toBeNull()
})

test('보내는 중이라 닫지 않는 창은 뒤로 가기에 닫히지 않고 칸을 다시 채운다', async () => {
  const { rerender } = render(<Window title="창" busy />)
  fireEvent.click(screen.getByText('창 열기'))
  await waitFor(() => expect(depth()).toBe(1))
  await userBack()
  // 닫히지 않음은 기다릴 일이 없어 시간을 둔다.
  await settle()
  expect(screen.getByText('창', { selector: 'h2' })).toBeTruthy()
  expect(depth()).toBe(1)
  rerender(<Window title="창" busy={false} />)
  await userBack()
  await waitFor(() => expect(screen.queryByText('창', { selector: 'h2' })).toBeNull())
  expect(depth()).toBeNull()
})

test('다른 상태 키는 지우지 않는다', async () => {
  window.history.replaceState({ other: 1 }, '', '/')
  render(<Window title="창" />)
  fireEvent.click(screen.getByText('창 열기'))
  await waitFor(() => expect(window.history.state).toEqual({ other: 1, [KEY]: 1 }))
})

test('새로고침으로 이전 문서의 칸이 남은 뒤에 열어도 뒤로 가기가 창을 닫는다', async () => {
  // 열린 창에서 새로고침하면 새 문서의 첫 기록 상태에 이전 창의 깊이가 남아 있다.
  window.history.replaceState({ [KEY]: 1 }, '', '/')
  render(<Window title="창" />)
  fireEvent.click(screen.getByText('창 열기'))
  await waitFor(() => expect(depth()).toBe(2))
  await userBack()
  await waitFor(() => expect(screen.queryByText('창', { selector: 'h2' })).toBeNull())
  expect(depth()).toBe(1)
})

test('옆 메뉴도 같다', async () => {
  function Side() {
    const [open, setOpen] = useState(true)
    return (
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent title="메뉴">내용</SheetContent>
      </Sheet>
    )
  }
  render(<Side />)
  await waitFor(() => expect(depth()).toBe(1))
  await userBack()
  await waitFor(() => expect(screen.queryByText('내용')).toBeNull())
  expect(depth()).toBeNull()
})
