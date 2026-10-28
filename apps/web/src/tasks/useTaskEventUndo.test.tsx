// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { act, cleanup, renderHook } from '@testing-library/react'
import { deferredResponse, json, mockApi } from '@/test-support/mock-api'
import { taskDetail } from '@/test-support/task-detail-fixtures'
import { eventChangeOf, useTaskEventUndo } from './useTaskEventUndo'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const change = { taskId: 't1', previousId: null, event: { id: 'e1', name: '환영회' } }

test('행사 되돌리기는 이전 연결로 보내고 상세와 목록을 갱신한다', async () => {
  const api = mockApi()
  const task = taskDetail({ id: 't1', event: { id: 'e0', name: '이전 행사' } })
  api.on('POST', '/api/organizations/c1/tasks/t1', () => json({ task }))
  const onDone = vi.fn()
  const onRestored = vi.fn()
  const { result } = renderHook(() => useTaskEventUndo('c1', onDone, vi.fn()))
  act(() => result.current.note({ ...change, previousId: 'e0', onRestored }))
  await act(() => result.current.undo())
  expect(api.calls[0]?.body).toEqual({ eventId: 'e0' })
  expect(onRestored).toHaveBeenCalledWith(task)
  expect(onDone).toHaveBeenCalledTimes(1)
  expect(result.current.bar).toBeNull()
})

test('되돌리기 중 권한을 잃으면 값을 바꾸지 않고 오류와 다시 누를 길을 남긴다', async () => {
  const api = mockApi()
  api.on('POST', '/api/organizations/c1/tasks/t1', () => json({ error: 'FORBIDDEN' }, 403))
  const onDone = vi.fn()
  const onForbidden = vi.fn()
  const onRestored = vi.fn()
  const { result } = renderHook(() => useTaskEventUndo('c1', onDone, onForbidden))
  act(() => result.current.note({ ...change, onRestored }))
  await act(() => result.current.undo())
  expect(onForbidden).toHaveBeenCalledTimes(1)
  expect(onDone).not.toHaveBeenCalled()
  expect(onRestored).not.toHaveBeenCalled()
  expect(result.current.bar?.busy).toBe(false)
  expect(result.current.bar?.event).toEqual(change.event)
  expect(typeof result.current.bar?.error).toBe('string')
})

test('늦게 끝난 되돌리기는 그사이 생긴 다른 이동 안내를 지우지 않는다', async () => {
  const api = mockApi()
  const pending = deferredResponse()
  api.on('POST', '/api/organizations/c1/tasks/t1', () => pending.promise)
  const { result } = renderHook(() => useTaskEventUndo('c1', vi.fn(), vi.fn()))
  act(() => result.current.note(change))
  let done: Promise<void>
  act(() => {
    done = result.current.undo()
  })
  act(() => result.current.note({ ...change, taskId: 't2' }))
  await act(async () => {
    pending.resolve(json({ task: taskDetail({ id: 't1' }) }))
    await done
  })
  expect(result.current.bar?.taskId).toBe('t2')
})

test('행사 연결이 없는 응답이나 같은 행사는 이동 안내를 만들지 않는다', () => {
  const before = taskDetail({ event: change.event })
  expect(eventChangeOf(before, taskDetail({ event: change.event }))).toBeNull()
  expect(eventChangeOf(before, taskDetail({ event: null }))).toBeNull()
})
