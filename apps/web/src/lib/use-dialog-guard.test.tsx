// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, renderHook } from '@testing-library/react'
import { useDialogGuard } from './use-dialog-guard'

afterEach(cleanup)

test('열려 있는 동안 닫을 이유가 생기면 한 번 알린다', () => {
  const lost = vi.fn()
  const { rerender } = renderHook(({ open, reason }) => useDialogGuard(open, reason, lost), {
    initialProps: { open: true, reason: null as string | null },
  })
  expect(lost).not.toHaveBeenCalled()
  rerender({ open: true, reason: '권한이 바뀌었어요' })
  rerender({ open: true, reason: '권한이 바뀌었어요' })
  expect(lost).toHaveBeenCalledOnce()
  expect(lost).toHaveBeenCalledWith('권한이 바뀌었어요')
})

test('닫혀 있으면 이유가 있어도 알리지 않고, 다시 열면 알린다', () => {
  const lost = vi.fn()
  const { rerender } = renderHook(({ open }) => useDialogGuard(open, '이유', lost), {
    initialProps: { open: false },
  })
  expect(lost).not.toHaveBeenCalled()
  rerender({ open: true })
  expect(lost).toHaveBeenCalledOnce()
})
