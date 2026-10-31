// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import { useEditVersion } from './use-edit-version'

test('다시 읽은 값이 판을 올려도 연 때의 판을 쥐고 있어 남이 먼저 고친 것을 놓치지 않는다', () => {
  const read = vi.fn(async () => null)
  const { result, rerender } = renderHook(({ versionNo }) => useEditVersion(versionNo, read), {
    initialProps: { versionNo: 3 },
  })
  rerender({ versionNo: 4 })
  expect(result.current.version).toBe(3)
  expect(result.current.fresh).toBeNull()
})

test('막힌 뒤 새 값을 읽으면 판을 옮기고 읽지 못하면 그대로 둔다', async () => {
  const read = vi.fn<() => Promise<{ versionNo: number } | null>>(async () => null)
  const { result } = renderHook(() => useEditVersion(3, read))
  await act(() => result.current.refresh())
  expect(result.current.version).toBe(3)
  read.mockResolvedValue({ versionNo: 5 })
  await act(() => result.current.refresh())
  expect(result.current.version).toBe(5)
  expect(result.current.fresh).toEqual({ versionNo: 5 })
})
