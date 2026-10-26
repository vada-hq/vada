// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { act, cleanup, renderHook } from '@testing-library/react'
import { deferredResponse, json, mockApi } from '@/test-support/mock-api'
import { useStatusChange } from './useStatusChange'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

async function unmountedDuring(response: Response) {
  const api = mockApi()
  const pending = deferredResponse()
  api.on('POST', '/api/organizations/c1/tasks/a/status', () => pending.promise)
  const onDone = vi.fn()
  const view = renderHook(() => useStatusChange('c1', onDone, () => {}))
  let done!: Promise<void>
  act(() => {
    done = view.result.current.change('a', 'in_progress')
  })
  view.unmount()
  pending.resolve(response)
  await done
  return onDone
}

test('화면이 사라졌어도 성공했으면 옆 메뉴를 다시 읽게 한다', async () => {
  expect(await unmountedDuring(json({ task: {} }))).toHaveBeenCalledTimes(1)
})

test('화면이 사라졌고 실패했으면 아무것도 하지 않는다', async () => {
  expect(await unmountedDuring(json({ error: 'NOT_FOUND' }, 404))).not.toHaveBeenCalled()
})

test('같은 렌더에서 연속 호출해도 같은 업무는 한 번만 보낸다', async () => {
  const api = mockApi()
  const pending = deferredResponse()
  api.on('POST', '/api/organizations/c1/tasks/a/status', () => pending.promise)
  const view = renderHook(() =>
    useStatusChange(
      'c1',
      () => {},
      () => {},
    ),
  )
  let done!: Promise<void>
  act(() => {
    done = view.result.current.change('a', 'in_progress')
    void view.result.current.change('a', 'done')
  })
  expect(api.calls).toHaveLength(1)
  await act(async () => {
    pending.resolve(json({ task: {} }))
    await done
  })
})

test('저장 뒤 목록을 다시 읽는 동안에도 같은 업무는 다시 보내지 않는다', async () => {
  const api = mockApi()
  api.on('POST', '/api/organizations/c1/tasks/a/status', () => json({ task: {} }))
  const reload = deferredResponse()
  const view = renderHook(() =>
    useStatusChange(
      'c1',
      async () => {
        await reload.promise
      },
      () => {},
    ),
  )
  let done!: Promise<void>
  await act(async () => {
    done = view.result.current.change('a', 'done')
  })
  expect(view.result.current.busy.has('a')).toBe(true)
  await act(async () => {
    await view.result.current.change('a', 'in_progress')
  })
  expect(api.calls).toHaveLength(1)
  await act(async () => {
    reload.resolve(json({}))
    await done
  })
  expect(view.result.current.busy.has('a')).toBe(false)
})
