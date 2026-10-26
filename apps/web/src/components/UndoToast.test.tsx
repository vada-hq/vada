// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { UNDO_MS, UndoToast } from './UndoToast'

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

function show(onDismiss = vi.fn(), onUndo = vi.fn()) {
  render(
    <UndoToast
      text="이재정 옮기기 완료"
      error={null}
      busy={false}
      onUndo={onUndo}
      onDismiss={onDismiss}
    />,
  )
  return { onDismiss, onUndo, toast: screen.getByRole('status') }
}

test('글 한 줄과 [되돌리기]를 보이고, 10초가 지나면 사라지게 한다', () => {
  vi.useFakeTimers()
  const { onDismiss, onUndo, toast } = show()
  expect(toast.textContent).toContain('이재정 옮기기 완료')
  fireEvent.click(screen.getByRole('button', { name: '되돌리기' }))
  expect(onUndo).toHaveBeenCalledTimes(1)
  act(() => {
    vi.advanceTimersByTime(UNDO_MS - 1)
  })
  expect(onDismiss).not.toHaveBeenCalled()
  act(() => {
    vi.advanceTimersByTime(1)
  })
  expect(onDismiss).toHaveBeenCalledTimes(1)
})

test('초점이나 포인터가 안에 있으면 머물고, 나가면 다시 10초를 센다', () => {
  vi.useFakeTimers()
  const { onDismiss, toast } = show()
  fireEvent.focus(screen.getByRole('button', { name: '되돌리기' }))
  act(() => {
    vi.advanceTimersByTime(UNDO_MS * 2)
  })
  expect(onDismiss).not.toHaveBeenCalled()
  fireEvent.blur(screen.getByRole('button', { name: '되돌리기' }))
  fireEvent.pointerEnter(toast)
  act(() => {
    vi.advanceTimersByTime(UNDO_MS * 2)
  })
  expect(onDismiss).not.toHaveBeenCalled()
  fireEvent.pointerLeave(toast)
  act(() => {
    vi.advanceTimersByTime(UNDO_MS)
  })
  expect(onDismiss).toHaveBeenCalledTimes(1)
})

test('되돌리지 못했으면 글 자리에 오류를 보인다', () => {
  render(
    <UndoToast
      text="이재정 옮기기 완료"
      error="저장하지 못했어요. 다시 시도해 주세요."
      busy={false}
      onUndo={() => {}}
      onDismiss={() => {}}
    />,
  )
  expect(screen.getByRole('status').textContent).toContain('저장하지 못했어요.')
  expect(screen.getByRole('status').textContent).not.toContain('옮기기 완료')
})
